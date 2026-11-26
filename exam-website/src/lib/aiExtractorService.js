import { getGeminiApiKey } from './geminiApiKey'
import { DEFAULT_GEMINI_MODEL, getGeminiModel } from './geminiModels'
import {
  computeFileFingerprint,
  isPdfFile,
  openLazyPdfDocument,
  readImageFileAsInlineData,
  recommendBatchConfig,
  validateExtractorFiles
} from './pdfExtractor'
import {
  normalizeForStrictExactMatch,
  parsePartialExtractionJson,
  validateAndFormatExtractedQuestion
} from './examTextUtils'
import {
  applyAnswerKeysToStagingItems,
  clearExtractionCheckpoint,
  fetchCategoryExactQuestionSet,
  insertStagingItems,
  loadExtractionCheckpoint,
  saveExtractionCheckpoint
} from './stagingQuestionService'

const MAX_TEXT_CHARS_PER_BATCH = 26000
const MAX_RETRY_ATTEMPTS = 4
const INITIAL_RETRY_BACKOFF_MS = 3500
const MAX_ADAPTIVE_DELAY_MS = 16000
const MAX_DETAIL_LOG_ITEMS = 400

const SYSTEM_INSTRUCTION = `You are a precision Verbatim Exam Extraction Engine for Thai and English multiple-choice examination documents (including 300+ page exam books, scanned PDFs, and photos).

STRICT RULES:
1. VERBATIM EXTRACTION ONLY: Extract existing multiple-choice questions faithfully from the provided pages. NEVER summarize, paraphrase, shorten, or invent new questions.
2. FRONT-MATTER & NON-EXAM FILTERING: Automatically ignore and skip covers, copyright pages, prefaces (คำนำ), instructions (คำชี้แจง), table of contents (สารบัญ), blank pages, and pure reading/theory content with no exam questions or answer keys. List skipped non-exam pages in "skipped_pages".
3. STRICT 4-5 CHOICE MCQ ONLY: Include ONLY multiple-choice questions that have 4 or 5 options. Skip essays (อัตนัย), fill-in-the-blank (เติมคำ), matching (จับคู่), true/false, or questions with fewer than 4 or more than 5 options — report them in "skipped_items" with reason "non_mcq" or "invalid_option_count".
4. SKIP IMAGE-DEPENDENT QUESTIONS: If a question stem or any option contains or requires a figure, diagram, graph, chart, map, circuit, or illustration to solve, DO NOT include it in "questions". Record it in "skipped_items" with reason "has_image" and its original question number and page.
5. STRIP QUESTION NUMBERS & CHOICE PREFIXES:
   - Put the original question number (Arabic digits e.g. "1", "42") in "source_question_number".
   - Remove the leading question number (e.g. "1.", "1)", "ข้อ 1.", "ข้อที่ ๑", "(1)") from "question_text", while keeping any numbers that are part of the question content itself.
   - Remove leading choice prefixes (e.g. "ก.", "ข.", "ค.", "ง.", "จ.", "A.", "B.", "C.", "D.", "E.", "1.", "(ก)") from every item in "options".
   - Set "correct_option" to the exact 0-based index (0..options.length-1) matching the correct option in the "options" array.
6. PLAIN-TEXT MATH & TEXT TABLES ONLY: Convert math formulas and text-based tables into clean, human-readable Unicode plain text (e.g. ², ³, ×, ÷, √, ≤, ≥, ≠, π, °, aligned lines). NEVER output raw LaTeX (no \\frac, \\sqrt, $$, $) and avoid broken Markdown pipe tables.
7. MIXED ANSWER KEYS & AI SOLVING:
   - If the answer is shown directly with the question, set "answer_source": "document" and match the document's answer 100%.
   - If the answer is NOT shown on these pages, solve the question accurately yourself, set "answer_source": "ai_inferred", and set "correct_option" to your solved 0-based index.
   - If these pages contain a standalone answer key / answer table (เฉลยท้ายบท / ตารางเฉลยท้ายเล่ม), extract every entry into "answer_keys" with "source_question_number", "source_section" (if visible), "answer_label", "answer_index" (0-based: ก/A/1=0, ข/B/2=1, ค/C/3=2, ง/D/4=3, จ/E/5=4), "explanation_from_key" (if present), and "source_page".
8. CONCISE EXPLANATION FOR EVERY QUESTION: Always provide a clear, concise Thai explanation (1-3 sentences explaining why the correct option is right) in "explanation" for EVERY item in "questions".
9. BOUNDARY CONTINUITY: If the very last question on the last page of this batch is cut off mid-question or missing its options because it continues onto the next page, DO NOT emit an incomplete question. Put that unfinished trailing text into "incomplete_tail_text" so the next batch can combine it cleanly.

Return ONLY valid JSON matching the exact requested schema, with no Markdown fences or extra prose.`

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
    answerKeysMapped: 0,
    aiSolvedCount: 0,
    partialRecoveries: 0,
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

function buildChunkPrompt({ categoryName, fileName, pageEntries, pendingTailText, pendingTailPage }) {
  const pageNumbers = pageEntries.map((p) => p.pageNumber)
  const minPage = Math.min(...pageNumbers)
  const maxPage = Math.max(...pageNumbers)

  const headerLines = [
    `Subject Category: "${categoryName || 'ทั่วไป'}"`,
    `Source File: "${fileName}"`,
    `Current Batch Pages: ${minPage} to ${maxPage} (${pageEntries.length} page(s))`,
    '',
    'Return ONLY a single JSON object with this exact structure:',
    `{
  "questions": [
    {
      "source_question_number": "1",
      "source_section": "ชุดที่ 1 หรือชื่อบท (ใส่ค่าว่างหากไม่มี)",
      "source_page": ${minPage},
      "question_text": "ข้อความโจทย์ตามต้นฉบับ (ตัดเลขข้อหน้าโจทย์แล้ว, สูตรเป็น Unicode Plain Text)",
      "options": ["ตัวเลือก 1 (ตัด ก./A./1. แล้ว)", "ตัวเลือก 2", "ตัวเลือก 3", "ตัวเลือก 4"],
      "correct_option": 0,
      "answer_source": "document หรือ ai_inferred",
      "explanation": "คำอธิบายเฉลยภาษาไทยกระชับ ชัดเจน 1-3 ประโยค"
    }
  ],
  "answer_keys": [
    {
      "source_question_number": "1",
      "source_section": "",
      "answer_label": "ก",
      "answer_index": 0,
      "explanation_from_key": "",
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
  systemInstruction = SYSTEM_INSTRUCTION,
  temperature = 0.1,
  maxOutputTokens = 8192,
  signal,
  onRetryStatus
}) {
  const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`

  let lastError = null
  for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
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
        throw new Error(apiMsg || `คำขอไม่ถูกต้อง (HTTP ${response.status})`)
      }

      const retryable = response.status === 429 || response.status === 503 || response.status === 500
      if (retryable && attempt < MAX_RETRY_ATTEMPTS) {
        const retryAfterHeader = Number(response.headers.get('Retry-After'))
        const backoffMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? retryAfterHeader * 1000
          : Math.min(INITIAL_RETRY_BACKOFF_MS * (2 ** attempt) + Math.floor(Math.random() * 800), 30000)

        onRetryStatus?.(
          response.status === 429
            ? `ติด Rate Limit (429) — กำลังรอ ${(backoffMs / 1000).toFixed(1)} วินาที แล้วลองใหม่อัตโนมัติ (ครั้งที่ ${attempt + 1}/${MAX_RETRY_ATTEMPTS})...`
            : `เซิร์ฟเวอร์ Gemini ตอบสนองช้า (HTTP ${response.status}) — ลองใหม่อีกครั้งใน ${(backoffMs / 1000).toFixed(1)} วินาที...`
        )
        await sleepWithAbort(backoffMs, signal)
        continue
      }

      if (response.status === 429) {
        throw new Error('โควตา Gemini API (429 Rate Limit) เต็มชั่วคราว บันทึกความคืบหน้าไว้ใน Checkpoint แล้ว คุณสามารถรอสักครู่หรือสลับโมเดลในหน้าตั้งค่า AI แล้วกดอ่านต่อได้ทันที')
      }

      throw new Error(payload?.error?.message || `เรียก Gemini API ไม่สำเร็จ (HTTP ${response.status})`)
    } catch (error) {
      if (isAbortError(error)) throw error
      lastError = error
      const isNetworkFailure = error instanceof TypeError || /network|fetch|timeout/i.test(error?.message || '')
      if (isNetworkFailure && attempt < MAX_RETRY_ATTEMPTS) {
        const backoffMs = INITIAL_RETRY_BACKOFF_MS * (2 ** attempt)
        onRetryStatus?.(`เชื่อมต่อเครือข่ายขัดข้อง — กำลังลองใหม่ใน ${(backoffMs / 1000).toFixed(1)} วินาที (ครั้งที่ ${attempt + 1}/${MAX_RETRY_ATTEMPTS})...`)
        await sleepWithAbort(backoffMs, signal)
        continue
      }
      throw error
    }
  }

  throw lastError || new Error('เรียก Gemini API ไม่สำเร็จ')
}

async function regenerateConciseExplanations({ apiKey, model, items, signal }) {
  const resultMap = new Map()
  if (!Array.isArray(items) || items.length === 0) return resultMap

  const BATCH_SIZE = 15
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    if (signal?.aborted) break
    const slice = items.slice(i, i + BATCH_SIZE)
    const prompt = `สร้างคำอธิบายเฉลยภาษาไทยที่กระชับ ชัดเจน เข้าใจเหตุผลทันที (1-3 ประโยคต่อข้อ ห้ามใช้ LaTeX ดิบ ให้ใช้สัญลักษณ์ Unicode แทน) สำหรับข้อสอบต่อไปนี้ โดยยึดตามเฉลยที่ระบุ (correct_option เป็น 0-based index):

คืนค่าเป็น JSON Array เท่านั้น: [{"id":"...","explanation":"..."}]

รายการข้อสอบ:
${JSON.stringify(slice)}`

    const { text } = await callGeminiWithRetry({
      apiKey,
      model,
      parts: [{ text: prompt }],
      systemInstruction: 'You write concise, accurate Thai exam answer explanations (1-3 sentences each) in plain text without LaTeX. Return ONLY valid JSON.',
      temperature: 0.2,
      maxOutputTokens: 4096,
      signal
    })

    try {
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) {
        for (const row of parsed) {
          if (row?.id && typeof row?.explanation === 'string' && row.explanation.trim()) {
            resultMap.set(row.id, row.explanation.trim())
          }
        }
      }
    } catch {
      // Non-fatal; caller falls back gracefully
    }
  }

  return resultMap
}

/**
 * Inspect uploaded file(s) quickly before extraction starts:
 * computes fingerprint, detects page/image count, estimates Text vs Vision mode,
 * recommends Auto-First chunking, and checks for existing Checkpoints in this category.
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
 * Main Verbatim Exam Extraction Pipeline:
 * - Lazy page-by-page PDF loading (safe for 300+ page PDFs)
 * - Hybrid Text + Vision per page
 * - Smart front-matter & non-exam skipping
 * - Auto-First chunking + manual override + optional page range
 * - Adaptive Pacing + Retry with Exponential Backoff
 * - Partial JSON Recovery
 * - Category-Scoped Strict Exact Match Deduplication (questions + staging + intra-run)
 * - Incremental Staging Save + Checkpoint after EVERY chunk
 * - Mixed Answer Key mapping (inline + end-of-chapter/book + AI-solved fallback)
 */
export async function runVerbatimExamExtraction({
  files,
  categoryId,
  categoryName,
  currentUserId,
  pagesPerBatchOverride = null,
  startPage = null,
  endPage = null,
  resumeFromCheckpoint = true,
  signal,
  onProgress,
  onStagingUpdated
}) {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error('ยังไม่ได้ตั้งค่า Gemini API Key กรุณาไปตั้งค่าในเมนูผู้ดูแลก่อน')
  }
  const selectedModel = getGeminiModel() || DEFAULT_GEMINI_MODEL

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

  const emitProgress = (extra = {}) => {
    onProgress?.({
      status: 'running',
      currentStartPage: 0,
      currentEndPage: 0,
      currentMode: 'text',
      statusMessage: '',
      adaptiveDelayMs: 0,
      resumedFromPage: 0,
      ...extra,
      stats: { ...stats }
    })
  }

  try {
    emitProgress({
      status: 'initializing',
      statusMessage: 'กำลังตรวจสอบเอกสารและโหลดรายการข้อสอบเดิมในหมวดหมู่เพื่อตรวจซ้ำ...'
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

    // Load Category-Scoped Strict Exact Match lookup Set across BOTH `questions` and `question_staging_items`
    const existingExactSet = await fetchCategoryExactQuestionSet(categoryId, { includeStaging: true })

    // Resolve Page Range & Checkpoint Resume
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
      if (existingCheckpoint && Number(existingCheckpoint.last_completed_page) >= clampedStart) {
        stats = mergeStats(existingCheckpoint.stats)
        lastCompletedPage = Number(existingCheckpoint.last_completed_page)
        pendingTailText = existingCheckpoint.pending_tail_text || ''
        pendingTailPage = existingCheckpoint.pending_tail_page || null
        resumedFromPage = lastCompletedPage
        effectiveStart = Math.max(clampedStart, lastCompletedPage + 1)
      }
    } else {
      await clearExtractionCheckpoint(categoryId, fingerprint)
    }

    stats.totalPages = totalPages

    // Already completed entire requested range via checkpoint!
    if (effectiveStart > clampedEnd) {
      emitProgress({
        status: 'completed',
        currentStartPage: clampedEnd,
        currentEndPage: clampedEnd,
        currentMode: dominantMode,
        resumedFromPage,
        statusMessage: `อ่านครบทุกหน้าถึงหน้า ${clampedEnd}/${totalPages} แล้วตาม Checkpoint (ข้ามส่วนที่อ่านแล้วทั้งหมด)`
      })
      return {
        completed: true,
        paused: false,
        fingerprint,
        stats
      }
    }

    // Auto-First + Manual Override batch sizing
    const manualPages = Number(pagesPerBatchOverride)
    const hasManualOverride = Number.isInteger(manualPages) && manualPages >= 1 && manualPages <= 30
    let targetPagesPerBatch = hasManualOverride ? manualPages : recommended.pagesPerBatch
    const maxVisionPerBatch = hasManualOverride
      ? Math.min(manualPages, 5)
      : recommended.maxVisionPagesPerBatch

    let adaptiveDelayMs = recommended.baseDelayMs
    let consecutiveCleanBatches = 0

    let cursorPage = effectiveStart

    while (cursorPage <= clampedEnd) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      // 1) Lazily assemble ONE chunk at a time (never keep more than one chunk's rendered images in RAM)
      const chunkPages = []
      const chunkStartPage = cursorPage
      let chunkEndPage = cursorPage
      let chunkTextChars = 0
      let chunkVisionCount = 0
      let chunkTextCount = 0

      while (cursorPage <= clampedEnd && chunkPages.length < targetPagesPerBatch) {
        if (signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError')
        }

        const pageNumber = cursorPage
        emitProgress({
          status: 'reading',
          currentStartPage: chunkStartPage,
          currentEndPage: pageNumber,
          currentMode: chunkVisionCount > 0 && chunkTextCount > 0 ? 'mixed' : chunkVisionCount > 0 ? 'vision' : dominantMode,
          adaptiveDelayMs,
          resumedFromPage,
          statusMessage: `กำลังอ่านหน้า ${pageNumber} จากทั้งหมด ${totalPages} หน้า (${isPdf ? 'Lazy Hybrid PDF' : 'Image Vision'})...`
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
          // If we haven't accumulated any exam pages yet, advance checkpoint over skipped front-matter safely
          if (chunkPages.length === 0) {
            lastCompletedPage = pageNumber
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

        // Respect text character budget & vision page cap per chunk to prevent output truncation / OOM
        if (chunkVisionCount >= maxVisionPerBatch) break
        if (chunkTextChars >= MAX_TEXT_CHARS_PER_BATCH) break
      }

      // If all pages in this scan were skipped front-matter/blank pages, checkpoint & continue
      if (chunkPages.length === 0) {
        await saveExtractionCheckpoint({
          category_id: categoryId,
          source_file_fingerprint: fingerprint,
          source_file_name: sourceFileName,
          total_pages: totalPages,
          last_completed_page: chunkEndPage,
          pending_tail_text: pendingTailText,
          pending_tail_page: pendingTailPage,
          stats,
          status: cursorPage > clampedEnd ? 'completed' : 'in_progress',
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
        status: 'extracting',
        currentStartPage: chunkPages[0].pageNumber,
        currentEndPage: chunkPages[chunkPages.length - 1].pageNumber,
        currentMode: batchMode,
        adaptiveDelayMs,
        resumedFromPage,
        statusMessage: `Gemini กำลังสกัดข้อสอบหน้า ${chunkPages[0].pageNumber}–${chunkPages[chunkPages.length - 1].pageNumber} จาก ${totalPages} หน้า (${
          batchMode === 'vision' ? 'Vision' : batchMode === 'mixed' ? 'Text + Vision' : 'Text'
        })...`
      })

      // 2) Send chunk to Gemini with Retry + Exponential Backoff
      const promptParts = buildChunkPrompt({
        categoryName,
        fileName: sourceFileName,
        pageEntries: chunkPages,
        pendingTailText,
        pendingTailPage
      })

      const geminiResult = await callGeminiWithRetry({
        apiKey,
        model: selectedModel,
        parts: promptParts,
        signal,
        onRetryStatus: (retryMessage) => {
          adaptiveDelayMs = Math.min(Math.round(adaptiveDelayMs * 1.6), MAX_ADAPTIVE_DELAY_MS)
          emitProgress({
            status: 'retrying',
            currentStartPage: chunkPages[0].pageNumber,
            currentEndPage: chunkPages[chunkPages.length - 1].pageNumber,
            currentMode: batchMode,
            adaptiveDelayMs,
            resumedFromPage,
            statusMessage: retryMessage
          })
        }
      })

      // Immediately release heavy base64 images from this chunk so GC frees memory
      for (const p of chunkPages) {
        p.image = null
      }

      // Adaptive Pacing adjustment
      if (geminiResult.hitRateLimit) {
        adaptiveDelayMs = Math.min(Math.round(adaptiveDelayMs * 1.5), MAX_ADAPTIVE_DELAY_MS)
        consecutiveCleanBatches = 0
      } else {
        consecutiveCleanBatches += 1
        if (consecutiveCleanBatches >= 3 && adaptiveDelayMs > recommended.baseDelayMs) {
          adaptiveDelayMs = Math.max(recommended.baseDelayMs, Math.round(adaptiveDelayMs * 0.85))
          consecutiveCleanBatches = 0
        }
      }

      // 3) Parse JSON with Partial JSON Recovery
      const parsed = parsePartialExtractionJson(geminiResult.text)
      if (parsed.partialRecovered || geminiResult.finishReason === 'MAX_TOKENS') {
        stats.partialRecoveries += 1
        // Auto-shrink chunk size slightly if output hit MAX_TOKENS (when using Auto mode)
        if (!hasManualOverride && targetPagesPerBatch > 2) {
          targetPagesPerBatch = Math.max(2, Math.floor(targetPagesPerBatch * 0.7))
        }
      }

      // Record AI-detected front-matter / non-exam skipped pages
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

      // Record skipped items (images / non-MCQ)
      for (const skippedItem of parsed.skipped_items) {
        const reason = String(skippedItem?.reason || 'non_mcq')
        if (reason === 'has_image') {
          stats.skippedImageQuestions += 1
        } else {
          stats.skippedNonMcqQuestions += 1
        }
        pushBounded(stats.skippedItemsLog, {
          source_question_number: String(skippedItem?.source_question_number || '-'),
          source_page: Number(skippedItem?.source_page) || chunkPages[0].pageNumber,
          reason,
          detail: String(skippedItem?.detail || (reason === 'has_image' ? 'มีรูปภาพประกอบ' : 'ไม่ใช่ปรนัย 4–5 ตัวเลือก'))
        })
      }

      // 4) Validate, strip numbers/choice prefixes, convert math, and apply Strict Exact Match Dedup
      const rowsToInsert = []
      for (const rawQuestion of parsed.questions) {
        const validation = validateAndFormatExtractedQuestion(rawQuestion)
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

        // Mark seen immediately to prevent intra-batch & cross-chunk duplicates
        existingExactSet.add(strictKey)
        if (formatted.is_ai_solved) stats.aiSolvedCount += 1

        rowsToInsert.push({
          category_id: categoryId,
          question_text: formatted.question_text,
          options: formatted.options,
          correct_option: formatted.correct_option,
          explanation: formatted.explanation,
          is_options_randomized: true,
          image_url: null,
          explanation_image_url: null,
          source_file_fingerprint: fingerprint,
          source_file_name: sourceFileName,
          source_question_number: formatted.source_question_number,
          source_section: formatted.source_section,
          source_page: formatted.source_page || chunkPages[0].pageNumber,
          has_source_answer: formatted.has_source_answer,
          is_ai_solved: formatted.is_ai_solved,
          created_by: currentUserId || null
        })
      }

      // 5) Incremental Save to Supabase Staging Table immediately after each chunk!
      let insertedRows = []
      if (rowsToInsert.length > 0) {
        insertedRows = await insertStagingItems(rowsToInsert)
        stats.savedToStaging += insertedRows.length
      }

      // 6) Apply any standalone Answer Keys (end-of-chapter / end-of-book) back to Staging
      let mappedKeyResult = { updatedCount: 0, updatedItems: [] }
      if (parsed.answer_keys.length > 0) {
        emitProgress({
          status: 'mapping_keys',
          currentStartPage: chunkPages[0].pageNumber,
          currentEndPage: chunkPages[chunkPages.length - 1].pageNumber,
          currentMode: batchMode,
          adaptiveDelayMs,
          resumedFromPage,
          statusMessage: `พบเฉลยท้ายบท/ท้ายไฟล์ ${parsed.answer_keys.length} ข้อ — กำลังจับคู่กลับไปยังข้อสอบใน Staging...`
        })

        mappedKeyResult = await applyAnswerKeysToStagingItems({
          categoryId,
          fingerprint,
          answerKeys: parsed.answer_keys,
          regenerateExplanationsFn: (items) =>
            regenerateConciseExplanations({
              apiKey,
              model: selectedModel,
              items,
              signal
            })
        })
        stats.answerKeysMapped += mappedKeyResult.updatedCount
        if (mappedKeyResult.updatedCount > 0) {
          stats.aiSolvedCount = Math.max(0, stats.aiSolvedCount - mappedKeyResult.updatedCount)
        }
      }

      // Notify UI to refresh live Staging Preview immediately
      if (insertedRows.length > 0 || mappedKeyResult.updatedCount > 0) {
        onStagingUpdated?.({
          insertedRows,
          updatedItems: mappedKeyResult.updatedItems
        })
      }

      // 7) Save Checkpoint & carry over incomplete boundary tail text to the next chunk
      // If output was truncated (`MAX_TOKENS` / partial recovery) across a multi-page chunk,
      // rewind cursor to the last recovered page so remaining pages in the chunk are NOT skipped
      // (Exact Match dedup ensures already-saved questions on that page won't be duplicated).
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
        } else {
          // Recovered nothing on a multi-page truncation: advance by half chunk at most and retry smaller
          effectiveCompletedPage = chunkPages[0].pageNumber - 1
          cursorPage = chunkPages[0].pageNumber
          if (targetPagesPerBatch > 1) {
            targetPagesPerBatch = Math.max(1, Math.floor(targetPagesPerBatch / 2))
          } else {
            effectiveCompletedPage = chunkEndPage
            cursorPage = chunkEndPage + 1
          }
        }
      }

      lastCompletedPage = Math.max(lastCompletedPage, effectiveCompletedPage)
      pendingTailText = parsed.incomplete_tail_text || ''
      pendingTailPage = pendingTailText ? lastCompletedPage : null

      const isDone = cursorPage > clampedEnd
      await saveExtractionCheckpoint({
        category_id: categoryId,
        source_file_fingerprint: fingerprint,
        source_file_name: sourceFileName,
        total_pages: totalPages,
        last_completed_page: lastCompletedPage,
        pending_tail_text: isDone ? null : pendingTailText,
        pending_tail_page: isDone ? null : pendingTailPage,
        stats,
        status: isDone ? 'completed' : 'in_progress',
        created_by: currentUserId
      })

      emitProgress({
        status: isDone ? 'completed' : 'running',
        currentStartPage: chunkPages[0].pageNumber,
        currentEndPage: chunkEndPage,
        currentMode: batchMode,
        adaptiveDelayMs,
        resumedFromPage,
        statusMessage: isDone
          ? `สกัดข้อสอบครบถึงหน้า ${chunkEndPage}/${totalPages} เรียบร้อยแล้ว`
          : `บันทึกหน้า ${chunkPages[0].pageNumber}–${chunkEndPage} เข้า Staging แล้ว (${stats.savedToStaging} ข้อ) · กำลังเตรียมรอบถัดไป...`
      })

      // 8) Adaptive Pacing delay between chunks
      if (!isDone) {
        await sleepWithAbort(adaptiveDelayMs, signal)
      }
    }

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
      pending_tail_text: pendingTailText,
      pending_tail_page: pendingTailPage,
      stats,
      status: pausedByUser ? 'paused' : 'error',
      created_by: currentUserId
    })

    if (pausedByUser) {
      emitProgress({
        status: 'paused',
        currentStartPage: lastCompletedPage,
        currentEndPage: lastCompletedPage,
        statusMessage: `หยุดพักการทำงานที่หน้า ${lastCompletedPage}/${stats.totalPages} แล้ว (บันทึก Checkpoint และข้อสอบใน Staging ครบถ้วน)`
      })
      return {
        completed: false,
        paused: true,
        fingerprint,
        lastCompletedPage,
        stats
      }
    }

    emitProgress({
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
