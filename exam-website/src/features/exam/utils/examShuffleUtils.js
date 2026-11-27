// Pure utilities for Fisher-Yates shuffling, choice order restoration, grading, and timer formatting

export function shuffleArray(array) {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

export function prepareQuestionWithChoiceOrder(q, savedOrder = null) {
  const options = Array.isArray(q.options) ? q.options : []
  const origCorrect = Number(q.correct_option)

  if (
    Array.isArray(savedOrder) &&
    savedOrder.length === options.length &&
    savedOrder.every((idx) => Number.isInteger(idx) && idx >= 0 && idx < options.length) &&
    new Set(savedOrder).size === options.length
  ) {
    const displayOptions = savedOrder.map((origIdx) => options[origIdx])
    const displayCorrectOption = savedOrder.findIndex((origIdx) => origIdx === origCorrect)
    return {
      ...q,
      displayOptions,
      displayCorrectOption,
      originalOptionIndices: savedOrder
    }
  }

  if (!q.is_options_randomized || options.length === 0) {
    return {
      ...q,
      displayOptions: options,
      displayCorrectOption: origCorrect,
      originalOptionIndices: options.map((_, index) => index)
    }
  }

  const optionsWithOriginalIdx = options.map((opt, idx) => ({ text: opt, originalIdx: idx }))
  const shuffledOptions = shuffleArray(optionsWithOriginalIdx)
  const newCorrectIdx = shuffledOptions.findIndex((item) => item.originalIdx === origCorrect)

  return {
    ...q,
    displayOptions: shuffledOptions.map((item) => item.text),
    displayCorrectOption: newCorrectIdx,
    originalOptionIndices: shuffledOptions.map((item) => item.originalIdx)
  }
}

export function gradeExamAnswers(questions, userAnswers) {
  let totalScore = 0
  const mistakeItems = []
  const answeredQuestionsList = []

  questions.forEach((q) => {
    const selectedDisplayIdx = userAnswers[q.id]
    // Unanswered questions are NEVER graded as mistakes and NEVER pushed to MistakeBank
    if (selectedDisplayIdx === undefined || selectedDisplayIdx === null) return

    answeredQuestionsList.push(q)
    const isCorrect = selectedDisplayIdx === q.displayCorrectOption

    if (isCorrect) {
      totalScore += 1
    } else {
      const originalUserAnswerIdx = q.originalOptionIndices?.[selectedDisplayIdx]
      mistakeItems.push({
        question_id: q.id,
        user_answer: originalUserAnswerIdx !== undefined ? String(originalUserAnswerIdx) : null,
        is_resolved: false
      })
    }
  })

  return { totalScore, mistakeItems, answeredQuestionsList }
}

export function formatExamTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
