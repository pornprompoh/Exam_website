import { getGeminiApiKey } from '../../../../shared/lib/geminiApiKey'
import { getGeminiModelLabel, resolveHybridModelPair } from '../../../../shared/lib/geminiModels'
import {
  DEFAULT_MAX_RETRY_ATTEMPTS,
  MIN_DEEP_RPM_SPACING_MS,
  MIN_LITE_RPM_SPACING_MS,
  callGeminiJsonWithRetry,
  createRpmPacer,
  isAbortError
} from '../../shared/utils/geminiClientUtils'
import { convertMathAndTableToPlainText, parseAnswerLabelToIndex } from '../../shared/utils/examTextFormatUtils'
import { parseJsonSafe } from '../../shared/utils/partialJsonUtils'
import {
  STAGE1_SCREENING_SYSTEM_INSTRUCTION,
  STAGE2_CONFIRM_SYSTEM_INSTRUCTION,
  buildStage1ScreeningPrompt,
  buildStage2ConfirmPrompt
} from '../prompts/answerAuditorPrompts'
import {
  DEFAULT_AUDITOR_BATCH_SIZE,
  MAX_AUDITOR_BATCH_SIZE,
  MIN_AUDITOR_BATCH_SIZE,
  STAGE2_CONFIRM_BATCH_SIZE,
  runStage0LocalPreCheck
} from '../utils/auditorLocalUtils'
import {
  fetchUncheckedQuestions,
  markQuestionFlaggedInDb,
  markQuestionsVerifiedInDb
} from './auditorDbService'

export async function runAnswerAuditPipeline({
  categoryId = 'ALL',
  maxQuestions = null,
  batchSize = DEFAULT_AUDITOR_BATCH_SIZE,
  modelRoutingMode = 'hybrid',
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

      const promptText = buildStage2ConfirmPrompt(payloadItems)
      let geminiRes
      let modelUsed = activeDeepModel

      try {
        geminiRes = await callGeminiJsonWithRetry({
          apiKey,
          model: activeDeepModel,
          systemInstruction: STAGE2_CONFIRM_SYSTEM_INSTRUCTION,
          parts: [{ text: promptText }],
          pacer: activeDeepPacer,
          maxRetries: !usingFallbackLite ? 1 : DEFAULT_MAX_RETRY_ATTEMPTS,
          signal,
          quotaExceededMessage: `โควตาโมเดล ${getGeminiModelLabel(activeDeepModel)} (429/RPD) เต็มชั่วคราว ความคืบหน้าก่อนหน้านี้ถูกบันทึกในฐานข้อมูลแล้ว`,
          onRetryStatus: (msg) =>
            emit({
              stage: 2,
              status: 'retrying',
              activeModel: activeDeepModel,
              pacer: activeDeepPacer,
              statusMessage: `ด่าน 2: ${msg}`
            })
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

          geminiRes = await callGeminiJsonWithRetry({
            apiKey,
            model: activeDeepModel,
            systemInstruction: STAGE2_CONFIRM_SYSTEM_INSTRUCTION,
            parts: [{ text: promptText }],
            pacer: activeDeepPacer,
            maxRetries: DEFAULT_MAX_RETRY_ATTEMPTS,
            signal,
            quotaExceededMessage: `โควตาโมเดล ${getGeminiModelLabel(activeDeepModel)} (429/RPD) เต็มชั่วคราว ความคืบหน้าก่อนหน้านี้ถูกบันทึกในฐานข้อมูลแล้ว`,
            onRetryStatus: (msg) =>
              emit({
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

    // STAGE 0: Local Answer-Integrity Pre-Check (0 Quota)
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

    // STAGE 1: Exception-Only Mega-Batch Screening with Flash Lite
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

      const compactBatch = batch.map((q, idx) => ({
        i: idx,
        q: q.question_text,
        o: q.options,
        a: Number(q.correct_option),
        img: q.image_url ? 1 : 0
      }))

      const geminiRes = await callGeminiJsonWithRetry({
        apiKey,
        model: liteModel,
        systemInstruction: STAGE1_SCREENING_SYSTEM_INSTRUCTION,
        parts: [{ text: buildStage1ScreeningPrompt(compactBatch) }],
        pacer: litePacer,
        signal,
        quotaExceededMessage: `โควตาโมเดล ${getGeminiModelLabel(liteModel)} (429/RPD) เต็มชั่วคราว ความคืบหน้าก่อนหน้านี้ถูกบันทึกในฐานข้อมูลแล้ว`,
        onRetryStatus: (msg) =>
          emit({
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
        if (Number.isInteger(suspectedAns) && suspectedAns === currentAns) continue

        suspectIndexSet.add(idx)
        pendingStage2Queue.push({
          question: q,
          suspectedIndex:
            Number.isInteger(suspectedAns) && suspectedAns >= 0 && suspectedAns < (q.options?.length || 0)
              ? suspectedAns
              : null,
          suspectNote: String(s?.n || '').trim()
        })
      }

      const verifiedIds = batch.filter((_, idx) => !suspectIndexSet.has(idx)).map((q) => q.id)

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

      if (pendingStage2Queue.length >= STAGE2_CONFIRM_BATCH_SIZE) {
        const toFlush = pendingStage2Queue.splice(0, STAGE2_CONFIRM_BATCH_SIZE)
        await flushStage2Suspects(toFlush)
      }
    }

    // STAGE 2: Flush Remaining Suspects through Flash Standard (with Auto-Fallback)
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
