const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙'

export function thaiDigitsToArabic(value) {
  return String(value ?? '').replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)))
}

/**
 * Strip leading question numbers (e.g., "1.", "1)", "ข้อ 1.", "ข้อที่ ๑", "(1)", "Q1.")
 * WITHOUT removing numbers that belong to the actual question content
 * (e.g., "2567 เป็นปี...", "1.5 กิโลเมตร...", "10 + 5 เท่ากับเท่าไร").
 */
export function stripQuestionNumberPrefix(rawText) {
  const normalizedLineEndings = String(rawText ?? '').replace(/\r\n?/g, '\n')
  const trimmedStart = normalizedLineEndings.trimStart()

  const patterns = [
    // "ข้อที่ 12.", "ข้อ 12)", "ข้อ ๑๒ :", "ข้อที่ 12 "
    /^ข้อ(?:ที่)?\s*([0-9๐-๙]{1,4})\s*(?:[.):\-–—]\s*|\s+)/,
    // "Q12.", "Q. 12)", "Question 12:", "No. 12."
    /^(?:Question|Q|No)\.?\s*([0-9]{1,4})\s*[.):\-–—]\s+/i,
    // "(12) ...", "[12] ..."
    /^[([]\s*([0-9๐-๙]{1,4})\s*[)\]]\s*[.:\-–—]?\s+/,
    // "12. ...", "12) ...", "๑๒. ..." — guard against decimals like "1.5 " with (?!\d)
    /^([0-9๐-๙]{1,4})\s*[.)](?!\d)\s+/,
    // "12 : ..." or "12 - ..." (only when followed by space)
    /^([0-9๐-๙]{1,4})\s*[:\-–—]\s+(?!\d)/
  ]

  for (const pattern of patterns) {
    const match = trimmedStart.match(pattern)
    if (match) {
      const detectedNumber = thaiDigitsToArabic(match[1]).replace(/^0+(?=\d)/, '')
      const candidate = trimmedStart.slice(match[0].length).trimStart()
      // Never strip if it would leave an empty string
      if (candidate.trim().length > 0) {
        return {
          cleanedText: candidate.trim(),
          detectedNumber
        }
      }
    }
  }

  return {
    cleanedText: normalizedLineEndings.trim(),
    detectedNumber: ''
  }
}

/**
 * Strip leading choice prefixes (e.g., "ก.", "ข.", "ค.", "ง.", "จ.",
 * "A.", "B.", "C.", "D.", "E.", "1.", "(ก)", "[A]", "1)")
 * so choices work seamlessly with Fisher-Yates choice shuffling in ExamSession.jsx.
 */
export function stripChoicePrefix(rawOption) {
  const normalized = String(rawOption ?? '').replace(/\r\n?/g, '\n').trim()
  if (!normalized) return ''

  const patterns = [
    // "ข้อ ก.", "ตัวเลือก ก.", "ข้อ 1."
    /^(?:ข้อ|ตัวเลือก)\s*(?:[กขคงจ]|[A-Ea-e]|[1-5๑-๕])\s*[.):\-–—]\s+/,
    // "(ก) ...", "[ก] ...", "(A) ...", "[B] ...", "(1) ...", "(๑) ..."
    /^[([]\s*(?:[กขคงจ]|[A-Ea-e]|[1-5๑-๕])\s*[)\]]\s*[.:\-–—]?\s*/,
    // "ก. ...", "ข) ...", "ค. ..." (allow optional space after dot/paren for Thai choices like "ก.ประเทศไทย")
    /^[กขคงจ]\s*[.)]\s*/,
    // "A. ...", "B) ...", "c. ..." — require at least one space or closing paren so abbreviations like "A.D." stay intact
    /^[A-Ea-e]\s*(?:\.\s+|\)\s*)/,
    // "1. ...", "2) ...", "๑. ..." — guard against decimals like "1.5" with (?!\d)
    /^[1-5๑-๕]\s*[.)](?!\d)\s+/
  ]

  let cleaned = normalized
  for (const pattern of patterns) {
    const match = cleaned.match(pattern)
    if (match) {
      const candidate = cleaned.slice(match[0].length).trim()
      if (candidate.length > 0) {
        cleaned = candidate
        break
      }
    }
  }

  return cleaned
}

const SUPERSCRIPT_MAP = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '(': '⁽', ')': '⁾', 'n': 'ⁿ'
}

const SUBSCRIPT_MAP = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋'
}

function toSuperscript(str) {
  const chars = [...str]
  if (chars.every((ch) => SUPERSCRIPT_MAP[ch])) {
    return chars.map((ch) => SUPERSCRIPT_MAP[ch]).join('')
  }
  return `^(${str})`
}

function toSubscript(str) {
  const chars = [...str]
  if (chars.every((ch) => SUBSCRIPT_MAP[ch])) {
    return chars.map((ch) => SUBSCRIPT_MAP[ch]).join('')
  }
  return `_${str}`
}

/**
 * Safety post-processor to convert any stray LaTeX math or Markdown pipe tables
 * into clean, readable Unicode plain text suitable for plain-text UI rendering.
 */
export function convertMathAndTableToPlainText(rawText) {
  let text = String(rawText ?? '').replace(/\r\n?/g, '\n')
  if (!text) return ''

  // Strip LaTeX delimiters $$...$$, $...$, \(...\), \[...\]
  text = text
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/(^|[^\\])\$([^$\n]+?)\$/g, '$1$2')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$1')
    .replace(/\\\[([\s\S]*?)\\\]/g, '$1')

  // Convert \frac{a}{b} -> (a)/(b) or a/b for simple tokens (handle up to 2 nesting passes)
  for (let pass = 0; pass < 2; pass += 1) {
    text = text.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, num, den) => {
      const cleanNum = num.trim()
      const cleanDen = den.trim()
      const simpleNum = /^[a-zA-Z0-9ก-๛]+$/.test(cleanNum) ? cleanNum : `(${cleanNum})`
      const simpleDen = /^[a-zA-Z0-9ก-๛]+$/.test(cleanDen) ? cleanDen : `(${cleanDen})`
      return `${simpleNum}/${simpleDen}`
    })
  }

  // Convert \sqrt[n]{x} and \sqrt{x}
  text = text
    .replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, (_, root, body) => `${toSuperscript(root.trim())}√(${body.trim()})`)
    .replace(/\\sqrt\{([^{}]+)\}/g, (_, body) => {
      const trimmed = body.trim()
      return /^[a-zA-Z0-9]+$/.test(trimmed) ? `√${trimmed}` : `√(${trimmed})`
    })

  // Common LaTeX commands -> Unicode symbols
  const latexReplacements = [
    [/\\times\b/g, '×'],
    [/\\cdot\b/g, '·'],
    [/\\div\b/g, '÷'],
    [/\\pm\b/g, '±'],
    [/\\mp\b/g, '∓'],
    [/\\leq?\b/g, '≤'],
    [/\\geq?\b/g, '≥'],
    [/\\neq?\b/g, '≠'],
    [/\\approx\b/g, '≈'],
    [/\\equiv\b/g, '≡'],
    [/\\infty\b/g, '∞'],
    [/\\pi\b/g, 'π'],
    [/\\theta\b/g, 'θ'],
    [/\\alpha\b/g, 'α'],
    [/\\beta\b/g, 'β'],
    [/\\gamma\b/g, 'γ'],
    [/\\delta\b/g, 'δ'],
    [/\\Delta\b/g, 'Δ'],
    [/\\lambda\b/g, 'λ'],
    [/\\mu\b/g, 'μ'],
    [/\\sigma\b/g, 'σ'],
    [/\\Sigma\b/g, 'Σ'],
    [/\\Omega\b/g, 'Ω'],
    [/\\omega\b/g, 'ω'],
    [/\\degree\b|\\circ\b/g, '°'],
    [/\\rightarrow\b|\\to\b/g, '→'],
    [/\\leftarrow\b/g, '←'],
    [/\\Rightarrow\b/g, '⇒'],
    [/\\Leftrightarrow\b/g, '⇔'],
    [/\\in\b/g, '∈'],
    [/\\notin\b/g, '∉'],
    [/\\subset\b/g, '⊂'],
    [/\\subseteq\b/g, '⊆'],
    [/\\cup\b/g, '∪'],
    [/\\cap\b/g, '∩'],
    [/\\emptyset\b/g, '∅'],
    [/\\forall\b/g, '∀'],
    [/\\exists\b/g, '∃'],
    [/\\sum\b/g, '∑'],
    [/\\int\b/g, '∫'],
    [/\\angle\b/g, '∠'],
    [/\\perp\b/g, '⊥'],
    [/\\parallel\b/g, '∥'],
    [/\\triangle\b/g, '△'],
    [/\\%/g, '%'],
    [/\\text\{([^{}]*)\}/g, '$1'],
    [/\\mathrm\{([^{}]*)\}/g, '$1'],
    [/\\mathbf\{([^{}]*)\}/g, '$1'],
    [/\\left|\\right/g, '']
  ]

  for (const [regex, symbol] of latexReplacements) {
    text = text.replace(regex, symbol)
  }

  // Convert ^{...}, ^2, ^3, _{...}, _2
  text = text
    .replace(/\^\{([^{}]+)\}/g, (_, exp) => toSuperscript(exp.trim()))
    .replace(/\^([0-9n])(?![0-9])/g, (_, exp) => toSuperscript(exp))
    .replace(/_\{([^{}]+)\}/g, (_, sub) => toSubscript(sub.trim()))
    .replace(/_([0-9])(?![0-9])/g, (_, sub) => toSubscript(sub))

  // Clean Markdown pipe tables into clean plain-text lines
  const lines = text.split('\n')
  const cleanedLines = []
  for (const line of lines) {
    // Skip markdown table divider rows like | --- | :---: |
    if (/^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/.test(line)) {
      continue
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0)
      if (cells.length > 0) {
        cleanedLines.push(cells.join(' | '))
      }
      continue
    }
    cleanedLines.push(line)
  }

  return cleanedLines.join('\n').trim()
}

/**
 * Category-Scoped Strict Exact Match Normalization (Requirement 7):
 * Applied AFTER stripping leading question numbers.
 * ONLY trims leading/trailing whitespace and normalizes CRLF -> LF.
 * NEVER alters Thai vowels, tone marks, casing, or punctuation.
 */
export function normalizeForStrictExactMatch(questionText) {
  return String(questionText ?? '')
    .replace(/\r\n?/g, '\n')
    .trim()
}

/**
 * Normalize an answer label (e.g., "ก", "ข.", "B", "(3)", "๔", 2) to a 0-based index.
 * Returns null if invalid or out of range.
 */
export function parseAnswerLabelToIndex(rawAnswer, optionCount = 5, options = []) {
  if (rawAnswer === null || rawAnswer === undefined || rawAnswer === '') return null

  if (typeof rawAnswer === 'number' && Number.isInteger(rawAnswer)) {
    if (rawAnswer >= 0 && rawAnswer < optionCount) return rawAnswer
    return null
  }

  const trimmed = thaiDigitsToArabic(String(rawAnswer)).trim()
  if (!trimmed) return null

  // Pure 0-based integer string if explicitly numeric from structured JSON? Careful:
  // In Thai answer keys, "1" means choice 1 (index 0), whereas in JSON `answer_index` is 0-based.
  // So this helper handles human labels ("ก", "ข", "ค", "ง", "จ", "A"-"E", "1"-"5").
  const stripped = trimmed
    .replace(/^(?:ข้อ|เฉลย|คำตอบ|ตอบ)\s*/i, '')
    .replace(/[()[\].:]/g, '')
    .trim()

  const labelMap = {
    'ก': 0, 'ข': 1, 'ค': 2, 'ง': 3, 'จ': 4,
    'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4,
    '1': 0, '2': 1, '3': 2, '4': 3, '5': 4
  }

  const lowered = stripped.toLowerCase()
  if (Object.prototype.hasOwnProperty.call(labelMap, lowered)) {
    const idx = labelMap[lowered]
    return idx < optionCount ? idx : null
  }

  // Fallback: match exact option text
  if (Array.isArray(options) && options.length > 0) {
    const cleanTarget = normalizeForStrictExactMatch(stripChoicePrefix(trimmed))
    const matchedIdx = options.findIndex(
      (opt) => normalizeForStrictExactMatch(opt) === cleanTarget
    )
    if (matchedIdx >= 0 && matchedIdx < optionCount) return matchedIdx
  }

  return null
}

/**
 * Normalize a source question number string for consistent answer-key matching.
 */
export function normalizeSourceQuestionNumber(value) {
  const raw = thaiDigitsToArabic(String(value ?? '')).trim()
  if (!raw) return ''
  const match = raw.match(/(\d+)/)
  if (match) return match[1].replace(/^0+(?=\d)/, '')
  return raw
}

/**
 * Normalize a section/chapter/set label for Pass 2 Answer Key matching
 * (e.g. "เฉลยแนวข้อสอบ ชุดที่ ๒" -> "ชุดที่ 2", "บทที่ 03 กฎหมาย" -> "บทที่ 3 กฎหมาย").
 */
export function normalizeSectionLabel(value) {
  const arabic = thaiDigitsToArabic(String(value ?? '')).trim().toLowerCase()
  if (!arabic) return ''
  return arabic
    .replace(/^(?:(?:ตารางเฉลย|คำเฉลย|เฉลย|แนวข้อสอบ|แบบทดสอบ|ข้อสอบ)\s*)+/i, '')
    .replace(/\b0+(\d+)/g, '$1')
    .replace(/[\s\-–—_:()[\].]+/g, ' ')
    .trim()
}

function extractSectionNumberTag(normalizedSection) {
  if (!normalizedSection) return ''
  const match = normalizedSection.match(/(?:ชุดที่|บทที่|ตอนที่|ส่วนที่|หน่วยที่|เรื่องที่|part|set|chapter|unit|section)\s*(\d+)/i)
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

/**
 * Validate and format a single raw extracted question from Pass 1 (Extract-Only).
 * STRICT PASS 1 RULE:
 * - Never forces AI to guess an answer.
 * - If inline book answer exists -> sets `book_answer` (0-based index) and `has_source_answer = true`.
 * - If no inline answer exists -> `book_answer = null`, `correct_option = null`, `has_source_answer = false`.
 * - Always enters Staging as `answer_status = 'pending_answer'` so Pass 2 & Pass 3 handle matching/auditing uniformly.
 */
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
  const sourcePage = Number.isInteger(Number(rawItem.source_page)) && Number(rawItem.source_page) > 0
    ? Number(rawItem.source_page)
    : null

  // Resolve inline book answer ONLY if explicitly present in the document
  let bookAnswer = null
  const hasExplicitInline =
    rawItem.has_inline_answer === true ||
    rawItem.answer_source === 'document' ||
    (rawItem.book_answer !== undefined && rawItem.book_answer !== null && rawItem.book_answer !== '')

  if (hasExplicitInline) {
    const rawBookAns = rawItem.book_answer ?? rawItem.inline_answer_index ?? rawItem.correct_option
    if (typeof rawBookAns === 'number' && Number.isInteger(rawBookAns) && rawBookAns >= 0 && rawBookAns < formattedOptions.length) {
      bookAnswer = rawBookAns
    } else if (typeof rawBookAns === 'string' && /^\d+$/.test(rawBookAns.trim()) && Number(rawBookAns.trim()) >= 0 && Number(rawBookAns.trim()) < formattedOptions.length && rawItem.book_answer_label === undefined) {
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
      correct_option: bookAnswer, // null when pending match in Pass 2/3
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

/**
 * Segment an ordered list of numbered items (questions or answer keys) into contiguous
 * blocks whenever numbering resets (e.g., 1..50 then 1..50 in a multi-set 300+ page book)
 * or when `section` changes explicitly.
 */
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

/**
 * Pass 2 Full-File Answer Key Matching Algorithm:
 * Matches pending staging questions (`book_answer == null`) against the full-file `answerKeyPool`
 * collected across all chunks in Pass 1.
 *
 * Handles:
 *  - Section/chapter-labeled books ("ชุดที่ 1", "บทที่ 2", etc.)
 *  - Multi-set 300+ page books that reset question numbering back to #1 multiple times
 *  - Both end-of-chapter answer keys AND end-of-book answer key tables
 *  - Validates choice index bounds (4 vs 5 options) cleanly
 */
export function matchAnswerKeysToPendingQuestions(pendingQuestions, answerKeyPool) {
  if (!Array.isArray(pendingQuestions) || pendingQuestions.length === 0) {
    return { matched: [], unmatched: [] }
  }
  if (!Array.isArray(answerKeyPool) || answerKeyPool.length === 0) {
    return { matched: [], unmatched: [...pendingQuestions] }
  }

  // Normalize & sort questions by (source_page, created_at/original order)
  const orderedQuestions = pendingQuestions.map((q, idx) => ({ ...q, _origIdx: idx }))
  orderedQuestions.sort((a, b) => (Number(a.source_page) || 0) - (Number(b.source_page) || 0) || a._origIdx - b._origIdx)

  // Normalize & sort answer keys by (page_number, original order)
  const normalizedKeys = answerKeyPool
    .map((key, idx) => ({
      _keyIdx: idx,
      section: String(key?.section ?? key?.source_section ?? '').trim(),
      question_number: normalizeSourceQuestionNumber(key?.question_number ?? key?.source_question_number),
      answer_label: String(key?.answer_label ?? key?.answer_choice ?? key?.answer ?? '').trim(),
      answer_index: Number.isInteger(Number(key?.answer_index)) && key?.answer_index !== '' && key?.answer_index !== null
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

  // Map each questionBlock -> preferred keyBlock
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

  // Pass B: End-of-chapter proximity (a Key Block that sits right after qb.endPage and before nextQb.startPage)
  for (let i = 0; i < questionBlocks.length; i += 1) {
    const qb = questionBlocks[i]
    if (qBlockToKeyBlock.has(qb.index)) continue
    const nextQb = questionBlocks[i + 1]
    const upperBoundPage = nextQb ? nextQb.startPage : Number.MAX_SAFE_INTEGER

    const chapterKb = keyBlocks.find(
      (kb) =>
        !usedKeyBlocks.has(kb.index) &&
        kb.startPage >= qb.endPage &&
        kb.startPage <= upperBoundPage
    )
    if (chapterKb) {
      qBlockToKeyBlock.set(qb.index, chapterKb)
      usedKeyBlocks.add(chapterKb.index)
    }
  }

  // Pass C: Sequential end-of-book mapping (remaining Question Blocks <-> remaining Key Blocks in order)
  const remainingQBlocks = questionBlocks.filter((qb) => !qBlockToKeyBlock.has(qb.index))
  const remainingKBlocks = keyBlocks.filter((kb) => !usedKeyBlocks.has(kb.index))
  for (let i = 0; i < Math.min(remainingQBlocks.length, remainingKBlocks.length); i += 1) {
    qBlockToKeyBlock.set(remainingQBlocks[i].index, remainingKBlocks[i])
    usedKeyBlocks.add(remainingKBlocks[i].index)
  }

  const resolveKeyIndexForQuestion = (key, question) => {
    const optionCount = Array.isArray(question.options) ? question.options.length : 0
    if (optionCount < 4 || optionCount > 5) return null

    if (key.answer_index !== null && Number.isInteger(key.answer_index) && key.answer_index >= 0 && key.answer_index < optionCount) {
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

      // 1) Look inside the question block's mapped Key Block first
      if (preferredKb) {
        matchedKey = preferredKb.items.find(
          (k) => !usedKeyIds.has(k._keyIdx) && k.question_number === qNum
        ) || null
      }

      // 2) Fallback: exact section match anywhere in the key pool
      if (!matchedKey && q.source_section) {
        matchedKey = normalizedKeys.find(
          (k) => !usedKeyIds.has(k._keyIdx) && k.question_number === qNum && sectionsMatch(q.source_section, k.section)
        ) || null
      }

      // 3) Fallback: unambiguous global match ONLY if there is exactly 1 unused key with that question number
      //    (prevents cross-set collisions in multi-set books where Q#1 appears in Set 1 & Set 2)
      if (!matchedKey && questionBlocks.length === 1) {
        const globalCandidates = normalizedKeys.filter(
          (k) => !usedKeyIds.has(k._keyIdx) && k.question_number === qNum
        )
        if (globalCandidates.length >= 1) {
          // Prefer key occurring on or after the question page
          matchedKey = globalCandidates.find((k) => k.page_number >= (Number(q.source_page) || 0)) || globalCandidates[0]
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

/**
 * Validate and format a single raw extracted question from Gemini.
 * Enforces:
 * - Strictly 4 or 5 options
 * - Stripped question number prefix & choice prefixes
 * - Plain-text math & tables (no raw LaTeX)
 * - Valid 0-based `correct_option` preserving exact answer mapping
 * - Non-empty concise explanation
 */
export function validateAndFormatExtractedQuestion(rawItem) {
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

  // Resolve correct_option preserving exact index mapping
  let correctOption = Number(rawItem.correct_option ?? rawItem.correct_answer)
  if (!Number.isInteger(correctOption) || correctOption < 0 || correctOption >= formattedOptions.length) {
    const parsedFromLabel = parseAnswerLabelToIndex(
      rawItem.answer_label ?? rawItem.correct_label ?? rawItem.correct_option,
      formattedOptions.length,
      formattedOptions
    )
    if (parsedFromLabel === null) {
      return { valid: false, reason: 'invalid_correct_option' }
    }
    correctOption = parsedFromLabel
  }

  const sourceQuestionNumber = normalizeSourceQuestionNumber(
    rawItem.source_question_number ?? rawItem.question_number ?? detectedNumber
  )

  const sourceSection = String(rawItem.source_section ?? rawItem.section ?? '').trim()
  const sourcePage = Number.isInteger(Number(rawItem.source_page)) && Number(rawItem.source_page) > 0
    ? Number(rawItem.source_page)
    : null

  const answerSource = String(rawItem.answer_source ?? '').toLowerCase()
  const hasSourceAnswer = answerSource === 'document' || rawItem.has_source_answer === true
  const isAiSolved = !hasSourceAnswer || rawItem.is_ai_solved === true

  let explanation = convertMathAndTableToPlainText(String(rawItem.explanation ?? '').trim())
  if (!explanation) {
    explanation = `คำตอบที่ถูกต้องคือ "${formattedOptions[correctOption]}" ตามเนื้อหาและหลักการของโจทย์ข้อนี้`
  }

  return {
    valid: true,
    question: {
      question_text: questionText,
      options: formattedOptions,
      correct_option: correctOption,
      explanation,
      is_options_randomized: true,
      source_question_number: sourceQuestionNumber || null,
      source_section: sourceSection || null,
      source_page: sourcePage,
      has_source_answer: hasSourceAnswer && !isAiSolved,
      is_ai_solved: isAiSolved
    }
  }
}

/**
 * Scan a named JSON array property (e.g. `"questions": [ ... ]`) from a possibly
 * truncated JSON string and recover every complete JSON object inside it.
 */
function extractCompleteObjectsFromArrayField(jsonText, fieldName) {
  const fieldRegex = new RegExp(`"${fieldName}"\\s*:\\s*\\[`, 'm')
  const match = fieldRegex.exec(jsonText)
  if (!match) return []

  const results = []
  let idx = match.index + match[0].length
  const len = jsonText.length

  while (idx < len) {
    // Skip whitespace & commas
    while (idx < len && /[\s,]/.test(jsonText[idx])) idx += 1
    if (idx >= len || jsonText[idx] === ']') break
    if (jsonText[idx] !== '{') {
      // Unexpected token inside array (e.g. truncation or non-object); stop scanning this array
      break
    }

    const start = idx
    let depth = 0
    let inString = false
    let escaped = false
    let closedAt = -1

    while (idx < len) {
      const ch = jsonText[idx]
      if (inString) {
        if (escaped) {
          escaped = false
        } else if (ch === '\\') {
          escaped = true
        } else if (ch === '"') {
          inString = false
        }
      } else if (ch === '"') {
        inString = true
      } else if (ch === '{') {
        depth += 1
      } else if (ch === '}') {
        depth -= 1
        if (depth === 0) {
          closedAt = idx
          idx += 1
          break
        }
      }
      idx += 1
    }

    if (closedAt === -1) {
      // Truncated object at the end of response — stop cleanly
      break
    }

    const objSlice = jsonText.slice(start, closedAt + 1)
    try {
      results.push(JSON.parse(objSlice))
    } catch {
      // Skip malformed object and continue recovering subsequent complete objects
    }
  }

  return results
}

/**
 * Parse structured extraction JSON from Gemini with robust Partial JSON Recovery
 * when output is truncated by token limits (`MAX_TOKENS`) or network cutoff.
 */
export function parsePartialExtractionJson(rawText) {
  const cleaned = String(rawText ?? '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  if (!cleaned) {
    return {
      questions: [],
      answer_keys: [],
      skipped_items: [],
      skipped_pages: [],
      incomplete_tail_text: '',
      last_detected_section: '',
      partialRecovered: false,
      parseFailed: true
    }
  }

  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      return {
        questions: parsed,
        answer_keys: [],
        skipped_items: [],
        skipped_pages: [],
        incomplete_tail_text: '',
        last_detected_section: '',
        partialRecovered: false,
        parseFailed: false
      }
    }
    return {
      questions: Array.isArray(parsed?.questions) ? parsed.questions : [],
      answer_keys: Array.isArray(parsed?.answer_keys) ? parsed.answer_keys : [],
      skipped_items: Array.isArray(parsed?.skipped_items) ? parsed.skipped_items : [],
      skipped_pages: Array.isArray(parsed?.skipped_pages) ? parsed.skipped_pages : [],
      incomplete_tail_text: typeof parsed?.incomplete_tail_text === 'string' ? parsed.incomplete_tail_text.trim() : '',
      last_detected_section: typeof parsed?.last_detected_section === 'string' ? parsed.last_detected_section.trim() : '',
      partialRecovered: false,
      parseFailed: false
    }
  } catch {
    // Partial JSON Recovery: salvage all complete objects inside each top-level array
    const questions = extractCompleteObjectsFromArrayField(cleaned, 'questions')
    const answerKeys = extractCompleteObjectsFromArrayField(cleaned, 'answer_keys')
    const skippedItems = extractCompleteObjectsFromArrayField(cleaned, 'skipped_items')
    const skippedPages = extractCompleteObjectsFromArrayField(cleaned, 'skipped_pages')

    const recoveredAny = questions.length > 0 || answerKeys.length > 0 || skippedItems.length > 0 || skippedPages.length > 0
    return {
      questions,
      answer_keys: answerKeys,
      skipped_items: skippedItems,
      skipped_pages: skippedPages,
      incomplete_tail_text: '',
      last_detected_section: '',
      partialRecovered: recoveredAny,
      parseFailed: !recoveredAny
    }
  }
}

/**
 * Parse a Pass 3 batch response (`{"results": [...]}` or `[...]`) with partial recovery
 * in case a batch response is truncated.
 */
export function parsePass3BatchJson(rawText) {
  const cleaned = String(rawText ?? '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  if (!cleaned) return []

  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed
    if (Array.isArray(parsed?.results)) return parsed.results
    return []
  } catch {
    const recoveredResults = extractCompleteObjectsFromArrayField(cleaned, 'results')
    if (recoveredResults.length > 0) return recoveredResults
    // Fallback: try wrapping as {"results": ...} if raw response started with '['
    if (cleaned.startsWith('[')) {
      return extractCompleteObjectsFromArrayField(`{"results":${cleaned}`, 'results')
    }
    return []
  }
}
