import { getGeminiModelLabel } from '../../../../shared/lib/geminiModels'
import {
  DEFAULT_MAX_RETRY_ATTEMPTS,
  callGeminiJsonWithRetry,
  isAbortError
} from '../../shared/utils/geminiClientUtils'
import { convertMathAndTableToPlainText, parseAnswerLabelToIndex } from '../../shared/utils/examTextFormatUtils'
import { parsePass3BatchJson } from '../../shared/utils/partialJsonUtils'
import {
  STAGE3A_SCREENING_SYSTEM_INSTRUCTION,
  STAGE3B_DEEP_SYSTEM_INSTRUCTION,
  buildStage3APrompt,
  buildStage3BPrompt
} from '../prompts/examExtractorPrompts'
import { saveExtractionCheckpoint } from './extractionCheckpointService'
import {
  fetchCategoryStagingCount,
  fetchPendingStagingItems,
  savePass3BatchResults
} from './stagingQuestionService'

const STAGE3A_SCREENING_BATCH_SIZE = 25
const STAGE3B_DEEP_BATCH_SIZE = 20

/**
 * PASS 3: TWO-STAGE HYBRID ENGINE (STAGE 3A SCREENING -> STAGE 3B DEEP ARBITRATION)
 */
export async function executeTwoStagePass3({
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
  modelRoutingMode = 'hybrid',
  liteModel,
  deepModel,
  litePacer,
  deepPacer,
  signal,
  onProgress,
  onStagingUpdated
}) {
  const pendingItems = await fetchPendingStagingItems(categoryId, fingerprint)

  const escalationMap = new Map()
  for (const entry of initialEscalationQueue || []) {
    if (entry?.id) escalationMap.set(entry.id, entry.suspect_note || '')
  }

  const withBookAnswerAll = pendingItems.filter((row) => row.book_answer !== null && row.book_answer !== undefined)
  const withoutBookAnswer = pendingItems.filter((row) => row.book_answer === null || row.book_answer === undefined)
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

  // STAGE 3A: High-Throughput Screening with Flash Lite (25 items / request)
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

    const geminiRes = await callGeminiJsonWithRetry({
      apiKey,
      model: liteModel,
      parts: [{ text: buildStage3APrompt(payloadItems) }],
      systemInstruction: STAGE3A_SCREENING_SYSTEM_INSTRUCTION,
      temperature: 0.1,
      maxOutputTokens: 8192,
      pacer: litePacer,
      signal,
      quotaExceededMessage: `โควตาโมเดล ${getGeminiModelLabel(liteModel)} (429 Rate Limit / RPD) เต็มชั่วคราว บันทึกความคืบหน้าและ Answer Key Pool ไว้ใน Checkpoint แล้ว`,
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

  // STAGE 3B: Deep Arbitration (Escalation Queue) + Solve Unanswered (book_answer == null)
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

    const promptText = buildStage3BPrompt(payloadItems)
    let geminiRes
    let modelUsedForBatch = activeDeepModel

    try {
      geminiRes = await callGeminiJsonWithRetry({
        apiKey,
        model: activeDeepModel,
        parts: [{ text: promptText }],
        systemInstruction: STAGE3B_DEEP_SYSTEM_INSTRUCTION,
        temperature: 0.1,
        maxOutputTokens: 8192,
        pacer: activeDeepPacer,
        maxRetries: !usingFallbackLite ? 1 : DEFAULT_MAX_RETRY_ATTEMPTS,
        signal,
        quotaExceededMessage: `โควตาโมเดล ${getGeminiModelLabel(activeDeepModel)} (429 Rate Limit / RPD) เต็มชั่วคราว บันทึกความคืบหน้าและ Answer Key Pool ไว้ใน Checkpoint แล้ว`,
        onRetryStatus: (msg) => emitPass3Progress('3B', activeDeepModel, 'retrying', `ขั้น 3B/3: ${msg}`, activeDeepPacer)
      })
    } catch (deepErr) {
      if (isAbortError(deepErr)) throw deepErr

      if (
        !usingFallbackLite &&
        (deepErr.isQuotaOrRateLimit || deepErr.httpStatus === 429 || deepErr.httpStatus === 404 || deepErr.httpStatus === 503)
      ) {
        usingFallbackLite = true
        const failedLabel = getGeminiModelLabel(activeDeepModel)
        const liteLabel = getGeminiModelLabel(liteModel)
        activeDeepModel = liteModel
        activeDeepPacer = litePacer
        modelUsedForBatch = liteModel

        stats.fallbackTriggered = true
        stats.fallbackNotice = `โมเดล ${failedLabel} ชนลิมิต RPD/429 — สลับมาใช้ ${liteLabel} อัตโนมัติเพื่อให้การฟันธงดำเนินต่อไม่สะดุด`

        emitPass3Progress('3B', activeDeepModel, 'retrying', `⚠️ ${stats.fallbackNotice}`, activeDeepPacer)

        geminiRes = await callGeminiJsonWithRetry({
          apiKey,
          model: activeDeepModel,
          parts: [{ text: promptText }],
          systemInstruction: STAGE3B_DEEP_SYSTEM_INSTRUCTION,
          temperature: 0.1,
          maxOutputTokens: 8192,
          pacer: activeDeepPacer,
          maxRetries: DEFAULT_MAX_RETRY_ATTEMPTS,
          signal,
          quotaExceededMessage: `โควตาโมเดล ${getGeminiModelLabel(activeDeepModel)} (429 Rate Limit / RPD) เต็มชั่วคราว บันทึกความคืบหน้าและ Answer Key Pool ไว้ใน Checkpoint แล้ว`,
          onRetryStatus: (msg) =>
            emitPass3Progress('3B', activeDeepModel, 'retrying', `ขั้น 3B/3 (Fallback): ${msg}`, activeDeepPacer)
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
