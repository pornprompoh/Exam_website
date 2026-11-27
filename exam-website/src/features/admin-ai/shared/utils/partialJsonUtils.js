// Pure JSON & Partial JSON Recovery utilities for Gemini structured responses

export function parseJsonSafe(rawText) {
  const cleaned = String(rawText ?? '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  if (!cleaned) return null
  try {
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

export function extractCompleteObjectsFromArrayField(jsonText, fieldName) {
  const fieldRegex = new RegExp(`"${fieldName}"\\s*:\\s*\\[`, 'm')
  const match = fieldRegex.exec(jsonText)
  if (!match) return []

  const results = []
  let idx = match.index + match[0].length
  const len = jsonText.length

  while (idx < len) {
    while (idx < len && /[\s,]/.test(jsonText[idx])) idx += 1
    if (idx >= len || jsonText[idx] === ']') break
    if (jsonText[idx] !== '{') break

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

    if (closedAt === -1) break

    const objSlice = jsonText.slice(start, closedAt + 1)
    try {
      results.push(JSON.parse(objSlice))
    } catch {
      // Skip malformed object and continue recovering subsequent complete objects
    }
  }

  return results
}

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
    if (cleaned.startsWith('[')) {
      return extractCompleteObjectsFromArrayField(`{"results":${cleaned}`, 'results')
    }
    return []
  }
}
