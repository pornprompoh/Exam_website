export const DEFAULT_AUDITOR_BATCH_SIZE = 40
export const MIN_AUDITOR_BATCH_SIZE = 20
export const MAX_AUDITOR_BATCH_SIZE = 50
export const STAGE2_CONFIRM_BATCH_SIZE = 20

export const AUDIT_STAGES = [
  { stage: 0, label: 'ด่าน 0', title: 'Local Pre-Check (0 Quota)' },
  { stage: 1, label: 'ด่าน 1', title: 'Mega-Batch คัดกรอง (Flash Lite)' },
  { stage: 2, label: 'ด่าน 2', title: 'ยืนยันเชิงลึก (Flash Standard)' }
]

/**
 * Estimate API quota consumption before starting an audit run.
 */
export function estimateAuditQuota(questionCount, batchSize = DEFAULT_AUDITOR_BATCH_SIZE, modelRoutingMode = 'hybrid') {
  const count = Math.max(0, Number(questionCount) || 0)
  const safeBatch = Math.min(
    MAX_AUDITOR_BATCH_SIZE,
    Math.max(MIN_AUDITOR_BATCH_SIZE, Number(batchSize) || DEFAULT_AUDITOR_BATCH_SIZE)
  )
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
