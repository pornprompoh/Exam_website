// Pure text normalization, prefix stripping, Unicode math/table conversion & exact-match utils

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙'

export function thaiDigitsToArabic(value) {
  return String(value ?? '').replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)))
}

export function stripQuestionNumberPrefix(rawText) {
  const normalizedLineEndings = String(rawText ?? '').replace(/\r\n?/g, '\n')
  const trimmedStart = normalizedLineEndings.trimStart()

  const patterns = [
    /^ข้อ(?:ที่)?\s*([0-9๐-๙]{1,4})\s*(?:[.):\-–—]\s*|\s+)/,
    /^(?:Question|Q|No)\.?\s*([0-9]{1,4})\s*[.):\-–—]\s+/i,
    /^[([]\s*([0-9๐-๙]{1,4})\s*[)\]]\s*[.:\-–—]?\s+/,
    /^([0-9๐-๙]{1,4})\s*[.)](?!\d)\s+/,
    /^([0-9๐-๙]{1,4})\s*[:\-–—]\s+(?!\d)/
  ]

  for (const pattern of patterns) {
    const match = trimmedStart.match(pattern)
    if (match) {
      const detectedNumber = thaiDigitsToArabic(match[1]).replace(/^0+(?=\d)/, '')
      const candidate = trimmedStart.slice(match[0].length).trimStart()
      if (candidate.trim().length > 0) {
        return { cleanedText: candidate.trim(), detectedNumber }
      }
    }
  }

  return { cleanedText: normalizedLineEndings.trim(), detectedNumber: '' }
}

export function stripChoicePrefix(rawOption) {
  const normalized = String(rawOption ?? '').replace(/\r\n?/g, '\n').trim()
  if (!normalized) return ''

  const patterns = [
    /^(?:ข้อ|ตัวเลือก)\s*(?:[กขคงจ]|[A-Ea-e]|[1-5๑-๕])\s*[.):\-–—]\s+/,
    /^[([]\s*(?:[กขคงจ]|[A-Ea-e]|[1-5๑-๕])\s*[)\]]\s*[.:\-–—]?\s*/,
    /^[กขคงจ]\s*[.)]\s*/,
    /^[A-Ea-e]\s*(?:\.\s+|\)\s*)/,
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
  0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴',
  5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹',
  '+': '⁺', '-': '⁻', '(': '⁽', ')': '⁾', n: 'ⁿ'
}

const SUBSCRIPT_MAP = {
  0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄',
  5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉',
  '+': '₊', '-': '₋'
}

function toSuperscript(str) {
  const chars = [...str]
  if (chars.every((ch) => SUPERSCRIPT_MAP[ch])) return chars.map((ch) => SUPERSCRIPT_MAP[ch]).join('')
  return `^(${str})`
}

function toSubscript(str) {
  const chars = [...str]
  if (chars.every((ch) => SUBSCRIPT_MAP[ch])) return chars.map((ch) => SUBSCRIPT_MAP[ch]).join('')
  return `_${str}`
}

const LATEX_REPLACEMENTS = [
  [/\\times\b/g, '×'], [/\\cdot\b/g, '·'], [/\\div\b/g, '÷'],
  [/\\pm\b/g, '±'], [/\\mp\b/g, '∓'], [/\\leq?\b/g, '≤'],
  [/\\geq?\b/g, '≥'], [/\\neq?\b/g, '≠'], [/\\approx\b/g, '≈'],
  [/\\equiv\b/g, '≡'], [/\\infty\b/g, '∞'], [/\\pi\b/g, 'π'],
  [/\\theta\b/g, 'θ'], [/\\alpha\b/g, 'α'], [/\\beta\b/g, 'β'],
  [/\\gamma\b/g, 'γ'], [/\\delta\b/g, 'δ'], [/\\Delta\b/g, 'Δ'],
  [/\\lambda\b/g, 'λ'], [/\\mu\b/g, 'μ'], [/\\sigma\b/g, 'σ'],
  [/\\Sigma\b/g, 'Σ'], [/\\Omega\b/g, 'Ω'], [/\\omega\b/g, 'ω'],
  [/\\degree\b|\\circ\b/g, '°'], [/\\rightarrow\b|\\to\b/g, '→'],
  [/\\leftarrow\b/g, '←'], [/\\Rightarrow\b/g, '⇒'], [/\\Leftrightarrow\b/g, '⇔'],
  [/\\in\b/g, '∈'], [/\\notin\b/g, '∉'], [/\\subset\b/g, '⊂'],
  [/\\subseteq\b/g, '⊆'], [/\\cup\b/g, '∪'], [/\\cap\b/g, '∩'],
  [/\\emptyset\b/g, '∅'], [/\\forall\b/g, '∀'], [/\\exists\b/g, '∃'],
  [/\\sum\b/g, '∑'], [/\\int\b/g, '∫'], [/\\angle\b/g, '∠'],
  [/\\perp\b/g, '⊥'], [/\\parallel\b/g, '∥'], [/\\triangle\b/g, '△'],
  [/\\%/g, '%'], [/\\text\{([^{}]*)\}/g, '$1'], [/\\mathrm\{([^{}]*)\}/g, '$1'],
  [/\\mathbf\{([^{}]*)\}/g, '$1'], [/\\left|\\right/g, '']
]

export function convertMathAndTableToPlainText(rawText) {
  let text = String(rawText ?? '').replace(/\r\n?/g, '\n')
  if (!text) return ''

  text = text
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/(^|[^\\])\$([^$\n]+?)\$/g, '$1$2')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$1')
    .replace(/\\\[([\s\S]*?)\\\]/g, '$1')

  for (let pass = 0; pass < 2; pass += 1) {
    text = text.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, num, den) => {
      const cleanNum = num.trim()
      const cleanDen = den.trim()
      const simpleNum = /^[a-zA-Z0-9ก-๛]+$/.test(cleanNum) ? cleanNum : `(${cleanNum})`
      const simpleDen = /^[a-zA-Z0-9ก-๛]+$/.test(cleanDen) ? cleanDen : `(${cleanDen})`
      return `${simpleNum}/${simpleDen}`
    })
  }

  text = text
    .replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, (_, root, body) => `${toSuperscript(root.trim())}√(${body.trim()})`)
    .replace(/\\sqrt\{([^{}]+)\}/g, (_, body) => {
      const trimmed = body.trim()
      return /^[a-zA-Z0-9]+$/.test(trimmed) ? `√${trimmed}` : `√(${trimmed})`
    })

  for (const [regex, symbol] of LATEX_REPLACEMENTS) {
    text = text.replace(regex, symbol)
  }

  text = text
    .replace(/\^\{([^{}]+)\}/g, (_, exp) => toSuperscript(exp.trim()))
    .replace(/\^([0-9n])(?![0-9])/g, (_, exp) => toSuperscript(exp))
    .replace(/_\{([^{}]+)\}/g, (_, sub) => toSubscript(sub.trim()))
    .replace(/_([0-9])(?![0-9])/g, (_, sub) => toSubscript(sub))

  const lines = text.split('\n')
  const cleanedLines = []
  for (const line of lines) {
    if (/^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/.test(line)) continue
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0)
      if (cells.length > 0) cleanedLines.push(cells.join(' | '))
      continue
    }
    cleanedLines.push(line)
  }

  return cleanedLines.join('\n').trim()
}

export function normalizeForStrictExactMatch(questionText) {
  return String(questionText ?? '').replace(/\r\n?/g, '\n').trim()
}

export function parseAnswerLabelToIndex(rawAnswer, optionCount = 5, options = []) {
  if (rawAnswer === null || rawAnswer === undefined || rawAnswer === '') return null

  if (typeof rawAnswer === 'number' && Number.isInteger(rawAnswer)) {
    return rawAnswer >= 0 && rawAnswer < optionCount ? rawAnswer : null
  }

  const trimmed = thaiDigitsToArabic(String(rawAnswer)).trim()
  if (!trimmed) return null

  const stripped = trimmed
    .replace(/^(?:ข้อ|เฉลย|คำตอบ|ตอบ)\s*/i, '')
    .replace(/[()[\].:]/g, '')
    .trim()

  const labelMap = {
    ก: 0, ข: 1, ค: 2, ง: 3, จ: 4,
    a: 0, b: 1, c: 2, d: 3, e: 4,
    1: 0, 2: 1, 3: 2, 4: 3, 5: 4
  }

  const lowered = stripped.toLowerCase()
  if (Object.prototype.hasOwnProperty.call(labelMap, lowered)) {
    const idx = labelMap[lowered]
    return idx < optionCount ? idx : null
  }

  if (Array.isArray(options) && options.length > 0) {
    const cleanTarget = normalizeForStrictExactMatch(stripChoicePrefix(trimmed))
    const matchedIdx = options.findIndex((opt) => normalizeForStrictExactMatch(opt) === cleanTarget)
    if (matchedIdx >= 0 && matchedIdx < optionCount) return matchedIdx
  }

  return null
}

export function normalizeSourceQuestionNumber(value) {
  const raw = thaiDigitsToArabic(String(value ?? '')).trim()
  if (!raw) return ''
  const match = raw.match(/(\d+)/)
  if (match) return match[1].replace(/^0+(?=\d)/, '')
  return raw
}

export function normalizeSectionLabel(value) {
  const arabic = thaiDigitsToArabic(String(value ?? '')).trim().toLowerCase()
  if (!arabic) return ''
  return arabic
    .replace(/^(?:(?:ตารางเฉลย|คำเฉลย|เฉลย|แนวข้อสอบ|แบบทดสอบ|ข้อสอบ)\s*)+/i, '')
    .replace(/\b0+(\d+)/g, '$1')
    .replace(/[\s\-–—_:()[\].]+/g, ' ')
    .trim()
}
