import { getGeminiApiKey } from './geminiApiKey'
import {
  getGeminiModelLabel,
  resolveHybridModelPair
} from './geminiModels'
import {
  computeFileFingerprint,
  isPdfFile,
  openLazyPdfDocument,
  readImageFileAsInlineData,
  recommendBatchConfig,
  validateExtractorFiles
} from './pdfExtractor'
import {
  convertMathAndTableToPlainText,
  normalizeForStrictExactMatch,
  normalizeSourceQuestionNumber,
  parseAnswerLabelToIndex,
  parsePartialExtractionJson,
  parsePass3BatchJson,
  validateAndFormatPass1Question
} from './examTextUtils'
import {
  applyPass2AnswerKeyMatches,
  clearExtractionCheckpoint,
  fetchCategoryExactQuestionSet,
  fetchCategoryStagingCount,
  fetchPendingStagingItems,
  insertStagingItems,
  loadCategoryCheckpoints,
  loadExtractionCheckpoint,
  saveExtractionCheckpoint,
  savePass3BatchResults
} from './stagingQuestionService'

const MAX_TEXT_CHARS_PER_BATCH = 26000
const MAX_RETRY_ATTEMPTS = 4
const INITIAL_RETRY_BACKOFF_MS = 4500
// Flash Lite: 15 RPM / 500 RPD -> >= 4.2s between requests
const MIN_LITE_RPM_SPACING_MS = 4200
// Flash Standard: 5 RPM / 20 RPD -> >= 12.5s between requests
const MIN_DEEP_RPM_SPACING_MS = 12500
const MAX_ADAPTIVE_DELAY_MS = 20000
const MAX_DETAIL_LOG_ITEMS = 400

// Two-Stage Pass 3 Batch Sizes (protects 500 RPD Lite & 20 RPD Standard quotas!)
const STAGE3A_SCREENING_BATCH_SIZE = 25 // 20-30 items/request on Flash Lite
const STAGE3B_DEEP_BATCH_SIZE = 20      // 15-25 items/request on Flash Standard

// ============================================================================
// PASS 1 SYSTEM INSTRUCTION (EXTRACT-ONLY — NEVER GUESS ANSWERS!)
// ============================================================================
const PASS1_SYSTEM_INSTRUCTION = `You are a precision Verbatim Exam Extraction Engine (PASS 1: EXTRACT-ONLY) for Thai and English multiple-choice exam documents (including 300+ page books, scanned PDFs, and photos).

STRICT PASS 1 RULES:
1. VERBATIM EXTRACTION ONLY: Extract existing multiple-choice questions faithfully from the provided pages. NEVER summarize, paraphrase, shorten, or invent new questions.
2. DO NOT SOLVE OR GUESS ANSWERS IN PASS 1:
   - If the document explicitly prints the answer right next to / right under the question, set "has_inline_answer": true, "book_answer": <0-based index>, "book_answer_label": "<original label e.g. ก or B>", and copy any printed explanation into "book_explanation".
   - If NO answer is printed directly with that question on these pages, DO NOT guess, infer, or compute an answer! Set "has_inline_answer": false, "book_answer": null, "book_answer_label": "", and "book_explanation": "". (Answer key matching & AI verification happen in Pass 2 and Pass 3 after reading the full file.)
3. COLLECT STANDALONE ANSWER KEYS / TABLES:
   - If any page in this batch contains an answer key list, end-of-chapter key, or end-of-book answer table (เฉลย / ตารางเฉลย / Answer Key), extract EVERY entry into "answer_keys" with:
     "source_section" (chapter/set name if visible), "source_question_number" (Arabic digits e.g. "1"), "answer_label" (e.g. "ก", "ข", "B", "3"), "answer_index" (0-based: ก/A/1=0, ข/B/2=1, ค/C/3=2, ง/D/4=3, จ/E/5=4), "book_explanation" (if printed in the key), and "source_page".
4. TRACK SECTION / SET HEADINGS:
   - Track chapter, unit, or exam set headings (e.g. "ชุดที่ 1", "บทที่ 2 กฎหมายปกครอง", "แนวข้อสอบชุดที่ 3") so multi-set 300+ page books that reset numbering back to #1 can be matched accurately in Pass 2.
   - Put the active section name on every extracted question ("source_section") and every answer key ("source_section"), and report the latest active section at the end of this batch in "last_detected_section".
5. FRONT-MATTER & NON-EXAM FILTERING: Automatically ignore covers, copyright pages, prefaces (คำนำ), instructions (คำชี้แจง), table of contents (สารบัญ), blank pages, and pure reading/theory pages with no questions or answer keys. Record skipped pages in "skipped_pages".
6. STRICT 4-5 CHOICE MCQ ONLY: Include ONLY multiple-choice questions with 4 or 5 options. Skip essays (อัตนัย), fill-in-the-blank (เติมคำ), matching (จับคู่), true/false, or questions with <4 or >5 options -> record them in "skipped_items" with reason "non_mcq" or "invalid_option_count".
7. SKIP IMAGE-DEPENDENT QUESTIONS: If a question or option contains or requires a figure, diagram, graph, chart, map, circuit, or illustration, DO NOT include it in "questions". Record it in "skipped_items" with reason "has_image".
8. STRIP QUESTION NUMBERS & CHOICE PREFIXES:
   - Put original question number (Arabic digits) in "source_question_number".
   - Remove leading question number ("1.", "1)", "ข้อ 1.", "ข้อที่ ๑", "(1)") from "question_text", keeping any numbers that belong to the stem content itself.
   - Remove leading option prefixes ("ก.", "ข.", "ค.", "ง.", "จ.", "A.", "B.", "C.", "D.", "E.", "1.", "(ก)") from every item in "options".
9. PLAIN-TEXT MATH & TEXT TABLES ONLY: Convert math formulas and text-based tables into clean Unicode plain text (², ³, ×, ÷, √, ≤, ≥, ≠, π, °). NEVER output raw LaTeX (\\frac, \\sqrt, $$, $) or Markdown pipe tables.
10. BOUNDARY CONTINUITY: If the very last question on the last page is cut off mid-question or missing its options because it continues on the next page, DO NOT emit a broken question — put the unfinished trailing text in "incomplete_tail_text".

Return ONLY valid JSON matching the exact schema, with no Markdown fences or extra prose.`

// ============================================================================
// STAGE 3A SYSTEM INSTRUCTION (FLASH LITE FAST SCREENING — NEVER OVERRIDE DIRECTLY!)
// ============================================================================
const STAGE3A_SCREENING_SYSTEM_INSTRUCTION = `You are a High-Throughput Exam Screening Engine (STAGE 3A) verifying multiple-choice questions that ALREADY have an official answer from the book ("book_answer_index").

STRICT STAGE 3A RULES:
1. For EVERY question in this batch (20-30 items), check whether "book_answer_index" is reasonable and consistent with the question and options.
2. DO NOT OVERRIDE THE BOOK ANSWER YOURSELF IN STAGE 3A:
   - If the book's answer is correct, defensible, or standard -> set "verdict": "book_verified" and write a clear, concise Thai "explanation" (1-3 sentences, Unicode plain text, NO raw LaTeX).
   - If you strongly suspect the book's answer is objectively wrong, mathematically incorrect, directly contradicts law/facts, or looks like a shifted/typo key -> set "verdict": "escalate_suspect" and provide a brief "suspect_note" explaining your concern so a deeper Stage 3B model can make the final decision!
3. Be conservative: do NOT escalate minor stylistic preferences or ambiguous wording. Escalate ONLY genuine suspected errors.

Return ONLY valid JSON: {"results":[{"id":"...","verdict":"book_verified หรือ escalate_suspect","explanation":"...","suspect_note":""}]} with no Markdown fences.`

// ============================================================================
// STAGE 3B SYSTEM INSTRUCTION (FLASH STANDARD DEEP ARBITRATION & SOLVING)
// ============================================================================
const STAGE3B_DEEP_SYSTEM_INSTRUCTION = `You are a Senior Subject-Matter Expert & Final Exam Arbitrator (STAGE 3B — Deep Verification).

Each item in this batch has a "task":
1. task = "arbitrate_suspect" (has "book_answer_index" that Stage 3A flagged as possibly wrong):
   - Carefully analyze the question, all options, and the book's answer from first principles.
   - STRICT OVERRIDE RULE:
     * Keep "verdict": "book_verified" and "final_answer_index": book_answer_index whenever the book answer is actually defensible, acceptable under Thai exam conventions, or in a subjective gray area.
     * Set "verdict": "ai_overridden" ONLY when there is CLEAR, OBJECTIVE, PROVABLE PROOF that the book's answer is wrong (calculation error, direct contradiction of law/statute/science/grammar, obvious typo or shifted answer key).
   - If "ai_overridden": "final_answer_index" MUST differ from "book_answer_index", and "override_reason" MUST clearly explain BOTH points in Thai:
     (1) ทำไมเฉลยจากหนังสือจึงผิดหรือไม่สมเหตุสมผลอย่างชัดเจน
     (2) ทำไมคำตอบใหม่ที่ AI เลือกจึงถูกต้องกว่า
   - Always write a concise Thai "explanation" (1-3 sentences, Unicode plain text, NO raw LaTeX) explaining why "final_answer_index" is correct.
2. task = "solve_unanswered" (no answer key existed anywhere in the book):
   - Solve accurately from first principles, set "verdict": "ai_solved", "final_answer_index": <best 0-based index>, "override_reason": "", and write a concise Thai "explanation" (1-3 sentences, Unicode plain text, NO raw LaTeX).

Return ONLY valid JSON: {"results":[{"id":"...","verdict":"book_verified หรือ ai_overridden หรือ ai_solved","final_answer_index":0,"explanation":"...","override_reason":""}]} with no Markdown fences.`

function createEmptyStats() {
  return {
    totalPages: 0,
    processedPages: 0,
    skippedFrontMatterPages: 0,
    extractedTotal: 0,
    savedToStaging: 0,
    duplicateExactMatch: 0,
    skippedImageQuestions: 0,
    skippedNonMcqQuestions: 0,
    answerKeysCollected: 0,
    answerKeysMatchedPass2: 0,
    inlineBookAnswersCount: 0,
    unmatchedForAiSolve: 0,
    escalatedToDeepCount: 0,
    stage3BRequestsUsed: 0,
    bookVerifiedCount: 0,
    aiOverriddenCount: 0,
    aiSolvedCount: 0,
    partialRecoveries: 0,
    fallbackTriggered: false,
    fallbackNotice: '',
    skippedPagesLog: [],
    skippedItemsLog: [],
    duplicateItemsLog: []
  }
}

function mergeStats(existing) {
  const base = createEmptyStats()
  if (!existing || typeof existing !== 'object') return base
  return {
    ...base,
    ...existing,
    skippedPagesLog: Array.isArray(existing.skippedPagesLog) ? [...existing.skippedPagesLog] : [],
    skippedItemsLog: Array.isArray(existing.skippedItemsLog) ? [...existing.skippedItemsLog] : [],
    duplicateItemsLog: Array.isArray(existing.duplicateItemsLog) ? [...existing.duplicateItemsLog] : []
  }
}

function pushBounded(list, item) {
  if (list.length < MAX_DETAIL_LOG_ITEMS) list.push(item)
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

function createRpmPacer(minBaseSpacingMs = MIN_LITE_RPM_SPACING_MS) {
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

function mergeIntoAnswerKeyPool(pool, incomingKeys, fallbackSection, fallbackPage) {
  const nextPool = Array.isArray(pool) ? [...pool] : []
  const seen = new Set(
    nextPool.map((k) => `${k.section || ''}|${k.question_number || ''}|${k.page_number || 0}`)
  )
  let added = 0

  for (const rawKey of incomingKeys || []) {
    const qNum = normalizeSourceQuestionNumber(rawKey?.source_question_number ?? rawKey?.question_number)
    if (!qNum) continue

    const section = String(rawKey?.source_section ?? rawKey?.section ?? fallbackSection ?? '').trim()
    const pageNumber = Number(rawKey?.source_page ?? rawKey?.page_number) || fallbackPage || 0
    const answerLabel = String(rawKey?.answer_label ?? rawKey?.answer_choice ?? rawKey?.answer ?? '').trim()
    const rawIdx = rawKey?.answer_index
    let answerIndex = Number.isInteger(Number(rawIdx)) && rawIdx !== '' && rawIdx !== null
      ? Number(rawIdx)
      : null
    if (answerIndex === null && answerLabel) {
      answerIndex = parseAnswerLabelToIndex(answerLabel, 5)
    }
    if (answerIndex === null && !answerLabel) continue

    const dedupKey = `${section}|${qNum}|${pageNumber}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)

    nextPool.push({
      section,
      question_number: qNum,
      answer_label: answerLabel,
      answer_index: answerIndex,
      book_explanation: convertMathAndTableToPlainText(
        String(rawKey?.book_explanation ?? rawKey?.explanation_from_key ?? rawKey?.explanation ?? '').trim()
      ),
      page_number: pageNumber
    })
    added += 1
  }

  return { pool: nextPool, added }
}

function buildPass1ChunkPrompt({ categoryName, fileName, pageEntries, pendingTailText, pendingTailPage, lastSection }) {
  const pageNumbers = pageEntries.map((p) => p.pageNumber)
  const minPage = Math.min(...pageNumbers)
  const maxPage = Math.max(...pageNumbers)

  const headerLines = [
    `Subject Category: "${categoryName || 'ทั่วไป'}"`,
    `Source File: "${fileName}"`,
    `Current Batch Pages: ${minPage} to ${maxPage} (${pageEntries.length} page(s))`,
    `Current Active Section/Set Heading from Previous Pages: "${lastSection || ''}"`,
    '',
    'REMINDER: THIS IS PASS 1 (EXTRACT-ONLY). DO NOT GUESS OR SOLVE ANSWERS THAT ARE NOT PRINTED ON THESE PAGES.',
    'Return ONLY a single JSON object with this exact structure:',
    `{
  "last_detected_section": "ชื่อบทหรือชุดข้อสอบล่าสุดที่พบในรอบนี้ (หากไม่มีใหม่ให้คงค่าเดิม)",
  "questions": [
    {
      "source_question_number": "1",
      "source_section": "ชุดที่ 1 หรือชื่อบท (ถ้าไม่มีใส่ค่าว่าง)",
      "source_page": ${minPage},
      "question_text": "ข้อความโจทย์ตามต้นฉบับ (ตัดเลขข้อหน้าโจทย์แล้ว, สูตรเป็น Unicode Plain Text)",
      "options": ["ตัวเลือก 1 (ตัด ก./A./1. แล้ว)", "ตัวเลือก 2", "ตัวเลือก 3", "ตัวเลือก 4"],
      "has_inline_answer": false,
      "book_answer": null,
      "book_answer_label": "",
      "book_explanation": ""
    }
  ],
  "answer_keys": [
    {
      "source_section": "ชุดที่ 1 หรือชื่อบท (ถ้ามี)",
      "source_question_number": "1",
      "answer_label": "ก",
      "answer_index": 0,
      "book_explanation": "คำอธิบายเฉลยจากหนังสือถ้ามี",
      "source_page": ${minPage}
    }
  ],
  "skipped_items": [
    {
      "source_question_number": "5",
      "source_page": ${minPage},
      "reason": "has_image หรือ non_mcq หรือ invalid_option_count",
      "detail": "อธิบายเหตุผลสั้นๆ"
    }
  ],
  "skipped_pages": [
    {
      "page": ${minPage},
      "reason": "cover หรือ preface หรือ toc หรือ instructions หรือ blank หรือ non_exam_content",
      "detail": "เหตุผลสั้นๆ"
    }
  ],
  "incomplete_tail_text": ""
}`
  ]

  if (pendingTailText) {
    headerLines.push(
      '',
      `[CARRY-OVER FROM PREVIOUS PAGE ${pendingTailPage || minPage - 1} — COMBINE WITH PAGE ${minPage} IF IT CONTINUES THE SAME QUESTION]:`,
      pendingTailText
    )
  }

  const parts = [{ text: headerLines.join('\n') }]

  for (const entry of pageEntries) {
    if (entry.mode === 'text') {
      parts.push({
        text: `\n===== [PAGE ${entry.pageNumber} | MODE: TEXT] =====\n${entry.text}`
      })
    } else if (entry.mode === 'vision' && entry.image?.base64Data) {
      parts.push({
        text: `\n===== [PAGE ${entry.pageNumber} | MODE: SCANNED IMAGE — READ CAREFULLY WITH VISION] =====${
          entry.text ? `\n(Partial OCR hint: ${entry.text.slice(0, 400)})` : ''
        }`
      })
      parts.push({
        inlineData: {
          mimeType: entry.image.mimeType || 'image/jpeg',
          data: entry.image.base64Data
        }
      })
    }
  }

  return parts
}

async function callGeminiWithRetry({
  apiKey,
  model,
  parts,
  systemInstruction,
  temperature = 0.1,
  maxOutputTokens = 8192,
  pacer,
  maxRetries = MAX_RETRY_ATTEMPTS,
  signal,
  onRetryStatus
}) {
  const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`

  let lastError = null
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    if (attempt === 0 && pacer) {
      await pacer.waitBeforeRequest(signal)
    }

    try {
      const response = await fetch(modelUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
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
        const text = (candidate?.content?.parts || [])
          .map((part) => part.text || '')
          .join('')
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
        const backoffMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? retryAfterHeader * 1000
          : Math.min(INITIAL_RETRY_BACKOFF_MS * (2 ** attempt) + Math.floor(Math.random() * 900), 32000)

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
          ? `โควตาโมเดล ${getGeminiModelLabel(model)} (429 Rate Limit / RPD) เต็มชั่วคราว บันทึกความคืบหน้าและ Answer Key Pool ไว้ใน Checkpoint แล้ว`
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

// ============================================================================
// PASS 3: TWO-STAGE HYBRID ENGINE (STAGE 3A SCREENING -> STAGE 3B DEEP ARBITRATION)
// ============================================================================
async function executeTwoStagePass3({
  categoryId,
  fingerprint = null,
  sourceFileName = '',
  totalPages = 1,
  lastCompletedPage = 0,
  answerKeyPool = [],
  initialEscalationQueue = [],
  lastSection = '',
  currentUserId = null,
  stats,
  apiKey,
  modelRoutingMode = 'hybrid', // 'hybrid' | 'lite_only'
  liteModel,
  deepModel,
  litePacer,
  deepPacer,
  signal,
  onProgress,
  onStagingUpdated
}) {
  const pendingItems = await fetchPendingStagingItems(categoryId, fingerprint)

  // Preserve any escalated items carried over from a paused run
  const escalationMap = new Map()
  for (const entry of initialEscalationQueue || []) {
    if (entry?.id) escalationMap.set(entry.id, entry.suspect_note || '')
  }

  const withBookAnswerAll = pendingItems.filter((row) => row.book_answer !== null && row.book_answer !== undefined)
  const withoutBookAnswer = pendingItems.filter((row) => row.book_answer === null || row.book_answer === undefined)

  // Stage 3A only screens items with `book_answer` that were NOT already escalated prior to pause
  const toScreenStage3A = withBookAnswerAll.filter((row) => !escalationMap.has(row.id))

  const totalToProcess = pendingItems.length
  let resolvedCount = 0

  const getEscalationQueueArray = () =>
    [...escalationMap.entries()].map(([id, suspect_note]) => ({ id, suspect_note }))

  const emitPass3Progress = (stageLabel, activeModel, status, message, activePacer) => {
    onProgress?.({
      pass: 3,
      pass3Stage: stageLabel,
      activeModel,
      activeModelLabel: getGeminiModelLabel(activeModel),
      status,
      currentStartPage: lastCompletedPage,
      currentEndPage: totalPages,
      currentMode: 'audit',
      adaptiveDelayMs: activePacer.getCurrentDelayMs(),
      pass3Processed: resolvedCount,
      pass3Total: totalToProcess,
      statusMessage: message,
      stats: { ...stats }
    })
  }

  if (totalToProcess === 0) {
    emitPass3Progress('done', liteModel, 'completed', 'ไม่มีข้อสอบค้างตรวจใน Pass 3 แล้ว (ตรวจและเฉลยครบทุกข้อแล้ว)', litePacer)
    return { resolvedCount: 0, totalToProcess: 0 }
  }

  const persistPass3Checkpoint = async (status) => {
    if (!fingerprint) return
    await saveExtractionCheckpoint({
      category_id: categoryId,
      source_file_fingerprint: fingerprint,
      source_file_name: sourceFileName,
      total_pages: totalPages,
      last_completed_page: lastCompletedPage,
      current_pass: 3,
      last_section: lastSection,
      answer_key_pool: answerKeyPool,
      escalation_queue: getEscalationQueueArray(),
      pass3_processed_count: resolvedCount,
      pass3_total_count: totalToProcess,
      stats,
      status,
      created_by: currentUserId
    })
  }

  const notifyStagingSynced = async () => {
    const exactCount = await fetchCategoryStagingCount(categoryId)
    await onStagingUpdated?.({ exactCount })
  }

  // --------------------------------------------------------------------------
  // STAGE 3A: High-Throughput Screening with Flash Lite (25 items / request)
  // --------------------------------------------------------------------------
  for (let i = 0; i < toScreenStage3A.length; i += STAGE3A_SCREENING_BATCH_SIZE) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const batch = toScreenStage3A.slice(i, i + STAGE3A_SCREENING_BATCH_SIZE)
    const batchStartNum = i + 1
    const batchEndNum = i + batch.length

    emitPass3Progress(
      '3A',
      liteModel,
      'auditing',
      `ขั้น 3A/3 [${getGeminiModelLabel(liteModel)}]: กำลังคัดกรองเฉลยหนังสือและสร้างคำอธิบาย (${batchStartNum}–${batchEndNum} จาก ${toScreenStage3A.length} ข้อ)...`,
      litePacer
    )

    const payloadItems = batch.map((row) => ({
      id: row.id,
      question_text: row.question_text,
      options: row.options,
      book_answer_index: Number(row.book_answer),
      book_answer_text: row.options?.[Number(row.book_answer)] || '',
      book_explanation: row.book_explanation || ''
    }))

    const promptText = `ตรวจสอบคัดกรองเฉลยจากหนังสือจำนวน ${batch.length} ข้อต่อไปนี้ (Stage 3A — ห้ามแก้เฉลยเอง):
- หากเฉลยหนังสือถูกต้องสมเหตุสมผล: ตั้ง verdict = "book_verified" และเขียนคำอธิบายภาษาไทยกระชับ 1–3 ประโยค (Unicode Plain Text ห้ามใช้ LaTeX ดิบ)
- หากสงสัยว่าเฉลยหนังสือผิดชัดเจน/คำนวณผิด/ขัดข้อเท็จจริง: ตั้ง verdict = "escalate_suspect" พร้อมระบุ suspect_note สั้นๆ เพื่อส่งเข้าด่าน Stage 3B ฟันธง

คืนค่า JSON เท่านั้น:
{"results":[{"id":"...","verdict":"book_verified หรือ escalate_suspect","explanation":"...","suspect_note":""}]}

รายการข้อสอบ:
${JSON.stringify(payloadItems)}`

    const geminiRes = await callGeminiWithRetry({
      apiKey,
      model: liteModel,
      parts: [{ text: promptText }],
      systemInstruction: STAGE3A_SCREENING_SYSTEM_INSTRUCTION,
      temperature: 0.1,
      maxOutputTokens: 8192,
      pacer: litePacer,
      signal,
      onRetryStatus: (msg) => emitPass3Progress('3A', liteModel, 'retrying', `ขั้น 3A/3: ${msg}`, litePacer)
    })

    const parsedResults = parsePass3BatchJson(geminiRes.text)
    const resultById = new Map(parsedResults.filter((r) => r?.id).map((r) => [r.id, r]))

    const verifiedUpdates = []
    let batchEscalated = 0

    for (const row of batch) {
      const bookIdx = Number(row.book_answer)
      const aiRes = resultById.get(row.id)
      const verdict = String(aiRes?.verdict || 'book_verified').toLowerCase()

      if (verdict === 'escalate_suspect' || verdict === 'ai_overridden' || verdict === 'suspect') {
        const note = convertMathAndTableToPlainText(
          String(aiRes?.suspect_note ?? aiRes?.override_reason ?? 'Flash Lite สงสัยว่าเฉลยหนังสืออาจคลาดเคลื่อน').trim()
        )
        escalationMap.set(row.id, note)
        batchEscalated += 1
        continue
      }

      let explanation = convertMathAndTableToPlainText(String(aiRes?.explanation ?? '').trim())
      if (!explanation) {
        explanation = row.book_explanation || `เฉลยตามเอกสารคือ "${row.options?.[bookIdx] || ''}"`
      }

      stats.bookVerifiedCount += 1
      verifiedUpdates.push({
        id: row.id,
        correct_option: bookIdx,
        answer_status: 'book_verified',
        explanation,
        override_reason: null,
        verified_by_model: liteModel
      })
    }

    if (verifiedUpdates.length > 0) {
      await savePass3BatchResults(verifiedUpdates)
      resolvedCount += verifiedUpdates.length
    }
    stats.escalatedToDeepCount = escalationMap.size

    await persistPass3Checkpoint('in_progress')
    await notifyStagingSynced()

    emitPass3Progress(
      '3A',
      liteModel,
      'running',
      `ขั้น 3A/3: คัดกรองแล้ว ${batchEndNum}/${toScreenStage3A.length} ข้อ (ตรงหนังสือ ${stats.bookVerifiedCount} · ส่งต่อด่านฟันธง 3B: ${escalationMap.size} ข้อ${batchEscalated > 0 ? ` (+${batchEscalated})` : ''})`,
      litePacer
    )
  }

  // --------------------------------------------------------------------------
  // STAGE 3B: Deep Arbitration (Escalation Queue) + Solve Unanswered (book_answer == null)
  // Batched 20 items / request on Flash Standard (5 RPM / 20 RPD) with Auto-Fallback to Flash Lite!
  // --------------------------------------------------------------------------
  const escalatedRows = withBookAnswerAll.filter((row) => escalationMap.has(row.id))
  const stage3BQueue = [
    ...escalatedRows.map((row) => ({
      task: 'arbitrate_suspect',
      row,
      suspect_note: escalationMap.get(row.id) || ''
    })),
    ...withoutBookAnswer.map((row) => ({
      task: 'solve_unanswered',
      row,
      suspect_note: ''
    }))
  ]

  let activeDeepModel = modelRoutingMode === 'hybrid' ? deepModel : liteModel
  let activeDeepPacer = modelRoutingMode === 'hybrid' ? deepPacer : litePacer
  let usingFallbackLite = modelRoutingMode !== 'hybrid'

  for (let i = 0; i < stage3BQueue.length; i += STAGE3B_DEEP_BATCH_SIZE) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const batchEntries = stage3BQueue.slice(i, i + STAGE3B_DEEP_BATCH_SIZE)
    const batchNum = Math.floor(i / STAGE3B_DEEP_BATCH_SIZE) + 1
    const totalBatches = Math.ceil(stage3BQueue.length / STAGE3B_DEEP_BATCH_SIZE)

    emitPass3Progress(
      '3B',
      activeDeepModel,
      'solving',
      `ขั้น 3B/3 [${getGeminiModelLabel(activeDeepModel)}]: กำลังฟันธงข้อสงสัย (${escalatedRows.length}) และเฉลยข้อที่ไม่มีในหนังสือ (${withoutBookAnswer.length}) · รอบ ${batchNum}/${totalBatches}...`,
      activeDeepPacer
    )

    const payloadItems = batchEntries.map(({ task, row, suspect_note }) => {
      if (task === 'arbitrate_suspect') {
        return {
          id: row.id,
          task: 'arbitrate_suspect',
          question_text: row.question_text,
          options: row.options,
          book_answer_index: Number(row.book_answer),
          book_answer_text: row.options?.[Number(row.book_answer)] || '',
          book_explanation: row.book_explanation || '',
          stage3a_suspect_note: suspect_note
        }
      }
      return {
        id: row.id,
        task: 'solve_unanswered',
        question_text: row.question_text,
        options: row.options
      }
    })

    const promptText = `ดำเนินการตรวจสอบฟันธงและเฉลยข้อสอบจำนวน ${batchEntries.length} ข้อต่อไปนี้ (Stage 3B):
- สำหรับ task="arbitrate_suspect": พิสูจน์อย่างเข้มงวด เลือก "ai_overridden" เฉพาะเมื่อพิสูจน์ได้ชัดเจนว่าเฉลยหนังสือผิดจริง พร้อมระบุ override_reason ครบ 2 ประเด็น (ทำไมเฉลยหนังสือผิด + ทำไมเฉลย AI ถูก) มิฉะนั้นให้คง "book_verified"
- สำหรับ task="solve_unanswered": วิเคราะห์เฉลยคำตอบที่ถูกต้องที่สุด ตั้ง verdict="ai_solved"
- เขียน explanation ภาษาไทยกระชับ 1–3 ประโยค (Unicode Plain Text ห้ามใช้ LaTeX ดิบ) ให้ครบทุกข้อ

คืนค่า JSON เท่านั้น:
{"results":[{"id":"...","verdict":"book_verified หรือ ai_overridden หรือ ai_solved","final_answer_index":0,"explanation":"...","override_reason":""}]}

รายการข้อสอบ:
${JSON.stringify(payloadItems)}`

    let geminiRes
    let modelUsedForBatch = activeDeepModel

    try {
      geminiRes = await callGeminiWithRetry({
        apiKey,
        model: activeDeepModel,
        parts: [{ text: promptText }],
        systemInstruction: STAGE3B_DEEP_SYSTEM_INSTRUCTION,
        temperature: 0.1,
        maxOutputTokens: 8192,
        pacer: activeDeepPacer,
        // For Flash Standard in Hybrid mode, cap retries at 1 before auto-fallback to Flash Lite
        maxRetries: !usingFallbackLite ? 1 : MAX_RETRY_ATTEMPTS,
        signal,
        onRetryStatus: (msg) => emitPass3Progress('3B', activeDeepModel, 'retrying', `ขั้น 3B/3: ${msg}`, activeDeepPacer)
      })
    } catch (deepErr) {
      if (isAbortError(deepErr)) throw deepErr

      // Auto-Fallback: If Flash Standard hits 429 / RPD / unavailable, seamlessly fall back to Flash Lite!
      if (!usingFallbackLite && (deepErr.isQuotaOrRateLimit || deepErr.httpStatus === 429 || deepErr.httpStatus === 404 || deepErr.httpStatus === 503)) {
        usingFallbackLite = true
        const failedLabel = getGeminiModelLabel(activeDeepModel)
        const liteLabel = getGeminiModelLabel(liteModel)
        activeDeepModel = liteModel
        activeDeepPacer = litePacer
        modelUsedForBatch = liteModel

        stats.fallbackTriggered = true
        stats.fallbackNotice = `โมเดล ${failedLabel} ชนลิมิต RPD/429 — สลับมาใช้ ${liteLabel} อัตโนมัติเพื่อให้การฟันธงดำเนินต่อไม่สะดุด`

        emitPass3Progress(
          '3B',
          activeDeepModel,
          'retrying',
          `⚠️ ${stats.fallbackNotice}`,
          activeDeepPacer
        )

        geminiRes = await callGeminiWithRetry({
          apiKey,
          model: activeDeepModel,
          parts: [{ text: promptText }],
          systemInstruction: STAGE3B_DEEP_SYSTEM_INSTRUCTION,
          temperature: 0.1,
          maxOutputTokens: 8192,
          pacer: activeDeepPacer,
          maxRetries: MAX_RETRY_ATTEMPTS,
          signal,
          onRetryStatus: (msg) => emitPass3Progress('3B', activeDeepModel, 'retrying', `ขั้น 3B/3 (Fallback): ${msg}`, activeDeepPacer)
        })
      } else {
        throw deepErr
      }
    }

    stats.stage3BRequestsUsed += 1
    const parsedResults = parsePass3BatchJson(geminiRes.text)
    const resultById = new Map(parsedResults.filter((r) => r?.id).map((r) => [r.id, r]))

    const batchUpdates = batchEntries.map(({ task, row }) => {
      const optionCount = Array.isArray(row.options) ? row.options.length : 0
      const aiRes = resultById.get(row.id)
      let explanation = convertMathAndTableToPlainText(String(aiRes?.explanation ?? '').trim())

      if (task === 'arbitrate_suspect') {
        const bookIdx = Number(row.book_answer)
        const verdict = String(aiRes?.verdict || 'book_verified').toLowerCase()
        const finalIdx = Number(aiRes?.final_answer_index ?? aiRes?.correct_option)
        const rawOverrideReason = convertMathAndTableToPlainText(String(aiRes?.override_reason ?? '').trim())
        const validFinalIdx = Number.isInteger(finalIdx) && finalIdx >= 0 && finalIdx < optionCount

        // Remove from escalation queue once adjudicated
        escalationMap.delete(row.id)

        if (verdict === 'ai_overridden' && validFinalIdx && finalIdx !== bookIdx && rawOverrideReason.length >= 10) {
          if (!explanation) explanation = `คำตอบที่ถูกต้องคือ "${row.options[finalIdx]}"`
          stats.aiOverriddenCount += 1
          return {
            id: row.id,
            correct_option: finalIdx,
            answer_status: 'ai_overridden',
            explanation,
            override_reason: rawOverrideReason,
            verified_by_model: modelUsedForBatch
          }
        }

        if (!explanation) {
          explanation = row.book_explanation || `เฉลยตามเอกสารคือ "${row.options?.[bookIdx] || ''}"`
        }
        stats.bookVerifiedCount += 1
        return {
          id: row.id,
          correct_option: bookIdx,
          answer_status: 'book_verified',
          explanation,
          override_reason: null,
          verified_by_model: modelUsedForBatch
        }
      }

      // task === 'solve_unanswered'
      let solvedIdx = Number(aiRes?.final_answer_index ?? aiRes?.correct_option)
      if (!Number.isInteger(solvedIdx) || solvedIdx < 0 || solvedIdx >= optionCount) {
        solvedIdx = parseAnswerLabelToIndex(aiRes?.answer_label ?? aiRes?.correct_option, optionCount, row.options) ?? 0
      }
      if (!explanation) {
        explanation = `AI วิเคราะห์ว่าคำตอบที่ถูกต้องคือ "${row.options?.[solvedIdx] || ''}"`
      }
      stats.aiSolvedCount += 1
      return {
        id: row.id,
        correct_option: solvedIdx,
        answer_status: 'ai_solved',
        explanation,
        override_reason: null,
        verified_by_model: modelUsedForBatch
      }
    })

    await savePass3BatchResults(batchUpdates)
    resolvedCount += batchEntries.length
    await persistPass3Checkpoint(resolvedCount >= totalToProcess ? 'completed' : 'in_progress')
    await notifyStagingSynced()

    emitPass3Progress(
      '3B',
      activeDeepModel,
      'running',
      `ขั้น 3B/3 [${getGeminiModelLabel(modelUsedForBatch)}]: บันทึกผลแล้ว ${resolvedCount}/${totalToProcess} ข้อ (ตรงหนังสือ ${stats.bookVerifiedCount} · AI แก้เฉลย ${stats.aiOverriddenCount} · AI เฉลย ${stats.aiSolvedCount})`,
      activeDeepPacer
    )
  }

  return { resolvedCount, totalToProcess }
}

/**
 * Inspect uploaded file(s) quickly before extraction starts.
 */
export async function inspectExtractionFiles(files, categoryId) {
  validateExtractorFiles(files)

  const fingerprint = await computeFileFingerprint(files)
  const isPdf = files.length === 1 && isPdfFile(files[0])
  const sourceFileName = isPdf
    ? files[0].name
    : files.length === 1
      ? files[0].name
      : `${files[0].name} (+${files.length - 1} รูป)`

  let totalPages = files.length
  let dominantMode = 'vision'
  let recommended = recommendBatchConfig(files.length, 'vision')

  if (isPdf) {
    const doc = await openLazyPdfDocument(files[0])
    try {
      const profile = await doc.sampleDocumentProfile()
      totalPages = profile.numPages
      dominantMode = profile.dominantMode
      recommended = profile.recommended
    } finally {
      await doc.destroy()
    }
  }

  const checkpoint = categoryId
    ? await loadExtractionCheckpoint(categoryId, fingerprint)
    : null

  return {
    fingerprint,
    sourceFileName,
    isPdf,
    totalPages,
    dominantMode,
    recommended,
    checkpoint
  }
}

/**
 * Full 3-Pass Deferred Answer + Two-Stage Hybrid Model Pipeline:
 * - Pass 1 (Flash Lite): Extract-Only + full-file Answer Key Pool + Checkpoint every chunk
 * - Pass 2 (Local + DB): Full-file Multi-Set Answer Key Matching -> `book_answer`
 * - Pass 3A (Flash Lite 25/batch): Screen `book_answer` -> `book_verified` OR escalate to 3B
 * - Pass 3B (Flash Standard 20/batch + Auto-Fallback): Arbitrate suspects (`book_verified` | `ai_overridden`) & solve unanswered (`ai_solved`)
 */
export async function runVerbatimExamExtraction({
  files,
  categoryId,
  categoryName,
  currentUserId,
  pagesPerBatchOverride = null,
  startPage = null,
  endPage = null,
  modelRoutingMode = 'hybrid', // 'hybrid' | 'lite_only'
  deepModelOverride = '',
  resumeFromCheckpoint = true,
  signal,
  onProgress,
  onStagingUpdated
}) {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error('ยังไม่ได้ตั้งค่า Gemini API Key กรุณาไปตั้งค่าในเมนูผู้ดูแลก่อน')
  }

  const { liteModel, deepModel } = resolveHybridModelPair(deepModelOverride)

  validateExtractorFiles(files)
  if (!categoryId) throw new Error('กรุณาเลือกหมวดหมู่วิชาก่อนเริ่มสกัดข้อสอบ')

  const fingerprint = await computeFileFingerprint(files)
  const isPdf = files.length === 1 && isPdfFile(files[0])
  const sourceFileName = isPdf
    ? files[0].name
    : files.length === 1
      ? files[0].name
      : `${files[0].name} (+${files.length - 1} รูป)`

  let lazyPdf = null
  let stats = createEmptyStats()
  let lastCompletedPage = 0
  let pendingTailText = ''
  let pendingTailPage = null
  let lastSection = ''
  let answerKeyPool = []
  let escalationQueue = []
  let currentPass = 1

  const litePacer = createRpmPacer(MIN_LITE_RPM_SPACING_MS)
  const deepPacer = createRpmPacer(MIN_DEEP_RPM_SPACING_MS)

  const emitProgress = (extra = {}) => {
    const activeModel = extra.activeModel || liteModel
    onProgress?.({
      pass: currentPass,
      pass3Stage: '',
      activeModel,
      activeModelLabel: getGeminiModelLabel(activeModel),
      status: 'running',
      currentStartPage: 0,
      currentEndPage: 0,
      currentMode: 'text',
      statusMessage: '',
      adaptiveDelayMs: litePacer.getCurrentDelayMs(),
      resumedFromPage: 0,
      pass3Processed: 0,
      pass3Total: 0,
      ...extra,
      stats: { ...stats }
    })
  }

  try {
    emitProgress({
      pass: 1,
      activeModel: liteModel,
      status: 'initializing',
      statusMessage: `ขั้น 1/3 [${getGeminiModelLabel(liteModel)}]: กำลังวิเคราะห์เอกสารและโหลดรายการข้อสอบเดิมในหมวดหมู่เพื่อตรวจซ้ำ...`
    })

    let totalPages = files.length
    let dominantMode = 'vision'
    let recommended = recommendBatchConfig(files.length, 'vision')

    if (isPdf) {
      lazyPdf = await openLazyPdfDocument(files[0])
      const profile = await lazyPdf.sampleDocumentProfile()
      totalPages = profile.numPages
      dominantMode = profile.dominantMode
      recommended = profile.recommended
    }

    const existingExactSet = await fetchCategoryExactQuestionSet(categoryId, { includeStaging: true })

    const clampedStart = Number.isInteger(Number(startPage)) && Number(startPage) >= 1
      ? Math.min(Number(startPage), totalPages)
      : 1
    const clampedEnd = Number.isInteger(Number(endPage)) && Number(endPage) >= clampedStart
      ? Math.min(Number(endPage), totalPages)
      : totalPages

    let effectiveStart = clampedStart
    let resumedFromPage = 0

    if (resumeFromCheckpoint) {
      const existingCheckpoint = await loadExtractionCheckpoint(categoryId, fingerprint)
      if (existingCheckpoint) {
        stats = mergeStats(existingCheckpoint.stats)
        lastCompletedPage = Number(existingCheckpoint.last_completed_page || 0)
        pendingTailText = existingCheckpoint.pending_tail_text || ''
        pendingTailPage = existingCheckpoint.pending_tail_page || null
        lastSection = existingCheckpoint.last_section || ''
        answerKeyPool = Array.isArray(existingCheckpoint.answer_key_pool) ? [...existingCheckpoint.answer_key_pool] : []
        escalationQueue = Array.isArray(existingCheckpoint.escalation_queue) ? [...existingCheckpoint.escalation_queue] : []
        currentPass = Number(existingCheckpoint.current_pass || 1)
        if (lastCompletedPage >= clampedStart) {
          resumedFromPage = lastCompletedPage
          effectiveStart = Math.max(clampedStart, lastCompletedPage + 1)
        }
      }
    } else {
      await clearExtractionCheckpoint(categoryId, fingerprint)
    }

    stats.totalPages = totalPages
    stats.answerKeysCollected = answerKeyPool.length

    // ========================================================================
    // PASS 1: EXTRACT-ONLY & COLLECT FULL-FILE ANSWER KEY POOL (FLASH LITE)
    // ========================================================================
    if (effectiveStart <= clampedEnd) {
      currentPass = 1
      const manualPages = Number(pagesPerBatchOverride)
      const hasManualOverride = Number.isInteger(manualPages) && manualPages >= 1 && manualPages <= 30
      let targetPagesPerBatch = hasManualOverride ? manualPages : recommended.pagesPerBatch
      const maxVisionPerBatch = hasManualOverride
        ? Math.min(manualPages, 5)
        : recommended.maxVisionPagesPerBatch

      let cursorPage = effectiveStart

      while (cursorPage <= clampedEnd) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

        const chunkPages = []
        const chunkStartPage = cursorPage
        let chunkEndPage = cursorPage
        let chunkTextChars = 0
        let chunkVisionCount = 0
        let chunkTextCount = 0

        while (cursorPage <= clampedEnd && chunkPages.length < targetPagesPerBatch) {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

          const pageNumber = cursorPage
          emitProgress({
            pass: 1,
            activeModel: liteModel,
            status: 'reading',
            currentStartPage: chunkStartPage,
            currentEndPage: pageNumber,
            currentMode: chunkVisionCount > 0 && chunkTextCount > 0 ? 'mixed' : chunkVisionCount > 0 ? 'vision' : dominantMode,
            resumedFromPage,
            statusMessage: `ขั้น 1/3: กำลังอ่านหน้า ${pageNumber} จากทั้งหมด ${totalPages} หน้า (${isPdf ? 'Lazy Hybrid PDF' : 'Image Vision'})...`
          })

          let pageData
          if (isPdf) {
            pageData = await lazyPdf.readPage(pageNumber)
          } else {
            const file = files[pageNumber - 1]
            const image = await readImageFileAsInlineData(file)
            pageData = {
              pageNumber,
              mode: 'vision',
              skipReason: null,
              skipDetail: '',
              text: '',
              image
            }
          }

          cursorPage += 1
          chunkEndPage = pageNumber
          stats.processedPages = Math.max(stats.processedPages, pageNumber)

          if (pageData.mode === 'skipped') {
            stats.skippedFrontMatterPages += 1
            pushBounded(stats.skippedPagesLog, {
              page: pageNumber,
              reason: pageData.skipReason || 'front_matter',
              detail: pageData.skipDetail || 'ข้ามหน้าอัตโนมัติ'
            })
            if (chunkPages.length === 0) {
              lastCompletedPage = Math.max(lastCompletedPage, pageNumber)
            }
            continue
          }

          if (pageData.mode === 'text') {
            chunkTextCount += 1
            chunkTextChars += pageData.text.length
          } else {
            chunkVisionCount += 1
          }

          chunkPages.push(pageData)

          if (chunkVisionCount >= maxVisionPerBatch) break
          if (chunkTextChars >= MAX_TEXT_CHARS_PER_BATCH) break
        }

        if (chunkPages.length === 0) {
          await saveExtractionCheckpoint({
            category_id: categoryId,
            source_file_fingerprint: fingerprint,
            source_file_name: sourceFileName,
            total_pages: totalPages,
            last_completed_page: Math.max(lastCompletedPage, chunkEndPage),
            pending_tail_text: pendingTailText,
            pending_tail_page: pendingTailPage,
            current_pass: cursorPage > clampedEnd ? 2 : 1,
            last_section: lastSection,
            answer_key_pool: answerKeyPool,
            escalation_queue: escalationQueue,
            stats,
            status: 'in_progress',
            created_by: currentUserId
          })
          continue
        }

        const batchMode = chunkVisionCount > 0 && chunkTextCount > 0
          ? 'mixed'
          : chunkVisionCount > 0
            ? 'vision'
            : 'text'

        emitProgress({
          pass: 1,
          activeModel: liteModel,
          status: 'extracting',
          currentStartPage: chunkPages[0].pageNumber,
          currentEndPage: chunkPages[chunkPages.length - 1].pageNumber,
          currentMode: batchMode,
          resumedFromPage,
          statusMessage: `ขั้น 1/3 [${getGeminiModelLabel(liteModel)}]: สกัดโจทย์และเก็บเฉลยหน้า ${chunkPages[0].pageNumber}–${chunkPages[chunkPages.length - 1].pageNumber} จาก ${totalPages} หน้า...`
        })

        const promptParts = buildPass1ChunkPrompt({
          categoryName,
          fileName: sourceFileName,
          pageEntries: chunkPages,
          pendingTailText,
          pendingTailPage,
          lastSection
        })

        const geminiResult = await callGeminiWithRetry({
          apiKey,
          model: liteModel,
          parts: promptParts,
          systemInstruction: PASS1_SYSTEM_INSTRUCTION,
          temperature: 0.1,
          maxOutputTokens: 8192,
          pacer: litePacer,
          signal,
          onRetryStatus: (retryMessage) => {
            emitProgress({
              pass: 1,
              activeModel: liteModel,
              status: 'retrying',
              currentStartPage: chunkPages[0].pageNumber,
              currentEndPage: chunkPages[chunkPages.length - 1].pageNumber,
              currentMode: batchMode,
              resumedFromPage,
              statusMessage: `ขั้น 1/3: ${retryMessage}`
            })
          }
        })

        for (const p of chunkPages) {
          p.image = null
        }

        const parsed = parsePartialExtractionJson(geminiResult.text)
        if (parsed.last_detected_section) {
          lastSection = parsed.last_detected_section
        }

        if (parsed.partialRecovered || geminiResult.finishReason === 'MAX_TOKENS') {
          stats.partialRecoveries += 1
          if (!hasManualOverride && targetPagesPerBatch > 2) {
            targetPagesPerBatch = Math.max(2, Math.floor(targetPagesPerBatch * 0.7))
          }
        }

        for (const skippedPage of parsed.skipped_pages) {
          const pNum = Number(skippedPage?.page)
          if (Number.isInteger(pNum) && pNum > 0) {
            const alreadyLogged = stats.skippedPagesLog.some((item) => item.page === pNum)
            if (!alreadyLogged) {
              stats.skippedFrontMatterPages += 1
              pushBounded(stats.skippedPagesLog, {
                page: pNum,
                reason: skippedPage.reason || 'non_exam_content',
                detail: skippedPage.detail || 'ข้ามหน้าที่ไม่ใช่ข้อสอบ/เฉลย'
              })
            }
          }
        }

        for (const skippedItem of parsed.skipped_items) {
          const reason = String(skippedItem?.reason || 'non_mcq')
          if (reason === 'has_image') stats.skippedImageQuestions += 1
          else stats.skippedNonMcqQuestions += 1
          pushBounded(stats.skippedItemsLog, {
            source_question_number: String(skippedItem?.source_question_number || '-'),
            source_page: Number(skippedItem?.source_page) || chunkPages[0].pageNumber,
            reason,
            detail: String(skippedItem?.detail || (reason === 'has_image' ? 'มีรูปภาพประกอบ' : 'ไม่ใช่ปรนัย 4–5 ตัวเลือก'))
          })
        }

        if (parsed.answer_keys.length > 0) {
          const merged = mergeIntoAnswerKeyPool(
            answerKeyPool,
            parsed.answer_keys,
            lastSection,
            chunkPages[0].pageNumber
          )
          answerKeyPool = merged.pool
          stats.answerKeysCollected = answerKeyPool.length
        }

        const rowsToInsert = []
        for (const rawQuestion of parsed.questions) {
          const validation = validateAndFormatPass1Question(rawQuestion)
          if (!validation.valid) {
            if (validation.reason === 'has_image') {
              stats.skippedImageQuestions += 1
              pushBounded(stats.skippedItemsLog, {
                source_question_number: String(rawQuestion?.source_question_number || '-'),
                source_page: Number(rawQuestion?.source_page) || chunkPages[0].pageNumber,
                reason: 'has_image',
                detail: 'มีรูปภาพประกอบในโจทย์หรือตัวเลือก'
              })
            } else {
              stats.skippedNonMcqQuestions += 1
              pushBounded(stats.skippedItemsLog, {
                source_question_number: String(rawQuestion?.source_question_number || '-'),
                source_page: Number(rawQuestion?.source_page) || chunkPages[0].pageNumber,
                reason: 'invalid_option_count',
                detail: 'รูปแบบตัวเลือกไม่ใช่ปรนัย 4–5 ตัวเลือกที่สมบูรณ์'
              })
            }
            continue
          }

          stats.extractedTotal += 1
          const formatted = validation.question
          const strictKey = normalizeForStrictExactMatch(formatted.question_text)

          if (existingExactSet.has(strictKey)) {
            stats.duplicateExactMatch += 1
            pushBounded(stats.duplicateItemsLog, {
              source_question_number: formatted.source_question_number || '-',
              source_page: formatted.source_page || chunkPages[0].pageNumber,
              question_preview: formatted.question_text.slice(0, 120)
            })
            continue
          }

          existingExactSet.add(strictKey)
          if (formatted.book_answer !== null) {
            stats.inlineBookAnswersCount += 1
          }

          rowsToInsert.push({
            category_id: categoryId,
            question_text: formatted.question_text,
            options: formatted.options,
            correct_option: formatted.correct_option,
            book_answer: formatted.book_answer,
            book_explanation: formatted.book_explanation,
            explanation: formatted.explanation,
            override_reason: null,
            verified_by_model: null,
            answer_status: 'pending_answer',
            is_options_randomized: true,
            image_url: null,
            explanation_image_url: null,
            source_file_fingerprint: fingerprint,
            source_file_name: sourceFileName,
            source_question_number: formatted.source_question_number,
            source_section: formatted.source_section || lastSection || null,
            source_page: formatted.source_page || chunkPages[0].pageNumber,
            has_source_answer: formatted.has_source_answer,
            is_ai_solved: false,
            created_by: currentUserId || null
          })
        }

        // Incremental Staging Save + Authoritative Real-Time Exact DB Count Sync!
        if (rowsToInsert.length > 0) {
          const insertedRows = await insertStagingItems(rowsToInsert)
          stats.savedToStaging += insertedRows.length
          const exactCount = await fetchCategoryStagingCount(categoryId)
          await onStagingUpdated?.({ insertedRows, exactCount })
        }

        // Handle MAX_TOKENS partial recovery cursor rewind
        let effectiveCompletedPage = chunkEndPage
        if ((parsed.partialRecovered || geminiResult.finishReason === 'MAX_TOKENS') && chunkPages.length > 1) {
          const recoveredPages = [
            ...parsed.questions.map((q) => Number(q?.source_page)).filter((p) => Number.isInteger(p) && p >= chunkPages[0].pageNumber && p <= chunkEndPage),
            ...parsed.answer_keys.map((k) => Number(k?.source_page)).filter((p) => Number.isInteger(p) && p >= chunkPages[0].pageNumber && p <= chunkEndPage)
          ]
          if (recoveredPages.length > 0) {
            const maxRecoveredPage = Math.max(...recoveredPages)
            if (maxRecoveredPage < chunkEndPage) {
              effectiveCompletedPage = Math.max(chunkPages[0].pageNumber, maxRecoveredPage - 1)
              cursorPage = effectiveCompletedPage + 1
            }
          } else if (targetPagesPerBatch > 1) {
            effectiveCompletedPage = chunkPages[0].pageNumber - 1
            cursorPage = chunkPages[0].pageNumber
            targetPagesPerBatch = Math.max(1, Math.floor(targetPagesPerBatch / 2))
          }
        }

        lastCompletedPage = Math.max(lastCompletedPage, effectiveCompletedPage)
        pendingTailText = parsed.incomplete_tail_text || ''
        pendingTailPage = pendingTailText ? lastCompletedPage : null

        const pass1Done = cursorPage > clampedEnd
        await saveExtractionCheckpoint({
          category_id: categoryId,
          source_file_fingerprint: fingerprint,
          source_file_name: sourceFileName,
          total_pages: totalPages,
          last_completed_page: lastCompletedPage,
          pending_tail_text: pass1Done ? null : pendingTailText,
          pending_tail_page: pass1Done ? null : pendingTailPage,
          current_pass: pass1Done ? 2 : 1,
          last_section: lastSection,
          answer_key_pool: answerKeyPool,
          escalation_queue: escalationQueue,
          stats,
          status: 'in_progress',
          created_by: currentUserId
        })

        emitProgress({
          pass: 1,
          activeModel: liteModel,
          status: 'running',
          currentStartPage: chunkPages[0].pageNumber,
          currentEndPage: lastCompletedPage,
          currentMode: batchMode,
          resumedFromPage,
          statusMessage: pass1Done
            ? `ขั้น 1/3 เสร็จสมบูรณ์! สกัดเข้า Staging ${stats.savedToStaging} ข้อ · รวบรวมเฉลยจากหนังสือได้ ${answerKeyPool.length} ข้อ`
            : `ขั้น 1/3: บันทึกหน้า ${chunkPages[0].pageNumber}–${lastCompletedPage} แล้ว (${stats.savedToStaging} ข้อ · เฉลยสะสม ${answerKeyPool.length} ข้อ)`
        })
      }
    }

    if (lazyPdf) {
      await lazyPdf.destroy()
      lazyPdf = null
    }

    // ========================================================================
    // PASS 2: FULL-FILE ANSWER KEY MATCHING
    // ========================================================================
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    currentPass = 2

    emitProgress({
      pass: 2,
      activeModel: liteModel,
      status: 'matching',
      currentStartPage: lastCompletedPage,
      currentEndPage: totalPages,
      currentMode: 'match',
      statusMessage: `ขั้น 2/3: กำลังจับคู่เฉลยจากหนังสือทั้งไฟล์ (${answerKeyPool.length} รายการ) กับข้อสอบใน Staging...`
    })

    const pass2Result = await applyPass2AnswerKeyMatches({
      categoryId,
      fingerprint,
      answerKeyPool
    })

    stats.answerKeysMatchedPass2 += pass2Result.matchedFromKeyPool
    stats.unmatchedForAiSolve = pass2Result.unmatchedForAiSolve

    await saveExtractionCheckpoint({
      category_id: categoryId,
      source_file_fingerprint: fingerprint,
      source_file_name: sourceFileName,
      total_pages: totalPages,
      last_completed_page: lastCompletedPage,
      pending_tail_text: null,
      pending_tail_page: null,
      current_pass: 3,
      last_section: lastSection,
      answer_key_pool: answerKeyPool,
      escalation_queue: escalationQueue,
      stats,
      status: 'in_progress',
      created_by: currentUserId
    })

    const countAfterPass2 = await fetchCategoryStagingCount(categoryId)
    await onStagingUpdated?.({ exactCount: countAfterPass2 })

    emitProgress({
      pass: 2,
      activeModel: liteModel,
      status: 'running',
      currentStartPage: lastCompletedPage,
      currentEndPage: totalPages,
      currentMode: 'match',
      statusMessage: `ขั้น 2/3 เสร็จสิ้น: จับคู่เฉลยจากหนังสือได้ ${pass2Result.matchedFromKeyPool} ข้อ (ติดข้อเดิม ${pass2Result.alreadyHadInlineBookAnswer} · ไม่มีในหนังสือ ${pass2Result.unmatchedForAiSolve} ข้อ)`
    })

    // ========================================================================
    // PASS 3: TWO-STAGE HYBRID VERIFICATION (3A FLASH LITE -> 3B FLASH STANDARD)
    // ========================================================================
    currentPass = 3
    await executeTwoStagePass3({
      categoryId,
      fingerprint,
      sourceFileName,
      totalPages,
      lastCompletedPage,
      answerKeyPool,
      initialEscalationQueue: escalationQueue,
      lastSection,
      currentUserId,
      stats,
      apiKey,
      modelRoutingMode,
      liteModel,
      deepModel,
      litePacer,
      deepPacer,
      signal,
      onProgress,
      onStagingUpdated
    })

    await saveExtractionCheckpoint({
      category_id: categoryId,
      source_file_fingerprint: fingerprint,
      source_file_name: sourceFileName,
      total_pages: totalPages,
      last_completed_page: lastCompletedPage,
      pending_tail_text: null,
      pending_tail_page: null,
      current_pass: 3,
      last_section: lastSection,
      answer_key_pool: answerKeyPool,
      escalation_queue: [],
      stats,
      status: 'completed',
      created_by: currentUserId
    })

    emitProgress({
      pass: 3,
      pass3Stage: 'done',
      activeModel: modelRoutingMode === 'hybrid' && !stats.fallbackTriggered ? deepModel : liteModel,
      status: 'completed',
      currentStartPage: totalPages,
      currentEndPage: totalPages,
      currentMode: 'audit',
      statusMessage: `เสร็จสมบูรณ์ทั้ง 3 ขั้นตอน! ตรงหนังสือ ${stats.bookVerifiedCount} · AI แก้เฉลย ${stats.aiOverriddenCount} · AI เฉลย ${stats.aiSolvedCount} ข้อ`
    })

    return {
      completed: true,
      paused: false,
      fingerprint,
      stats
    }
  } catch (error) {
    const pausedByUser = isAbortError(error)
    await saveExtractionCheckpoint({
      category_id: categoryId,
      source_file_fingerprint: fingerprint,
      source_file_name: sourceFileName,
      total_pages: stats.totalPages || files.length,
      last_completed_page: lastCompletedPage,
      pending_tail_text: currentPass === 1 ? pendingTailText : null,
      pending_tail_page: currentPass === 1 ? pendingTailPage : null,
      current_pass: currentPass,
      last_section: lastSection,
      answer_key_pool: answerKeyPool,
      escalation_queue: escalationQueue,
      stats,
      status: pausedByUser ? 'paused' : 'error',
      created_by: currentUserId
    })

    if (pausedByUser) {
      emitProgress({
        pass: currentPass,
        activeModel: liteModel,
        status: 'paused',
        currentStartPage: lastCompletedPage,
        currentEndPage: lastCompletedPage,
        statusMessage: currentPass === 1
          ? `หยุดพักขั้น 1/3 ที่หน้า ${lastCompletedPage}/${stats.totalPages} แล้ว (บันทึกข้อสอบใน Staging และเฉลยสะสม ${answerKeyPool.length} ข้อไว้ครบถ้วน)`
          : `หยุดพักขั้น ${currentPass}/3 แล้ว (บันทึกผลที่ตรวจไปแล้วและคิวฟันธงลง Checkpoint เรียบร้อย กดทำต่อได้ทุกเมื่อ)`
      })
      return {
        completed: false,
        paused: true,
        fingerprint,
        lastCompletedPage,
        currentPass,
        stats
      }
    }

    emitProgress({
      pass: currentPass,
      activeModel: liteModel,
      status: 'error',
      currentStartPage: lastCompletedPage,
      currentEndPage: lastCompletedPage,
      statusMessage: error.message
    })
    throw error
  } finally {
    if (lazyPdf) {
      await lazyPdf.destroy()
    }
  }
}

/**
 * Standalone Runner for Pass 2 + Two-Stage Hybrid Pass 3 on existing `pending_answer` items in Staging.
 */
export async function runDeferredAnswerPipeline({
  categoryId,
  fingerprint = null,
  currentUserId = null,
  modelRoutingMode = 'hybrid',
  deepModelOverride = '',
  signal,
  onProgress,
  onStagingUpdated
}) {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error('ยังไม่ได้ตั้งค่า Gemini API Key กรุณาไปตั้งค่าในเมนูผู้ดูแลก่อน')
  }
  if (!categoryId) throw new Error('กรุณาเลือกหมวดหมู่วิชาก่อนดำเนินการ')

  const { liteModel, deepModel } = resolveHybridModelPair(deepModelOverride)
  const litePacer = createRpmPacer(MIN_LITE_RPM_SPACING_MS)
  const deepPacer = createRpmPacer(MIN_DEEP_RPM_SPACING_MS)
  const stats = createEmptyStats()

  try {
    onProgress?.({
      pass: 2,
      activeModel: liteModel,
      activeModelLabel: getGeminiModelLabel(liteModel),
      status: 'matching',
      currentMode: 'match',
      adaptiveDelayMs: litePacer.getCurrentDelayMs(),
      statusMessage: 'ขั้น 2/3: กำลังโหลด Answer Key Pool และจับคู่เฉลยจากหนังสือให้ข้อที่ยังรอจับคู่...',
      stats: { ...stats }
    })

    const checkpoints = fingerprint
      ? [await loadExtractionCheckpoint(categoryId, fingerprint)].filter(Boolean)
      : await loadCategoryCheckpoints(categoryId)

    const mergedEscalationQueue = []
    for (const cp of checkpoints) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      if (Array.isArray(cp.escalation_queue)) {
        mergedEscalationQueue.push(...cp.escalation_queue)
      }
      const pool = Array.isArray(cp.answer_key_pool) ? cp.answer_key_pool : []
      if (pool.length === 0) continue

      const matchRes = await applyPass2AnswerKeyMatches({
        categoryId,
        fingerprint: cp.source_file_fingerprint,
        answerKeyPool: pool
      })
      stats.answerKeysMatchedPass2 += matchRes.matchedFromKeyPool
      stats.answerKeysCollected += pool.length
    }

    const exactCountAfterPass2 = await fetchCategoryStagingCount(categoryId)
    await onStagingUpdated?.({ exactCount: exactCountAfterPass2 })

    const pass3Result = await executeTwoStagePass3({
      categoryId,
      fingerprint,
      sourceFileName: checkpoints[0]?.source_file_name || '',
      totalPages: checkpoints[0]?.total_pages || 1,
      lastCompletedPage: checkpoints[0]?.last_completed_page || 0,
      answerKeyPool: checkpoints[0]?.answer_key_pool || [],
      initialEscalationQueue: mergedEscalationQueue,
      lastSection: checkpoints[0]?.last_section || '',
      currentUserId,
      stats,
      apiKey,
      modelRoutingMode,
      liteModel,
      deepModel,
      litePacer,
      deepPacer,
      signal,
      onProgress,
      onStagingUpdated
    })

    onProgress?.({
      pass: 3,
      pass3Stage: 'done',
      activeModel: modelRoutingMode === 'hybrid' && !stats.fallbackTriggered ? deepModel : liteModel,
      activeModelLabel: getGeminiModelLabel(modelRoutingMode === 'hybrid' && !stats.fallbackTriggered ? deepModel : liteModel),
      status: 'completed',
      currentMode: 'audit',
      adaptiveDelayMs: litePacer.getCurrentDelayMs(),
      pass3Processed: pass3Result.resolvedCount,
      pass3Total: pass3Result.totalToProcess,
      statusMessage: `ดำเนินการ Pass 2–3 เสร็จสมบูรณ์! ตรงหนังสือ ${stats.bookVerifiedCount} · AI แก้เฉลย ${stats.aiOverriddenCount} · AI เฉลย ${stats.aiSolvedCount} ข้อ`,
      stats: { ...stats }
    })

    return { completed: true, paused: false, stats }
  } catch (error) {
    if (isAbortError(error)) {
      onProgress?.({
        pass: 3,
        activeModel: liteModel,
        activeModelLabel: getGeminiModelLabel(liteModel),
        status: 'paused',
        currentMode: 'audit',
        statusMessage: 'หยุดพัก Pass 3 ชั่วคราวแล้ว (ข้อที่ตรวจไปแล้วและคิวฟันธงถูกบันทึกเรียบร้อย)',
        stats: { ...stats }
      })
      return { completed: false, paused: true, stats }
    }
    throw error
  }
}
