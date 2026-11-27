import {
  convertMathAndTableToPlainText,
  normalizeSectionLabel,
  normalizeSourceQuestionNumber,
  parseAnswerLabelToIndex,
  stripChoicePrefix,
  stripQuestionNumberPrefix
} from '../../shared/utils/examTextFormatUtils'

function extractSectionNumberTag(normalizedSection) {
  if (!normalizedSection) return ''
  const match = normalizedSection.match(
    /(?:ชุดที่|บทที่|ตอนที่|ส่วนที่|หน่วยที่|เรื่องที่|part|set|chapter|unit|section)\s*(\d+)/i
  )
  if (match) return match[1]
  return ''
}

function sectionsMatch(sectionA, sectionB) {
  const normA = normalizeSectionLabel(sectionA)
  const normB = normalizeSectionLabel(sectionB)
  if (!normA || !normB) return false
  if (normA === normB) return true
  if (normA.includes(normB) || normB.includes(normA)) return true

  const numA = extractSectionNumberTag(normA)
  const numB = extractSectionNumberTag(normB)
  return Boolean(numA && numB && numA === numB)
}

function segmentIntoNumberedBlocks(entries, getNum, getSection, getPage) {
  const blocks = []
  let current = null

  for (const entry of entries) {
    const numStr = normalizeSourceQuestionNumber(getNum(entry))
    const numVal = parseInt(numStr, 10)
    const sec = normalizeSectionLabel(getSection(entry))
    const page = Number(getPage(entry)) || 0

    const shouldStartNewBlock =
      !current ||
      (sec && current.section && !sectionsMatch(sec, current.section)) ||
      (Number.isFinite(numVal) && current.lastNum !== null && numVal < current.lastNum && numVal <= 5)

    if (shouldStartNewBlock) {
      current = {
        index: blocks.length,
        section: sec,
        startPage: page,
        endPage: page,
        lastNum: Number.isFinite(numVal) ? numVal : null,
        items: []
      }
      blocks.push(current)
    } else {
      if (!current.section && sec) current.section = sec
      current.endPage = Math.max(current.endPage, page)
      if (Number.isFinite(numVal)) current.lastNum = numVal
    }

    current.items.push(entry)
  }

  return blocks
}

export function validateAndFormatPass1Question(rawItem) {
  if (!rawItem || typeof rawItem !== 'object') {
    return { valid: false, reason: 'invalid_structure' }
  }

  if (rawItem.has_image === true || rawItem.requires_image === true) {
    return { valid: false, reason: 'has_image' }
  }

  const rawOptions = Array.isArray(rawItem.options) ? rawItem.options : []
  if (rawOptions.length < 4 || rawOptions.length > 5) {
    return { valid: false, reason: 'invalid_option_count' }
  }

  const formattedOptions = rawOptions.map((opt) =>
    convertMathAndTableToPlainText(stripChoicePrefix(String(opt ?? '')))
  )

  if (formattedOptions.some((opt) => !opt.trim())) {
    return { valid: false, reason: 'empty_option' }
  }

  const rawStem = String(rawItem.question_text ?? rawItem.question ?? '')
  const { cleanedText: stemWithoutNum, detectedNumber } = stripQuestionNumberPrefix(rawStem)
  const questionText = convertMathAndTableToPlainText(stemWithoutNum)

  if (!questionText.trim()) {
    return { valid: false, reason: 'empty_question' }
  }

  const sourceQuestionNumber = normalizeSourceQuestionNumber(
    rawItem.source_question_number ?? rawItem.question_number ?? detectedNumber
  )
  const sourceSection = String(rawItem.source_section ?? rawItem.section ?? '').trim()
  const sourcePage =
    Number.isInteger(Number(rawItem.source_page)) && Number(rawItem.source_page) > 0
      ? Number(rawItem.source_page)
      : null

  let bookAnswer = null
  const hasExplicitInline =
    rawItem.has_inline_answer === true ||
    rawItem.answer_source === 'document' ||
    (rawItem.book_answer !== undefined && rawItem.book_answer !== null && rawItem.book_answer !== '')

  if (hasExplicitInline) {
    const rawBookAns = rawItem.book_answer ?? rawItem.inline_answer_index ?? rawItem.correct_option
    if (
      typeof rawBookAns === 'number' &&
      Number.isInteger(rawBookAns) &&
      rawBookAns >= 0 &&
      rawBookAns < formattedOptions.length
    ) {
      bookAnswer = rawBookAns
    } else if (
      typeof rawBookAns === 'string' &&
      /^\d+$/.test(rawBookAns.trim()) &&
      Number(rawBookAns.trim()) >= 0 &&
      Number(rawBookAns.trim()) < formattedOptions.length &&
      rawItem.book_answer_label === undefined
    ) {
      bookAnswer = Number(rawBookAns.trim())
    } else {
      bookAnswer = parseAnswerLabelToIndex(
        rawItem.book_answer_label ?? rawItem.answer_label ?? rawBookAns,
        formattedOptions.length,
        formattedOptions
      )
    }
  }

  const bookExplanation = convertMathAndTableToPlainText(
    String(rawItem.book_explanation ?? rawItem.explanation_from_book ?? '').trim()
  )

  return {
    valid: true,
    question: {
      question_text: questionText,
      options: formattedOptions,
      correct_option: bookAnswer,
      book_answer: bookAnswer,
      book_explanation: bookExplanation || null,
      explanation: bookExplanation || null,
      override_reason: null,
      answer_status: 'pending_answer',
      is_options_randomized: true,
      source_question_number: sourceQuestionNumber || null,
      source_section: sourceSection || null,
      source_page: sourcePage,
      has_source_answer: bookAnswer !== null,
      is_ai_solved: false
    }
  }
}

export function mergeIntoAnswerKeyPool(pool, incomingKeys, fallbackSection, fallbackPage) {
  const nextPool = Array.isArray(pool) ? [...pool] : []
  const seen = new Set(nextPool.map((k) => `${k.section || ''}|${k.question_number || ''}|${k.page_number || 0}`))
  let added = 0

  for (const rawKey of incomingKeys || []) {
    const qNum = normalizeSourceQuestionNumber(rawKey?.source_question_number ?? rawKey?.question_number)
    if (!qNum) continue

    const section = String(rawKey?.source_section ?? rawKey?.section ?? fallbackSection ?? '').trim()
    const pageNumber = Number(rawKey?.source_page ?? rawKey?.page_number) || fallbackPage || 0
    const answerLabel = String(rawKey?.answer_label ?? rawKey?.answer_choice ?? rawKey?.answer ?? '').trim()
    const rawIdx = rawKey?.answer_index
    let answerIndex =
      Number.isInteger(Number(rawIdx)) && rawIdx !== '' && rawIdx !== null ? Number(rawIdx) : null
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

export function matchAnswerKeysToPendingQuestions(pendingQuestions, answerKeyPool) {
  if (!Array.isArray(pendingQuestions) || pendingQuestions.length === 0) {
    return { matched: [], unmatched: [] }
  }
  if (!Array.isArray(answerKeyPool) || answerKeyPool.length === 0) {
    return { matched: [], unmatched: [...pendingQuestions] }
  }

  const orderedQuestions = pendingQuestions.map((q, idx) => ({ ...q, _origIdx: idx }))
  orderedQuestions.sort((a, b) => (Number(a.source_page) || 0) - (Number(b.source_page) || 0) || a._origIdx - b._origIdx)

  const normalizedKeys = answerKeyPool
    .map((key, idx) => ({
      _keyIdx: idx,
      section: String(key?.section ?? key?.source_section ?? '').trim(),
      question_number: normalizeSourceQuestionNumber(key?.question_number ?? key?.source_question_number),
      answer_label: String(key?.answer_label ?? key?.answer_choice ?? key?.answer ?? '').trim(),
      answer_index:
        Number.isInteger(Number(key?.answer_index)) && key?.answer_index !== '' && key?.answer_index !== null
          ? Number(key.answer_index)
          : null,
      book_explanation: convertMathAndTableToPlainText(
        String(key?.book_explanation ?? key?.explanation_from_key ?? key?.explanation ?? '').trim()
      ),
      page_number: Number(key?.page_number ?? key?.source_page) || 0
    }))
    .filter((k) => Boolean(k.question_number))
    .sort((a, b) => a.page_number - b.page_number || a._keyIdx - b._keyIdx)

  const questionBlocks = segmentIntoNumberedBlocks(
    orderedQuestions,
    (q) => q.source_question_number,
    (q) => q.source_section,
    (q) => q.source_page
  )
  const keyBlocks = segmentIntoNumberedBlocks(
    normalizedKeys,
    (k) => k.question_number,
    (k) => k.section,
    (k) => k.page_number
  )

  const usedKeyBlocks = new Set()
  const qBlockToKeyBlock = new Map()

  // Pass A: Exact section match between Question Block and Key Block
  for (const qb of questionBlocks) {
    if (!qb.section) continue
    const matchKb = keyBlocks.find(
      (kb) => !usedKeyBlocks.has(kb.index) && kb.section && sectionsMatch(qb.section, kb.section)
    )
    if (matchKb) {
      qBlockToKeyBlock.set(qb.index, matchKb)
      usedKeyBlocks.add(matchKb.index)
    }
  }

  // Pass B: End-of-chapter proximity
  for (let i = 0; i < questionBlocks.length; i += 1) {
    const qb = questionBlocks[i]
    if (qBlockToKeyBlock.has(qb.index)) continue
    const nextQb = questionBlocks[i + 1]
    const upperBoundPage = nextQb ? nextQb.startPage : Number.MAX_SAFE_INTEGER

    const chapterKb = keyBlocks.find(
      (kb) => !usedKeyBlocks.has(kb.index) && kb.startPage >= qb.endPage && kb.startPage <= upperBoundPage
    )
    if (chapterKb) {
      qBlockToKeyBlock.set(qb.index, chapterKb)
      usedKeyBlocks.add(chapterKb.index)
    }
  }

  // Pass C: Sequential end-of-book mapping
  const remainingQBlocks = questionBlocks.filter((qb) => !qBlockToKeyBlock.has(qb.index))
  const remainingKBlocks = keyBlocks.filter((kb) => !usedKeyBlocks.has(kb.index))
  for (let i = 0; i < Math.min(remainingQBlocks.length, remainingKBlocks.length); i += 1) {
    qBlockToKeyBlock.set(remainingQBlocks[i].index, remainingKBlocks[i])
    usedKeyBlocks.add(remainingKBlocks[i].index)
  }

  const resolveKeyIndexForQuestion = (key, question) => {
    const optionCount = Array.isArray(question.options) ? question.options.length : 0
    if (optionCount < 4 || optionCount > 5) return null

    if (
      key.answer_index !== null &&
      Number.isInteger(key.answer_index) &&
      key.answer_index >= 0 &&
      key.answer_index < optionCount
    ) {
      return key.answer_index
    }
    return parseAnswerLabelToIndex(key.answer_label, optionCount, question.options)
  }

  const usedKeyIds = new Set()
  const matched = []
  const unmatched = []

  for (const qb of questionBlocks) {
    const preferredKb = qBlockToKeyBlock.get(qb.index)

    for (const q of qb.items) {
      const qNum = normalizeSourceQuestionNumber(q.source_question_number)
      if (!qNum) {
        unmatched.push(q)
        continue
      }

      let matchedKey = null

      if (preferredKb) {
        matchedKey =
          preferredKb.items.find((k) => !usedKeyIds.has(k._keyIdx) && k.question_number === qNum) || null
      }

      if (!matchedKey && q.source_section) {
        matchedKey =
          normalizedKeys.find(
            (k) => !usedKeyIds.has(k._keyIdx) && k.question_number === qNum && sectionsMatch(q.source_section, k.section)
          ) || null
      }

      if (!matchedKey && questionBlocks.length === 1) {
        const globalCandidates = normalizedKeys.filter(
          (k) => !usedKeyIds.has(k._keyIdx) && k.question_number === qNum
        )
        if (globalCandidates.length >= 1) {
          matchedKey =
            globalCandidates.find((k) => k.page_number >= (Number(q.source_page) || 0)) || globalCandidates[0]
        }
      } else if (!matchedKey) {
        const globalCandidates = normalizedKeys.filter(
          (k) => !usedKeyIds.has(k._keyIdx) && k.question_number === qNum
        )
        if (globalCandidates.length === 1) {
          matchedKey = globalCandidates[0]
        }
      }

      if (!matchedKey) {
        unmatched.push(q)
        continue
      }

      const resolvedIndex = resolveKeyIndexForQuestion(matchedKey, q)
      if (resolvedIndex === null) {
        unmatched.push(q)
        continue
      }

      usedKeyIds.add(matchedKey._keyIdx)
      matched.push({
        question: q,
        book_answer: resolvedIndex,
        book_explanation: matchedKey.book_explanation || q.book_explanation || null,
        matched_key_page: matchedKey.page_number,
        matched_key_section: matchedKey.section || null
      })
    }
  }

  return { matched, unmatched }
}
