import { supabase } from './supabase'
import { getGeminiApiKey } from './geminiApiKey'
import {
  getGeminiModelLabel,
  resolveHybridModelPair
} from './geminiModels'
import {
  convertMathAndTableToPlainText,
  parseAnswerLabelToIndex
} from './examTextUtils'

const PAGE_FETCH_SIZE = 1000
const MAX_RETRY_ATTEMPTS = 4
const INITIAL_RETRY_BACKOFF_MS = 4500
// Flash Lite: 15 RPM / 500 RPD -> >= 4.2s spacing
const MIN_LITE_RPM_SPACING_MS = 4200
// Flash Standard: 5 RPM / 20 RPD -> >= 12.5s spacing
const MIN_DEEP_RPM_SPACING_MS = 12500
const MAX_ADAPTIVE_DELAY_MS = 20000

export const DEFAULT_AUDITOR_BATCH_SIZE = 40
export const MIN_AUDITOR_BATCH_SIZE = 20
export const MAX_AUDITOR_BATCH_SIZE = 50
const STAGE2_CONFIRM_BATCH_SIZE = 20

// ============================================================================
// STAGE 1 PROMPT: EXCEPTION-ONLY MEGA-BATCH ANSWER SCREENING (FLASH LITE)
// ============================================================================
const STAGE1_SCREENING_SYSTEM_INSTRUCTION = `You are an Ultra-Token-Efficient Multiple-Choice Answer Auditor (STAGE 1: EXCEPTION-ONLY SCREENING).

Input format: JSON array of compact questions:
[{"i":0,"q":"question text","o":["opt0","opt1","opt2","opt3"],"a":1,"img":0}]
Where:
- "i": integer batch index
- "q": question text
- "o": array of options (0-based)
- "a": current stored correct answer index (0-based)
- "img": 1 if the question has an external image you cannot see, 0 otherwise

STRICT RULES (CRITICAL FOR ZERO NOISE & MAXIMUM QUOTA EFFICIENCY):
1. CHECK ANSWER CORRECTNESS ONLY:
   - STRICTLY IGNORE minor typos, spelling errors, spacing, punctuation, formatting, or stylistic wording as long as the question is understandable and the current answer "a" is correct.
   - If "img": 1 (relies on an external diagram/image not shown), DO NOT flag unless the answer is obviously wrong from text alone.
2. EXCEPTION-ONLY OUTPUT:
   - If the current answer "a" is correct, defensible, or standard -> DO NOT INCLUDE IT in the output! Omit it completely!
   - Return ONLY items where the current answer "a" is CLEARLY WRONG (e.g. calculation error, factual/legal contradiction, wrong option indexed).
   - If ALL questions in the batch have acceptable answers, return {"suspects":[]}.

Return ONLY valid JSON:
{"suspects":[{"i":3,"s":1,"n":"เหตุผลสั้นๆ"}]}
Where "i" is the batch index, "s" is the suspected correct 0-based index (must differ from "a"), and "n" is a brief Thai note.`

// ============================================================================
// STAGE 2 PROMPT: DEEP CONFIRMATION (FLASH STANDARD — CUTS FALSE POSITIVES)
// ============================================================================
const STAGE2_CONFIRM_SYSTEM_INSTRUCTION = `You are a Senior Subject-Matter Expert & Final Answer Auditor (STAGE 2: DEEP CONFIRMATION).

Each question below was flagged by a fast screening model as possibly having an incorrect stored answer ("current_answer_index").
Your job is to carefully verify each question from first principles and eliminate any False Positives before alerting human administrators.

STRICT RULES:
1. FOCUS ONLY ON ANSWER CORRECTNESS — Ignore minor typos, spacing, or phrasing differences.
2. DEFAULT TO "verified" IF DEFENSIBLE:
   - If "current_answer_index" is actually correct, defensible under standard exam conventions, or in a subjective/ambiguous gray area -> set "verdict": "verified".
3. SET "verdict": "flagged" ONLY WHEN OBJECTIVELY PROVABLY WRONG:
   - Clear math/calculation error, direct contradiction of established law/fact/definition, or clearly wrong option key.
   - "suggested_answer" MUST be a valid 0-based integer index that DIFFERS from "current_answer_index".
   - "reason": concise, crystal-clear Thai explanation of (1) why the current answer is wrong and (2) why the suggested answer is right.
   - "suggested_explanation": concise, clear Thai explanation (1-3 sentences) aligned with "suggested_answer" (plain Unicode text: ², ³, ×, ÷, √, ≤, ≥, ≠, π; NO raw LaTeX).

Return ONLY valid JSON:
{"results":[{"id":"...","verdict":"verified หรือ flagged","suggested_answer":0,"suggested_explanation":"...","reason":""}]}`

function formatAuditorDbError(error, fallbackMessage) {
  const msg = String(error?.message || '')
  if (
    error?.code === '42703' ||
    msg.includes('audit_status') ||
    msg.includes('audit_suggested_answer') ||
    msg.includes('audit_reason')
  ) {
    return new Error(
      'ยังไม่พบคอลัมน์ audit_* ในตาราง questions กรุณารันไฟล์ SQL Migration (supabase/migrations/20261126_add_question_audit_columns.sql) บน Supabase ก่อนใช้งานครับ'
    )
  }
  return new Error(msg || fallbackMessage)
}

function sleepWithAbort(ms, signal) {
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

function isAbortError(error) {
  return error?.name === 'AbortError' || String(error?.message || '').toLowerCase().includes('aborted')
}

function createRpmPacer(minBaseSpacingMs) {
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

async function callAuditorGemini({
  apiKey,
  model,
  systemInstruction,
  promptText,
  pacer,
  maxRetries = MAX_RETRY_ATTEMPTS,
  signal,
  onRetryStatus
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
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            maxOutputTokens: 8192
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
        const text = (payload?.candidates?.[0]?.content?.parts || [])
          .map((p) => p.text || '')
          .join('')
        return { text }
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
        const retryAfter = Number(response.headers.get('Retry-After'))
        const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(INITIAL_RETRY_BACKOFF_MS * (2 ** attempt) + Math.floor(Math.random() * 800), 32000)

        onRetryStatus?.(
          response.status === 429
            ? `ติด Rate Limit (429) [${getGeminiModelLabel(model)}] — รอ ${(backoffMs / 1000).toFixed(1)} วินาทีแล้วลองใหม่ (${attempt + 1}/${maxRetries})...`
            : `เซิร์ฟเวอร์ Gemini ตอบสนองช้า (HTTP ${response.status}) — ลองใหม่ใน ${(backoffMs / 1000).toFixed(1)} วินาที...`
        )
        await sleepWithAbort(backoffMs, signal)
        continue
      }

      const err = new Error(
        response.status === 429
          ? `โควตาโมเดล ${getGeminiModelLabel(model)} (429/RPD) เต็มชั่วคราว ความคืบหน้าก่อนหน้านี้ถูกบันทึกในฐานข้อมูลแล้ว`
          : (payload?.error?.message || `เรียก Gemini API ไม่สำเร็จ (HTTP ${response.status})`)
      )
      err.httpStatus = response.status
      err.isQuotaOrRateLimit = response.status === 429 || response.status === 404 || response.status === 503
      throw err
    } catch (error) {
      if (isAbortError(error)) throw error
      lastError = error
      const isNetworkFailure = error instanceof TypeError || /network|fetch|timeout/i.test(error?.message || '')
      if (isNetworkFailure && attempt < maxRetries) {
        const backoffMs = INITIAL_RETRY_BACKOFF_MS * (2 ** attempt)
        onRetryStatus?.(`เชื่อมต่อเครือข่ายขัดข้อง — ลองใหม่ใน ${(backoffMs / 1000).toFixed(1)} วินาที (${attempt + 1}/${maxRetries})...`)
        await sleepWithAbort(backoffMs, signal)
        continue
      }
      throw error
    }
  }

  throw lastError || new Error('เรียก Gemini API ไม่สำเร็จ')
}

function parseJsonSafe(rawText) {
  const cleaned = String(rawText ?? '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  if (!cleaned) return null
  try {
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

// ============================================================================
// QUOTA ESTIMATION & STAGE 0 LOCAL PRE-CHECK (PURE FUNCTIONS — EASY TO TEST)
// ============================================================================

/**
 * Estimate API quota consumption before starting an audit run.
 */
export function estimateAuditQuota(questionCount, batchSize = DEFAULT_AUDITOR_BATCH_SIZE, modelRoutingMode = 'hybrid') {
  const count = Math.max(0, Number(questionCount) || 0)
  const safeBatch = Math.min(MAX_AUDITOR_BATCH_SIZE, Math.max(MIN_AUDITOR_BATCH_SIZE, Number(batchSize) || DEFAULT_AUDITOR_BATCH_SIZE))
  if (count === 0) {
    return {
      questionCount: 0,
      liteRequests: 0,
      deepRequests: 0,
      liteRpdPercent: 0,
      deepRpdPercent: 0,
      summaryText: 'ไม่มีข้อสอบที่ยังไม่ตรวจ (unchecked)'
    }
  }

  const liteScreeningReqs = Math.ceil(count / safeBatch)
  // Typical real-world suspect rate ~3-5% -> batched 20/req on Stage 2
  const estSuspects = Math.max(1, Math.round(count * 0.04))
  const stage2Reqs = Math.ceil(estSuspects / STAGE2_CONFIRM_BATCH_SIZE)

  if (modelRoutingMode === 'lite_only') {
    const totalLite = liteScreeningReqs + stage2Reqs
    return {
      questionCount: count,
      liteRequests: totalLite,
      deepRequests: 0,
      liteRpdPercent: Number(((totalLite / 500) * 100).toFixed(1)),
      deepRpdPercent: 0,
      summaryText: `ตรวจ ${count.toLocaleString()} ข้อ ≈ ~${totalLite} Requests Flash Lite (~${((totalLite / 500) * 100).toFixed(1)}% ของ 500 RPD)`
    }
  }

  return {
    questionCount: count,
    liteRequests: liteScreeningReqs,
    deepRequests: stage2Reqs,
    liteRpdPercent: Number(((liteScreeningReqs / 500) * 100).toFixed(1)),
    deepRpdPercent: Number(((stage2Reqs / 20) * 100).toFixed(1)),
    summaryText: `ตรวจ ${count.toLocaleString()} ข้อ ≈ ~${liteScreeningReqs} Requests Flash Lite (${((liteScreeningReqs / 500) * 100).toFixed(1)}% ของ 500 RPD) + ~${stage2Reqs} Requests Flash Standard`
  }
}

/**
 * Stage 0: Local Answer-Integrity Pre-Check (0 Gemini Quota).
 * Checks ONLY structural integrity directly affecting the answer key:
 * - Missing/malformed options array (< 2 choices)
 * - Invalid or out-of-bounds `correct_option` index
 * - The option pointed to by `correct_option` is empty/whitespace
 */
export function runStage0LocalPreCheck(question) {
  const options = Array.isArray(question?.options) ? question.options : null
  if (!options || options.length < 2) {
    return {
      passed: false,
      reason: 'ด่าน 0 (Local): ข้อสอบไม่มีรายการตัวเลือกที่สมบูรณ์ (น้อยกว่า 2 ตัวเลือก)'
    }
  }

  const ansIdx = question?.correct_option
  const isValidInt =
    ansIdx !== null &&
    ansIdx !== undefined &&
    ansIdx !== '' &&
    Number.isInteger(Number(ansIdx)) &&
    Number(ansIdx) >= 0 &&
    Number(ansIdx) < options.length

  if (!isValidInt) {
    return {
      passed: false,
      reason: `ด่าน 0 (Local): ค่าเฉลยปัจจุบัน (${String(ansIdx)}) หลุดขอบเขตตัวเลือกที่มีทั้งหมด ${options.length} ตัวเลือก`
    }
  }

  const answerText = String(options[Number(ansIdx)] ?? '').trim()
  if (!answerText) {
    return {
      passed: false,
      reason: `ด่าน 0 (Local): ตัวเลือกที่ ${Number(ansIdx) + 1} ซึ่งถูกกำหนดเป็นเฉลยปัจจุบันเป็นค่าว่าง`
    }
  }

  return { passed: true, reason: '' }
}

// ============================================================================
// SUPABASE STATS, QUERIES & ADMIN RESOLVE ACTIONS (AUTO-CLEANUP ON RESOLVE)
// ============================================================================

export async function fetchCategoryAuditStats(categoryId = 'ALL') {
  const countByStatus = async (status = null) => {
    let query = supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
    if (categoryId && categoryId !== 'ALL') {
      query = query.eq('category_id', categoryId)
    }
    if (status) {
      query = query.eq('audit_status', status)
    }
    const { count, error } = await query
    if (error) throw formatAuditorDbError(error, 'ไม่สามารถโหลดสถิติการตรวจทานเฉลยได้')
    return count || 0
  }

  const [total, unchecked, verified, flagged] = await Promise.all([
    countByStatus(null),
    countByStatus('unchecked'),
    countByStatus('verified'),
    countByStatus('flagged')
  ])

  return { total, unchecked, verified, flagged }
}

/**
 * Lightweight badge counter for QuestionManager.jsx (gracefully returns 0 before migration).
 */
export async function fetchFlaggedBadgeCounts(categoryId) {
  try {
    const [categoryRes, totalRes] = await Promise.all([
      categoryId
        ? supabase
            .from('questions')
            .select('id', { count: 'exact', head: true })
            .eq('category_id', categoryId)
            .eq('audit_status', 'flagged')
        : Promise.resolve({ count: 0, error: null }),
      supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('audit_status', 'flagged')
    ])

    if (categoryRes.error || totalRes.error) {
      return { categoryFlagged: 0, totalFlagged: 0 }
    }
    return {
      categoryFlagged: categoryRes.count || 0,
      totalFlagged: totalRes.count || 0
    }
  } catch {
    return { categoryFlagged: 0, totalFlagged: 0 }
  }
}

export async function fetchFlaggedQuestions(categoryId = 'ALL') {
  const items = []
  let from = 0

  while (true) {
    const to = from + PAGE_FETCH_SIZE - 1
    let query = supabase
      .from('questions')
      .select('id, category_id, question_text, options, correct_option, explanation, image_url, audit_status, audit_suggested_answer, audit_suggested_explanation, audit_reason, audit_model, audit_checked_at')
      .eq('audit_status', 'flagged')

    if (categoryId && categoryId !== 'ALL') {
      query = query.eq('category_id', categoryId)
    }

    const { data, error } = await query
      .order('audit_checked_at', { ascending: false, nullsFirst: false })
      .range(from, to)

    if (error) throw formatAuditorDbError(error, 'ไม่สามารถดึงรายการข้อสอบที่ติดสถานะ flagged ได้')
    if (!data || data.length === 0) break

    items.push(...data)
    if (data.length < PAGE_FETCH_SIZE) break
    from += PAGE_FETCH_SIZE
  }

  return items
}

async function fetchUncheckedQuestions(categoryId = 'ALL', maxLimit = null) {
  const items = []
  let from = 0

  while (true) {
    const remaining = maxLimit ? maxLimit - items.length : PAGE_FETCH_SIZE
    if (remaining <= 0) break
    const step = Math.min(PAGE_FETCH_SIZE, remaining)
    const to = from + step - 1

    let query = supabase
      .from('questions')
      .select('id, category_id, question_text, options, correct_option, explanation, image_url')
      .eq('audit_status', 'unchecked')

    if (categoryId && categoryId !== 'ALL') {
      query = query.eq('category_id', categoryId)
    }

    const { data, error } = await query
      .order('created_at', { ascending: true })
      .range(from, to)

    if (error) throw formatAuditorDbError(error, 'ไม่สามารถดึงข้อสอบที่ยังไม่ตรวจได้')
    if (!data || data.length === 0) break

    items.push(...data)
    if (data.length < step) break
    from += step
  }

  return items
}

async function markQuestionsVerifiedInDb(ids, modelName) {
  if (!Array.isArray(ids) || ids.length === 0) return
  const nowIso = new Date().toISOString()
  const CHUNK = 200
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await supabase
      .from('questions')
      .update({
        audit_status: 'verified',
        audit_suggested_answer: null,
        audit_suggested_explanation: null,
        audit_reason: null,
        audit_model: modelName || null,
        audit_checked_at: nowIso
      })
      .in('id', ids.slice(i, i + CHUNK))

    if (error) throw formatAuditorDbError(error, 'ไม่สามารถอัปเดตสถานะ verified ลงฐานข้อมูลได้')
  }
}

async function markQuestionFlaggedInDb(id, {
  suggestedAnswer = null,
  suggestedExplanation = null,
  reason = '',
  modelName = null
}) {
  const { error } = await supabase
    .from('questions')
    .update({
      audit_status: 'flagged',
      audit_suggested_answer: suggestedAnswer,
      audit_suggested_explanation: suggestedExplanation,
      audit_reason: reason || null,
      audit_model: modelName || null,
      audit_checked_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) throw formatAuditorDbError(error, 'ไม่สามารถติดสถานะ flagged ลงฐานข้อมูลได้')
}

/**
 * Admin Action 1: Accept AI Suggestion (Single or Bulk).
 * Updates `correct_option` AND replaces `explanation` with `audit_suggested_explanation`,
 * marks `audit_status = 'verified'`, and Auto-Cleans all temp audit_* fields to NULL.
 */
export async function acceptAuditSuggestions(flaggedItems) {
  if (!Array.isArray(flaggedItems) || flaggedItems.length === 0) return { updatedCount: 0, skippedCount: 0 }

  const nowIso = new Date().toISOString()
  let updatedCount = 0
  let skippedCount = 0

  for (const item of flaggedItems) {
    const options = Array.isArray(item.options) ? item.options : []
    const suggested = item.audit_suggested_answer
    const isValidSuggested =
      suggested !== null &&
      suggested !== undefined &&
      Number.isInteger(Number(suggested)) &&
      Number(suggested) >= 0 &&
      Number(suggested) < options.length

    if (!isValidSuggested) {
      skippedCount += 1
      continue
    }

    const nextExplanation = String(item.audit_suggested_explanation ?? '').trim() || item.explanation || null

    const { error } = await supabase
      .from('questions')
      .update({
        correct_option: Number(suggested),
        explanation: nextExplanation,
        audit_status: 'verified',
        audit_suggested_answer: null,
        audit_suggested_explanation: null,
        audit_reason: null,
        audit_checked_at: nowIso
      })
      .eq('id', item.id)

    if (error) throw formatAuditorDbError(error, 'ไม่สามารถอนุมัติใช้เฉลย AI ได้')
    updatedCount += 1
  }

  return { updatedCount, skippedCount }
}

/**
 * Admin Action 2: Keep Original Answer (Single or Bulk).
 * Leaves `correct_option` & `explanation` untouched, sets `audit_status = 'verified'`,
 * and Auto-Cleans all temp audit_* columns to NULL.
 */
export async function keepOriginalAnswers(questionIds) {
  if (!Array.isArray(questionIds) || questionIds.length === 0) return 0
  const nowIso = new Date().toISOString()
  const CHUNK = 200
  for (let i = 0; i < questionIds.length; i += CHUNK) {
    const { error } = await supabase
      .from('questions')
      .update({
        audit_status: 'verified',
        audit_suggested_answer: null,
        audit_suggested_explanation: null,
        audit_reason: null,
        audit_checked_at: nowIso
      })
      .in('id', questionIds.slice(i, i + CHUNK))

    if (error) throw formatAuditorDbError(error, 'ไม่สามารถยืนยันคงเฉลยเดิมได้')
  }
  return questionIds.length
}

/**
 * Admin Action 3: Manual Edit & Resolve.
 * Saves admin's manual `correct_option` & `explanation`, sets `audit_status = 'verified'`,
 * and Auto-Cleans all temp audit_* columns to NULL.
 */
export async function manualResolveAuditedQuestion(id, { correctOption, explanation }) {
  const { error } = await supabase
    .from('questions')
    .update({
      correct_option: Number(correctOption),
      explanation: String(explanation ?? '').trim() || null,
      audit_status: 'verified',
      audit_suggested_answer: null,
      audit_suggested_explanation: null,
      audit_reason: null,
      audit_checked_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) throw formatAuditorDbError(error, 'ไม่สามารถบันทึกการแก้ไขเฉลยด้วยตนเองได้')
}

/**
 * Reset audit status back to 'unchecked' for a category (or all categories) so admin can re-audit.
 */
export async function resetAuditStatus(categoryId = 'ALL') {
  let query = supabase
    .from('questions')
    .update({
      audit_status: 'unchecked',
      audit_suggested_answer: null,
      audit_suggested_explanation: null,
      audit_reason: null,
      audit_model: null,
      audit_checked_at: null
    })

  if (categoryId && categoryId !== 'ALL') {
    query = query.eq('category_id', categoryId)
  } else {
    // PostgREST requires a filter for unconditional updates
    query = query.neq('audit_status', 'unchecked')
  }

  const { error } = await query
  if (error) throw formatAuditorDbError(error, 'ไม่สามารถรีเซ็ตสถานะการตรวจทานได้')
}

// ============================================================================
// MAIN 3-TIER ULTRA-QUOTA-EFFICIENT AUDIT PIPELINE
// ============================================================================

export async function runAnswerAuditPipeline({
  categoryId = 'ALL',
  maxQuestions = null,
  batchSize = DEFAULT_AUDITOR_BATCH_SIZE,
  modelRoutingMode = 'hybrid', // 'hybrid' | 'lite_only'
  deepModelOverride = '',
  signal,
  onProgress,
  onStatsUpdated
}) {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error('ยังไม่ได้ตั้งค่า Gemini API Key กรุณาไปตั้งค่าในเมนูผู้ดูแลก่อน')
  }

  const safeBatchSize = Math.min(
    MAX_AUDITOR_BATCH_SIZE,
    Math.max(MIN_AUDITOR_BATCH_SIZE, Number(batchSize) || DEFAULT_AUDITOR_BATCH_SIZE)
  )
  const { liteModel, deepModel } = resolveHybridModelPair(deepModelOverride)
  const litePacer = createRpmPacer(MIN_LITE_RPM_SPACING_MS)
  const deepPacer = createRpmPacer(MIN_DEEP_RPM_SPACING_MS)

  let activeDeepModel = modelRoutingMode === 'hybrid' ? deepModel : liteModel
  let activeDeepPacer = modelRoutingMode === 'hybrid' ? deepPacer : litePacer
  let usingFallbackLite = modelRoutingMode !== 'hybrid'

  const runStats = {
    totalScannedTarget: 0,
    processedCount: 0,
    stage0Flagged: 0,
    stage1Requests: 0,
    stage1Verified: 0,
    stage1Suspects: 0,
    stage2Requests: 0,
    stage2FalsePositivesCleared: 0,
    stage2ConfirmedFlagged: 0,
    fallbackTriggered: false,
    fallbackNotice: ''
  }

  const emit = (extra = {}) => {
    onProgress?.({
      stage: 0,
      status: 'running',
      activeModel: liteModel,
      activeModelLabel: getGeminiModelLabel(extra.activeModel || liteModel),
      adaptiveDelayMs: (extra.pacer || litePacer).getCurrentDelayMs(),
      statusMessage: '',
      ...extra,
      runStats: { ...runStats }
    })
  }

  /**
   * Flush a batch of Stage 1 suspects through Stage 2 Deep Confirmation (Flash Standard + Auto-Fallback).
   */
  const flushStage2Suspects = async (suspectEntries) => {
    if (!suspectEntries || suspectEntries.length === 0) return

    for (let i = 0; i < suspectEntries.length; i += STAGE2_CONFIRM_BATCH_SIZE) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

      const batch = suspectEntries.slice(i, i + STAGE2_CONFIRM_BATCH_SIZE)
      emit({
        stage: 2,
        status: 'confirming',
        activeModel: activeDeepModel,
        pacer: activeDeepPacer,
        statusMessage: `ด่าน 2 [${getGeminiModelLabel(activeDeepModel)}]: กำลังยืนยันเชิงลึกข้อที่สงสัยว่าเฉลยผิด (${batch.length} ข้อ)...`
      })

      const payloadItems = batch.map(({ question, suspectNote, suspectedIndex }) => ({
        id: question.id,
        question_text: question.question_text,
        options: question.options,
        current_answer_index: Number(question.correct_option),
        current_answer_text: question.options?.[Number(question.correct_option)] || '',
        stage1_suspect_answer_index: suspectedIndex,
        stage1_suspect_note: suspectNote || ''
      }))

      const promptText = `ตรวจสอบยืนยันเชิงลึกข้อสอบจำนวน ${batch.length} ข้อที่ด่าน 1 สงสัยว่าเฉลยอาจผิด (ตรวจเฉพาะความถูกต้องของเฉลยเท่านั้น ห้ามสนเรื่องคำผิด/สำนวน):
- หากเฉลยปัจจุบันถูกต้องหรือพอรับได้ -> verdict = "verified"
- หากเฉลยปัจจุบันผิดชัดเจนพิสูจน์ได้ -> verdict = "flagged" พร้อม suggested_answer, suggested_explanation (1–3 ประโยค ภาษาไทย Unicode Plain Text ห้าม LaTeX) และ reason สั้นกระชับ

คืนค่า JSON เท่านั้น:
{"results":[{"id":"...","verdict":"verified หรือ flagged","suggested_answer":0,"suggested_explanation":"...","reason":""}]}

รายการข้อสอบ:
${JSON.stringify(payloadItems)}`

      let geminiRes
      let modelUsed = activeDeepModel

      try {
        geminiRes = await callAuditorGemini({
          apiKey,
          model: activeDeepModel,
          systemInstruction: STAGE2_CONFIRM_SYSTEM_INSTRUCTION,
          promptText,
          pacer: activeDeepPacer,
          maxRetries: !usingFallbackLite ? 1 : MAX_RETRY_ATTEMPTS,
          signal,
          onRetryStatus: (msg) => emit({
            stage: 2,
            status: 'retrying',
            activeModel: activeDeepModel,
            pacer: activeDeepPacer,
            statusMessage: `ด่าน 2: ${msg}`
          })
        })
      } catch (deepErr) {
        if (isAbortError(deepErr)) throw deepErr
        if (!usingFallbackLite && (deepErr.isQuotaOrRateLimit || deepErr.httpStatus === 429 || deepErr.httpStatus === 404 || deepErr.httpStatus === 503)) {
          usingFallbackLite = true
          const failedLabel = getGeminiModelLabel(activeDeepModel)
          const liteLabel = getGeminiModelLabel(liteModel)
          activeDeepModel = liteModel
          activeDeepPacer = litePacer
          modelUsed = liteModel

          runStats.fallbackTriggered = true
          runStats.fallbackNotice = `โมเดล ${failedLabel} ชนลิมิต RPD/429 — สลับมาใช้ ${liteLabel} ยืนยันต่ออัตโนมัติ`

          emit({
            stage: 2,
            status: 'retrying',
            activeModel: activeDeepModel,
            pacer: activeDeepPacer,
            statusMessage: `⚠️ ${runStats.fallbackNotice}`
          })

          geminiRes = await callAuditorGemini({
            apiKey,
            model: activeDeepModel,
            systemInstruction: STAGE2_CONFIRM_SYSTEM_INSTRUCTION,
            promptText,
            pacer: activeDeepPacer,
            maxRetries: MAX_RETRY_ATTEMPTS,
            signal,
            onRetryStatus: (msg) => emit({
              stage: 2,
              status: 'retrying',
              activeModel: activeDeepModel,
              pacer: activeDeepPacer,
              statusMessage: `ด่าน 2 (Fallback): ${msg}`
            })
          })
        } else {
          throw deepErr
        }
      }

      runStats.stage2Requests += 1
      const parsed = parseJsonSafe(geminiRes.text)
      const results = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.results) ? parsed.results : []
      const resultById = new Map(results.filter((r) => r?.id).map((r) => [r.id, r]))

      const clearedIds = []

      for (const { question } of batch) {
        const res = resultById.get(question.id)
        const verdict = String(res?.verdict || 'verified').toLowerCase()
        const currentIdx = Number(question.correct_option)
        const optionCount = Array.isArray(question.options) ? question.options.length : 0

        let suggestedIdx = Number(res?.suggested_answer)
        if (!Number.isInteger(suggestedIdx) || suggestedIdx < 0 || suggestedIdx >= optionCount) {
          suggestedIdx = parseAnswerLabelToIndex(res?.suggested_answer, optionCount, question.options)
        }

        const reason = convertMathAndTableToPlainText(String(res?.reason ?? '').trim())
        const suggestedExplanation = convertMathAndTableToPlainText(String(res?.suggested_explanation ?? '').trim())

        const isValidFlag =
          verdict === 'flagged' &&
          suggestedIdx !== null &&
          Number.isInteger(suggestedIdx) &&
          suggestedIdx >= 0 &&
          suggestedIdx < optionCount &&
          suggestedIdx !== currentIdx &&
          reason.length >= 6

        if (isValidFlag) {
          await markQuestionFlaggedInDb(question.id, {
            suggestedAnswer: suggestedIdx,
            suggestedExplanation: suggestedExplanation || `คำตอบที่ถูกต้องคือ "${question.options[suggestedIdx]}"`,
            reason,
            modelName: modelUsed
          })
          runStats.stage2ConfirmedFlagged += 1
        } else {
          clearedIds.push(question.id)
          runStats.stage2FalsePositivesCleared += 1
        }
        runStats.processedCount += 1
      }

      if (clearedIds.length > 0) {
        await markQuestionsVerifiedInDb(clearedIds, modelUsed)
      }

      await onStatsUpdated?.()
      emit({
        stage: 2,
        status: 'running',
        activeModel: modelUsed,
        pacer: activeDeepPacer,
        statusMessage: `ด่าน 2 [${getGeminiModelLabel(modelUsed)}]: ยืนยันแล้ว — ติด Flag ${runStats.stage2ConfirmedFlagged} ข้อ · ตัด False Positive ${runStats.stage2FalsePositivesCleared} ข้อ`
      })
    }
  }

  try {
    emit({
      stage: 0,
      status: 'initializing',
      statusMessage: 'กำลังโหลดรายการข้อสอบที่ยังไม่ตรวจ (audit_status = unchecked)...'
    })

    const uncheckedList = await fetchUncheckedQuestions(categoryId, maxQuestions)
    runStats.totalScannedTarget = uncheckedList.length

    if (uncheckedList.length === 0) {
      emit({
        stage: 2,
        status: 'completed',
        statusMessage: 'ไม่มีข้อสอบสถานะ unchecked ค้างอยู่แล้ว (ตรวจครบทุกข้อแล้วครับ)'
      })
      return { completed: true, paused: false, runStats }
    }

    // ------------------------------------------------------------------------
    // STAGE 0: Local Answer-Integrity Pre-Check (0 Quota)
    // ------------------------------------------------------------------------
    emit({
      stage: 0,
      status: 'running',
      statusMessage: `ด่าน 0 (0 Quota): กำลังตรวจความสมบูรณ์ของเฉลยเบื้องต้น ${uncheckedList.length} ข้อ...`
    })

    const passedStage0 = []
    for (const q of uncheckedList) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const check = runStage0LocalPreCheck(q)
      if (!check.passed) {
        await markQuestionFlaggedInDb(q.id, {
          suggestedAnswer: null,
          suggestedExplanation: null,
          reason: check.reason,
          modelName: 'local-precheck'
        })
        runStats.stage0Flagged += 1
        runStats.processedCount += 1
      } else {
        passedStage0.push(q)
      }
    }

    if (runStats.stage0Flagged > 0) {
      await onStatsUpdated?.()
    }

    // ------------------------------------------------------------------------
    // STAGE 1: Exception-Only Mega-Batch Screening with Flash Lite
    // ------------------------------------------------------------------------
    const pendingStage2Queue = []

    for (let i = 0; i < passedStage0.length; i += safeBatchSize) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

      const batch = passedStage0.slice(i, i + safeBatchSize)
      const batchStart = i + 1
      const batchEnd = i + batch.length

      emit({
        stage: 1,
        status: 'screening',
        activeModel: liteModel,
        pacer: litePacer,
        statusMessage: `ด่าน 1 [${getGeminiModelLabel(liteModel)}]: คัดกรอง Mega-Batch ข้อที่ ${batchStart}–${batchEnd} จาก ${passedStage0.length} ข้อ...`
      })

      // Ultra-compact payload (saves input tokens massively!)
      const compactBatch = batch.map((q, idx) => ({
        i: idx,
        q: q.question_text,
        o: q.options,
        a: Number(q.correct_option),
        img: q.image_url ? 1 : 0
      }))

      const promptText = `ตรวจเฉพาะความถูกต้องของเฉลย "a" สำหรับข้อสอบ ${batch.length} ข้อต่อไปนี้ (Exception-Only — ห้ามส่งข้อที่เฉลยถูกต้องกลับมา และห้ามทักเรื่องคำผิด/วรรคตอน):
คืนค่า JSON เฉพาะข้อที่เฉลย "a" ผิดชัดเจนเท่านั้น: {"suspects":[{"i":0,"s":1,"n":"เหตุผลสั้นๆ"}]}
หากถูกทุกข้อให้คืน {"suspects":[]}

ข้อมูลข้อสอบ:
${JSON.stringify(compactBatch)}`

      const geminiRes = await callAuditorGemini({
        apiKey,
        model: liteModel,
        systemInstruction: STAGE1_SCREENING_SYSTEM_INSTRUCTION,
        promptText,
        pacer: litePacer,
        signal,
        onRetryStatus: (msg) => emit({
          stage: 1,
          status: 'retrying',
          activeModel: liteModel,
          pacer: litePacer,
          statusMessage: `ด่าน 1: ${msg}`
        })
      })

      runStats.stage1Requests += 1
      const parsed = parseJsonSafe(geminiRes.text)
      const rawSuspects = Array.isArray(parsed?.suspects)
        ? parsed.suspects
        : Array.isArray(parsed)
          ? parsed
          : []

      const suspectIndexSet = new Set()
      for (const s of rawSuspects) {
        const idx = Number(s?.i)
        if (!Number.isInteger(idx) || idx < 0 || idx >= batch.length) continue
        if (suspectIndexSet.has(idx)) continue

        const q = batch[idx]
        const currentAns = Number(q.correct_option)
        const suspectedAns = Number(s?.s)
        // Guard against Lite flagging the same answer index as current
        if (Number.isInteger(suspectedAns) && suspectedAns === currentAns) continue

        suspectIndexSet.add(idx)
        pendingStage2Queue.push({
          question: q,
          suspectedIndex: Number.isInteger(suspectedAns) && suspectedAns >= 0 && suspectedAns < (q.options?.length || 0)
            ? suspectedAns
            : null,
          suspectNote: String(s?.n || '').trim()
        })
      }

      // Immediately mark all non-suspect questions in this batch as `verified` in Supabase!
      const verifiedIds = batch
        .filter((_, idx) => !suspectIndexSet.has(idx))
        .map((q) => q.id)

      if (verifiedIds.length > 0) {
        await markQuestionsVerifiedInDb(verifiedIds, liteModel)
        runStats.stage1Verified += verifiedIds.length
        runStats.processedCount += verifiedIds.length
      }

      runStats.stage1Suspects += suspectIndexSet.size
      await onStatsUpdated?.()

      emit({
        stage: 1,
        status: 'running',
        activeModel: liteModel,
        pacer: litePacer,
        statusMessage: `ด่าน 1: ตรวจผ่านทันที ${runStats.stage1Verified} ข้อ · รอฟันธงด่าน 2: ${pendingStage2Queue.length} ข้อ (ใช้ไป ${runStats.stage1Requests} req)`
      })

      // Flush Stage 2 immediately whenever suspect queue hits 20 items so results are saved incrementally!
      if (pendingStage2Queue.length >= STAGE2_CONFIRM_BATCH_SIZE) {
        const toFlush = pendingStage2Queue.splice(0, STAGE2_CONFIRM_BATCH_SIZE)
        await flushStage2Suspects(toFlush)
      }
    }

    // ------------------------------------------------------------------------
    // STAGE 2: Flush Remaining Suspects through Flash Standard (with Auto-Fallback)
    // ------------------------------------------------------------------------
    if (pendingStage2Queue.length > 0) {
      await flushStage2Suspects(pendingStage2Queue)
    }

    emit({
      stage: 2,
      status: 'completed',
      activeModel: activeDeepModel,
      pacer: activeDeepPacer,
      statusMessage: `ตรวจทานเสร็จสมบูรณ์! ตรวจผ่าน ${runStats.stage1Verified + runStats.stage2FalsePositivesCleared} ข้อ · พบเฉลยอาจผิด ${runStats.stage0Flagged + runStats.stage2ConfirmedFlagged} ข้อ`
    })

    return { completed: true, paused: false, runStats }
  } catch (error) {
    if (isAbortError(error)) {
      emit({
        stage: 1,
        status: 'paused',
        statusMessage: `หยุดพักชั่วคราวแล้ว (บันทึกผลที่ตรวจไปแล้ว ${runStats.processedCount}/${runStats.totalScannedTarget} ข้อ กดเริ่มใหม่จะข้ามข้อที่ตรวจแล้วอัตโนมัติ)`
      })
      return { completed: false, paused: true, runStats }
    }
    emit({
      stage: 1,
      status: 'error',
      statusMessage: error.message
    })
    throw error
  }
}
