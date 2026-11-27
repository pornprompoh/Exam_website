const DUPLICATE_SIMILARITY_THRESHOLD = 0.95

export function parseGeneratorJsonResponse(text) {
  const withoutFence = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(withoutFence)
  if (!Array.isArray(parsed)) throw new Error('AI ตอบกลับไม่ใช่รายการข้อสอบ')
  return parsed
}

export function normalizeGeneratedQuestion(item, index) {
  const options = Array.isArray(item.options) ? item.options.slice(0, 4).map(String) : []
  const correctAnswer = Number(item.correct_answer)
  if (!String(item.question || '').trim() || options.length !== 4 || options.some((option) => !option.trim())) {
    throw new Error(`ข้อมูลข้อสอบข้อที่ ${index + 1} จาก AI ไม่ครบถ้วน`)
  }
  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
    throw new Error(`เฉลยข้อที่ ${index + 1} จาก AI ไม่ถูกต้อง`)
  }
  return {
    question_text: String(item.question).trim(),
    options,
    correct_option: correctAnswer,
    explanation: String(item.explanation || '').trim(),
    source_topic: String(item.source_topic || 'ไม่ระบุแหล่งที่มา').trim()
  }
}

export function normalizeQuestionText(question) {
  return String(question || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

export function isNearlyIdentical(left, right) {
  if (left === right) return true
  if (!left || !right) return false

  const maxLength = Math.max(left.length, right.length)
  const allowedEdits = Math.floor(maxLength * (1 - DUPLICATE_SIMILARITY_THRESHOLD))
  if (Math.abs(left.length - right.length) > allowedEdits) return false

  let previousRow = new Map([[0, 0]])
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const currentRow = new Map()
    const start = Math.max(0, leftIndex - allowedEdits)
    const end = Math.min(right.length, leftIndex + allowedEdits)
    if (start === 0) currentRow.set(0, leftIndex)

    let minimumDistance = Number.POSITIVE_INFINITY
    for (let rightIndex = Math.max(1, start); rightIndex <= end; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      const distance = Math.min(
        (currentRow.get(rightIndex - 1) ?? Number.POSITIVE_INFINITY) + 1,
        (previousRow.get(rightIndex) ?? Number.POSITIVE_INFINITY) + 1,
        (previousRow.get(rightIndex - 1) ?? Number.POSITIVE_INFINITY) + substitutionCost
      )
      currentRow.set(rightIndex, distance)
      minimumDistance = Math.min(minimumDistance, distance)
    }

    if (minimumDistance > allowedEdits) return false
    previousRow = currentRow
  }

  return (previousRow.get(right.length) ?? Number.POSITIVE_INFINITY) <= allowedEdits
}
