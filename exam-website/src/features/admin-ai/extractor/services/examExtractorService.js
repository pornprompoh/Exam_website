import { getGeminiApiKey } from '../../../../shared/lib/geminiApiKey'
import { getGeminiModelLabel, resolveHybridModelPair } from '../../../../shared/lib/geminiModels'
import {
  computeFileFingerprint,
  isPdfFile,
  openLazyPdfDocument,
  readImageFileAsInlineData,
  recommendBatchConfig,
  validateExtractorFiles
} from '../../shared/utils/pdfPipelineUtils'
import {
  MIN_DEEP_RPM_SPACING_MS,
  MIN_LITE_RPM_SPACING_MS,
  callGeminiJsonWithRetry,
  createRpmPacer,
  isAbortError
} from '../../shared/utils/geminiClientUtils'
import { normalizeForStrictExactMatch } from '../../shared/utils/examTextFormatUtils'
import { parsePartialExtractionJson } from '../../shared/utils/partialJsonUtils'
import { PASS1_SYSTEM_INSTRUCTION, buildPass1ChunkPrompt } from '../prompts/examExtractorPrompts'
import { mergeIntoAnswerKeyPool, validateAndFormatPass1Question } from '../utils/answerKeyMatchingUtils'
import {
  clearExtractionCheckpoint,
  loadCategoryCheckpoints,
  loadExtractionCheckpoint,
  saveExtractionCheckpoint
} from './extractionCheckpointService'
import {
  applyPass2AnswerKeyMatches,
  fetchCategoryExactQuestionSet,
  fetchCategoryStagingCount,
  insertStagingItems
} from './stagingQuestionService'
import { executeTwoStagePass3 } from './extractorPass3Service'

const MAX_TEXT_CHARS_PER_BATCH = 26000
const MAX_DETAIL_LOG_ITEMS = 400

export function createEmptyStats() {
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

export function mergeStats(existing) {
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

  const checkpoint = categoryId ? await loadExtractionCheckpoint(categoryId, fingerprint) : null

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

export async function runVerbatimExamExtraction({
  files,
  categoryId,
  categoryName,
  currentUserId,
  pagesPerBatchOverride = null,
  startPage = null,
  endPage = null,
  modelRoutingMode = 'hybrid',
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

    const clampedStart =
      Number.isInteger(Number(startPage)) && Number(startPage) >= 1 ? Math.min(Number(startPage), totalPages) : 1
    const clampedEnd =
      Number.isInteger(Number(endPage)) && Number(endPage) >= clampedStart
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
        escalationQueue = Array.isArray(existingCheckpoint.escalation_queue)
          ? [...existingCheckpoint.escalation_queue]
          : []
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

    // PASS 1: EXTRACT-ONLY & COLLECT FULL-FILE ANSWER KEY POOL (FLASH LITE)
    if (effectiveStart <= clampedEnd) {
      currentPass = 1
      const manualPages = Number(pagesPerBatchOverride)
      const hasManualOverride = Number.isInteger(manualPages) && manualPages >= 1 && manualPages <= 30
      let targetPagesPerBatch = hasManualOverride ? manualPages : recommended.pagesPerBatch
      const maxVisionPerBatch = hasManualOverride ? Math.min(manualPages, 5) : recommended.maxVisionPagesPerBatch

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
            currentMode:
              chunkVisionCount > 0 && chunkTextCount > 0 ? 'mixed' : chunkVisionCount > 0 ? 'vision' : dominantMode,
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

        const batchMode =
          chunkVisionCount > 0 && chunkTextCount > 0 ? 'mixed' : chunkVisionCount > 0 ? 'vision' : 'text'

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

        const geminiResult = await callGeminiJsonWithRetry({
          apiKey,
          model: liteModel,
          parts: promptParts,
          systemInstruction: PASS1_SYSTEM_INSTRUCTION,
          temperature: 0.1,
          maxOutputTokens: 8192,
          pacer: litePacer,
          signal,
          quotaExceededMessage: `โควตาโมเดล ${getGeminiModelLabel(liteModel)} (429 Rate Limit / RPD) เต็มชั่วคราว บันทึกความคืบหน้าและ Answer Key Pool ไว้ใน Checkpoint แล้ว`,
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
            detail: String(
              skippedItem?.detail || (reason === 'has_image' ? 'มีรูปภาพประกอบ' : 'ไม่ใช่ปรนัย 4–5 ตัวเลือก')
            )
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

        if (rowsToInsert.length > 0) {
          const insertedRows = await insertStagingItems(rowsToInsert)
          stats.savedToStaging += insertedRows.length
          const exactCount = await fetchCategoryStagingCount(categoryId)
          await onStagingUpdated?.({ insertedRows, exactCount })
        }

        let effectiveCompletedPage = chunkEndPage
        if ((parsed.partialRecovered || geminiResult.finishReason === 'MAX_TOKENS') && chunkPages.length > 1) {
          const recoveredPages = [
            ...parsed.questions
              .map((q) => Number(q?.source_page))
              .filter((p) => Number.isInteger(p) && p >= chunkPages[0].pageNumber && p <= chunkEndPage),
            ...parsed.answer_keys
              .map((k) => Number(k?.source_page))
              .filter((p) => Number.isInteger(p) && p >= chunkPages[0].pageNumber && p <= chunkEndPage)
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

    // PASS 2: FULL-FILE ANSWER KEY MATCHING
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

    // PASS 3: TWO-STAGE HYBRID VERIFICATION (3A FLASH LITE -> 3B FLASH STANDARD)
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
        statusMessage:
          currentPass === 1
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
      activeModelLabel: getGeminiModelLabel(
        modelRoutingMode === 'hybrid' && !stats.fallbackTriggered ? deepModel : liteModel
      ),
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
