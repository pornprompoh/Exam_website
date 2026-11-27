import { getGeminiModelLabel } from '../../../../shared/lib/geminiModels'

export const DEFAULT_MAX_RETRY_ATTEMPTS = 4
export const INITIAL_RETRY_BACKOFF_MS = 4500
// Flash Lite: 15 RPM / 500 RPD -> >= 4.2s spacing
export const MIN_LITE_RPM_SPACING_MS = 4200
// Flash Standard: 5 RPM / 20 RPD -> >= 12.5s spacing
export const MIN_DEEP_RPM_SPACING_MS = 12500
export const MAX_ADAPTIVE_DELAY_MS = 20000

export function sleepWithAbort(ms, signal) {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function isAbortError(error) {
  return error?.name === 'AbortError' || String(error?.message || '').toLowerCase().includes('aborted')
}

export function createRpmPacer(minBaseSpacingMs = MIN_LITE_RPM_SPACING_MS) {
  let minSpacingMs = minBaseSpacingMs
  let lastCallTimestamp = 0
  let consecutiveCleanCalls = 0

  return {
    getCurrentDelayMs() {
      return minSpacingMs
    },
    async waitBeforeRequest(signal) {
      if (lastCallTimestamp === 0) {
        lastCallTimestamp = Date.now()
        return
      }
      const elapsed = Date.now() - lastCallTimestamp
      const waitMs = Math.max(0, minSpacingMs - elapsed)
      if (waitMs > 250) {
        await sleepWithAbort(waitMs, signal)
      }
      lastCallTimestamp = Date.now()
    },
    recordSuccess(hadRetry) {
      if (hadRetry) {
        minSpacingMs = Math.min(Math.round(minSpacingMs * 1.4), MAX_ADAPTIVE_DELAY_MS)
        consecutiveCleanCalls = 0
      } else {
        consecutiveCleanCalls += 1
        if (consecutiveCleanCalls >= 3 && minSpacingMs > minBaseSpacingMs) {
          minSpacingMs = Math.max(minBaseSpacingMs, Math.round(minSpacingMs * 0.88))
          consecutiveCleanCalls = 0
        }
      }
    },
    recordRateLimit() {
      minSpacingMs = Math.min(Math.round(minSpacingMs * 1.5), MAX_ADAPTIVE_DELAY_MS)
      consecutiveCleanCalls = 0
    }
  }
}

export async function callGeminiJsonWithRetry({
  apiKey,
  model,
  parts,
  systemInstruction,
  temperature = 0.1,
  maxOutputTokens = 8192,
  pacer,
  maxRetries = DEFAULT_MAX_RETRY_ATTEMPTS,
  signal,
  onRetryStatus,
  quotaExceededMessage
}) {
  const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`

  let lastError = null
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (attempt === 0 && pacer) {
      await pacer.waitBeforeRequest(signal)
    }

    try {
      const response = await fetch(modelUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature,
            maxOutputTokens
          }
        })
      })

      const responseText = await response.text()
      let payload = null
      try {
        payload = responseText ? JSON.parse(responseText) : null
      } catch {
        payload = null
      }

      if (response.ok) {
        pacer?.recordSuccess(attempt > 0)
        const candidate = payload?.candidates?.[0]
        const text = (candidate?.content?.parts || []).map((part) => part.text || '').join('')
        return {
          text,
          finishReason: candidate?.finishReason || 'STOP',
          hitRateLimit: attempt > 0
        }
      }

      if (response.status === 400 || response.status === 403) {
        const apiMsg = payload?.error?.message || ''
        if (response.status === 403 || apiMsg.toLowerCase().includes('api key')) {
          throw new Error('API Key ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้งาน กรุณาตรวจสอบในหน้าตั้งค่า AI')
        }
        const err = new Error(apiMsg || `คำขอไม่ถูกต้อง (HTTP ${response.status})`)
        err.httpStatus = response.status
        throw err
      }

      const retryable = response.status === 429 || response.status === 503 || response.status === 500
      if (retryable && attempt < maxRetries) {
        pacer?.recordRateLimit()
        const retryAfterHeader = Number(response.headers.get('Retry-After'))
        const backoffMs =
          Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
            ? retryAfterHeader * 1000
            : Math.min(INITIAL_RETRY_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * 850), 32000)

        onRetryStatus?.(
          response.status === 429
            ? `ติด Rate Limit (429) [${getGeminiModelLabel(model)}] — รอ ${(backoffMs / 1000).toFixed(1)} วินาทีแล้วลองใหม่ (${attempt + 1}/${maxRetries})...`
            : `เซิร์ฟเวอร์ Gemini ตอบสนองช้า (HTTP ${response.status}) — ลองใหม่ใน ${(backoffMs / 1000).toFixed(1)} วินาที...`
        )
        await sleepWithAbort(backoffMs, signal)
        continue
      }

      const defaultQuotaMsg = `โควตาโมเดล ${getGeminiModelLabel(model)} (429/RPD) เต็มชั่วคราว ความคืบหน้าก่อนหน้านี้ถูกบันทึกไว้แล้ว`
      const err = new Error(
        response.status === 429
          ? quotaExceededMessage || defaultQuotaMsg
          : payload?.error?.message || `เรียก Gemini API ไม่สำเร็จ (HTTP ${response.status})`
      )
      err.httpStatus = response.status
      err.isQuotaOrRateLimit = response.status === 429 || response.status === 404 || response.status === 503
      throw err
    } catch (error) {
      if (isAbortError(error)) throw error
      lastError = error
      const isNetworkFailure = error instanceof TypeError || /network|fetch|timeout/i.test(error?.message || '')
      if (isNetworkFailure && attempt < maxRetries) {
        const backoffMs = INITIAL_RETRY_BACKOFF_MS * 2 ** attempt
        onRetryStatus?.(`เชื่อมต่อเครือข่ายขัดข้อง — ลองใหม่ใน ${(backoffMs / 1000).toFixed(1)} วินาที (${attempt + 1}/${maxRetries})...`)
        await sleepWithAbort(backoffMs, signal)
        continue
      }
      throw error
    }
  }

  throw lastError || new Error('เรียก Gemini API ไม่สำเร็จ')
}
