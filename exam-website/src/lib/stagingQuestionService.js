import { supabase } from './supabase'
import {
  convertMathAndTableToPlainText,
  normalizeForStrictExactMatch,
  normalizeSourceQuestionNumber,
  parseAnswerLabelToIndex,
  stripQuestionNumberPrefix
} from './examTextUtils'

const STAGING_TABLE = 'question_staging_items'
const CHECKPOINT_TABLE = 'question_extraction_checkpoints'
const PAGE_FETCH_SIZE = 1000
const LOCAL_CHECKPOINT_PREFIX = 'ai_exam_extractor_checkpoint:'

function getLocalCheckpointKey(categoryId, fingerprint) {
  return `${LOCAL_CHECKPOINT_PREFIX}${categoryId}:${fingerprint}`
}

function readLocalCheckpoint(categoryId, fingerprint) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(getLocalCheckpointKey(categoryId, fingerprint))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeLocalCheckpoint(categoryId, fingerprint, data) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(getLocalCheckpointKey(categoryId, fingerprint), JSON.stringify(data))
  } catch {
    // Ignore storage quota errors
  }
}

function removeLocalCheckpoint(categoryId, fingerprint) {
  if (typeof window === 'undefined') return
  try {
    if (fingerprint) {
      window.localStorage.removeItem(getLocalCheckpointKey(categoryId, fingerprint))
      return
    }
    const prefix = `${LOCAL_CHECKPOINT_PREFIX}${categoryId}:`
    const keysToRemove = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(prefix)) keysToRemove.push(key)
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Ignore storage errors
  }
}

function formatSupabaseStagingError(error, fallbackMessage) {
  const msg = String(error?.message || '')
  if (error?.code === '42P01' || msg.includes(STAGING_TABLE) && msg.includes('does not exist')) {
    return new Error(
      `ยังไม่พบตาราง "${STAGING_TABLE}" ใน Supabase กรุณารันไฟล์ SQL Migration (supabase/migrations/20261126_create_question_staging.sql) ก่อนใช้งาน`
    )
  }
  if (error?.code === '42501' || msg.toLowerCase().includes('row-level security')) {
    return new Error('ไม่มีสิทธิ์เข้าถึงตาราง Staging (จำกัดสิทธิ์เฉพาะผู้ดูแลระบบ Admin ตาม RLS Policy)')
  }
  return new Error(msg || fallbackMessage)
}

/**
 * Fetch ALL question_text strings in a category across a single table using pagination
 * (avoids Supabase's default 1,000 row limit so large question banks are 100% deduplicated).
 */
async function fetchAllQuestionTextsFromTable(tableName, categoryId) {
  const texts = []
  let from = 0

  while (true) {
    const to = from + PAGE_FETCH_SIZE - 1
    const { data, error } = await supabase
      .from(tableName)
      .select('question_text')
      .eq('category_id', categoryId)
      .range(from, to)

    if (error) throw error
    if (!data || data.length === 0) break

    for (const row of data) {
      if (typeof row.question_text === 'string' && row.question_text.trim()) {
        texts.push(row.question_text)
      }
    }

    if (data.length < PAGE_FETCH_SIZE) break
    from += PAGE_FETCH_SIZE
  }

  return texts
}

/**
 * Build a Category-Scoped Strict Exact Match lookup Set across BOTH:
 * 1) `public.questions` (main question bank)
 * 2) `public.question_staging_items` (staging drafts)
 *
 * Uses safe normalization ONLY (CRLF -> LF + trim) after stripping leading question number.
 */
export async function fetchCategoryExactQuestionSet(categoryId, { includeStaging = true } = {}) {
  if (!categoryId) return new Set()

  const mainTexts = await fetchAllQuestionTextsFromTable('questions', categoryId)
  let stagingTexts = []

  if (includeStaging) {
    try {
      stagingTexts = await fetchAllQuestionTextsFromTable(STAGING_TABLE, categoryId)
    } catch (error) {
      throw formatSupabaseStagingError(error, 'ไม่สามารถโหลดข้อมูลโจทย์จากตาราง Staging เพื่อตรวจซ้ำได้')
    }
  }

  const exactSet = new Set()
  const addToSet = (rawText) => {
    const exactRaw = normalizeForStrictExactMatch(rawText)
    if (exactRaw) exactSet.add(exactRaw)
    const { cleanedText } = stripQuestionNumberPrefix(rawText)
    const exactStripped = normalizeForStrictExactMatch(cleanedText)
    if (exactStripped) exactSet.add(exactStripped)
  }

  mainTexts.forEach(addToSet)
  stagingTexts.forEach(addToSet)

  return exactSet
}

export async function fetchCategoryStagingCount(categoryId) {
  if (!categoryId) return 0
  const { count, error } = await supabase
    .from(STAGING_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)

  if (error) {
    // Gracefully return 0 if table isn't migrated yet or non-admin user views QuestionManager
    if (error.code === '42P01' || error.code === '42501') return 0
    throw formatSupabaseStagingError(error, 'ไม่สามารถนับจำนวนข้อสอบ Draft ในตาราง Staging ได้')
  }

  return count || 0
}

export async function fetchCategoryStagingItems(categoryId) {
  if (!categoryId) return []
  const items = []
  let from = 0

  while (true) {
    const to = from + PAGE_FETCH_SIZE - 1
    const { data, error } = await supabase
      .from(STAGING_TABLE)
      .select('*')
      .eq('category_id', categoryId)
      .order('created_at', { ascending: true })
      .range(from, to)

    if (error) throw formatSupabaseStagingError(error, 'ไม่สามารถดึงรายการข้อสอบ Draft ได้')
    if (!data || data.length === 0) break

    items.push(...data)
    if (data.length < PAGE_FETCH_SIZE) break
    from += PAGE_FETCH_SIZE
  }

  return items
}

export async function insertStagingItems(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const { data, error } = await supabase
    .from(STAGING_TABLE)
    .insert(rows)
    .select('*')

  if (error) throw formatSupabaseStagingError(error, 'ไม่สามารถบันทึกข้อสอบลงตาราง Staging ได้')
  return data || []
}

export async function updateStagingItem(id, updatedFields) {
  const payload = {
    question_text: String(updatedFields.question_text ?? '').trim(),
    options: Array.isArray(updatedFields.options)
      ? updatedFields.options.map((opt) => String(opt ?? '').trim())
      : [],
    correct_option: Number(updatedFields.correct_option),
    explanation: String(updatedFields.explanation ?? '').trim() || null
  }
  if (typeof updatedFields.is_ai_solved === 'boolean') {
    payload.is_ai_solved = updatedFields.is_ai_solved
  }
  if (typeof updatedFields.has_source_answer === 'boolean') {
    payload.has_source_answer = updatedFields.has_source_answer
  }

  const { data, error } = await supabase
    .from(STAGING_TABLE)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw formatSupabaseStagingError(error, 'ไม่สามารถอัปเดตข้อสอบ Draft ได้')
  return data
}

export async function deleteStagingItems(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return
  const { error } = await supabase
    .from(STAGING_TABLE)
    .delete()
    .in('id', ids)

  if (error) throw formatSupabaseStagingError(error, 'ไม่สามารถลบข้อสอบ Draft ได้')
}

export async function clearCategoryStagingItems(categoryId, { clearCheckpoints = true } = {}) {
  if (!categoryId) return
  const { error } = await supabase
    .from(STAGING_TABLE)
    .delete()
    .eq('category_id', categoryId)

  if (error) throw formatSupabaseStagingError(error, 'ไม่สามารถล้างข้อสอบ Draft ของหมวดหมู่นี้ได้')

  if (clearCheckpoints) {
    removeLocalCheckpoint(categoryId, null)
    try {
      await supabase
        .from(CHECKPOINT_TABLE)
        .delete()
        .eq('category_id', categoryId)
    } catch {
      // Ignore if checkpoint table is unavailable
    }
  }
}

/**
 * Map standalone answer keys (end-of-chapter / end-of-book) back to matching items
 * in `question_staging_items` for the same `(categoryId, fingerprint)`.
 */
export async function applyAnswerKeysToStagingItems({
  categoryId,
  fingerprint,
  answerKeys,
  regenerateExplanationsFn
}) {
  if (!categoryId || !fingerprint || !Array.isArray(answerKeys) || answerKeys.length === 0) {
    return { updatedCount: 0, updatedItems: [] }
  }

  const { data: existingRows, error } = await supabase
    .from(STAGING_TABLE)
    .select('*')
    .eq('category_id', categoryId)
    .eq('source_file_fingerprint', fingerprint)
    .order('created_at', { ascending: true })

  if (error) throw formatSupabaseStagingError(error, 'ไม่สามารถจับคู่เฉลยกับข้อสอบใน Staging ได้')
  if (!existingRows || existingRows.length === 0) {
    return { updatedCount: 0, updatedItems: [] }
  }

  // Build candidate matches; prefer section match + unresolved (`has_source_answer === false`)
  const updatesToApply = []
  const itemsNeedingExplanation = []
  const matchedIds = new Set()

  for (const rawKey of answerKeys) {
    const qNum = normalizeSourceQuestionNumber(rawKey?.source_question_number ?? rawKey?.question_number)
    if (!qNum) continue

    const keySection = String(rawKey?.source_section ?? rawKey?.section ?? '').trim().toLowerCase()

    const candidates = existingRows.filter((row) => (
      !matchedIds.has(row.id) &&
      normalizeSourceQuestionNumber(row.source_question_number) === qNum
    ))

    if (candidates.length === 0) continue

    // Priority 1: exact section match + unresolved
    // Priority 2: exact section match
    // Priority 3: unresolved item closest before the answer key page
    // Priority 4: latest unresolved item / first candidate
    const keyPage = Number(rawKey?.source_page) || Number.MAX_SAFE_INTEGER

    let target = null
    if (keySection) {
      target =
        candidates.find((r) => (r.source_section || '').trim().toLowerCase() === keySection && !r.has_source_answer) ||
        candidates.find((r) => (r.source_section || '').trim().toLowerCase() === keySection)
    }
    if (!target) {
      const beforeKeyPage = candidates.filter((r) => (r.source_page || 0) <= keyPage)
      const unresolvedBefore = beforeKeyPage.filter((r) => !r.has_source_answer)
      if (unresolvedBefore.length > 0) {
        // Choose the most recent section/chapter item prior to this answer key
        target = unresolvedBefore[unresolvedBefore.length - 1]
      } else {
        const unresolvedAny = candidates.filter((r) => !r.has_source_answer)
        target = unresolvedAny[0] || beforeKeyPage[beforeKeyPage.length - 1] || candidates[0]
      }
    }

    if (!target) continue

    const optionCount = Array.isArray(target.options) ? target.options.length : 0
    let answerIdx = Number.isInteger(Number(rawKey?.answer_index)) && rawKey.answer_index !== '' && rawKey.answer_index !== null
      ? Number(rawKey.answer_index)
      : null

    if (answerIdx === null || answerIdx < 0 || answerIdx >= optionCount) {
      answerIdx = parseAnswerLabelToIndex(
        rawKey?.answer_label ?? rawKey?.answer ?? rawKey?.correct_option,
        optionCount,
        target.options
      )
    }

    if (answerIdx === null || answerIdx < 0 || answerIdx >= optionCount) continue

    matchedIds.add(target.id)
    const keyExplanation = convertMathAndTableToPlainText(
      String(rawKey?.explanation_from_key ?? rawKey?.explanation ?? '').trim()
    )
    const answerChanged = Number(target.correct_option) !== answerIdx

    const nextUpdate = {
      id: target.id,
      target,
      correct_option: answerIdx,
      has_source_answer: true,
      is_ai_solved: false,
      explanation: keyExplanation || target.explanation || ''
    }

    if (!keyExplanation && (answerChanged || !target.explanation)) {
      itemsNeedingExplanation.push(nextUpdate)
    }

    updatesToApply.push(nextUpdate)
  }

  // If official answer keys differed from AI-inferred answers and had no explanation, regenerate concise explanations
  if (itemsNeedingExplanation.length > 0 && typeof regenerateExplanationsFn === 'function') {
    try {
      const regeneratedMap = await regenerateExplanationsFn(
        itemsNeedingExplanation.map((entry) => ({
          id: entry.id,
          question_text: entry.target.question_text,
          options: entry.target.options,
          correct_option: entry.correct_option
        }))
      )
      for (const entry of itemsNeedingExplanation) {
        const freshExp = regeneratedMap?.get(entry.id)
        if (freshExp) {
          entry.explanation = convertMathAndTableToPlainText(freshExp)
        } else if (!entry.explanation || Number(entry.target.correct_option) !== entry.correct_option) {
          const correctText = entry.target.options?.[entry.correct_option] || ''
          entry.explanation = `เฉลยตามเอกสารคือ "${correctText}"`
        }
      }
    } catch (expError) {
      console.warn('สร้างคำอธิบายใหม่หลังจับคู่เฉลยไม่สำเร็จ ใช้ข้อความสำรองแทน:', expError)
      for (const entry of itemsNeedingExplanation) {
        if (Number(entry.target.correct_option) !== entry.correct_option || !entry.explanation) {
          const correctText = entry.target.options?.[entry.correct_option] || ''
          entry.explanation = `เฉลยตามเอกสารคือ "${correctText}"`
        }
      }
    }
  }

  const updatedItems = []
  for (const update of updatesToApply) {
    const { data, error: updateErr } = await supabase
      .from(STAGING_TABLE)
      .update({
        correct_option: update.correct_option,
        has_source_answer: true,
        is_ai_solved: false,
        explanation: update.explanation || null
      })
      .eq('id', update.id)
      .select('*')
      .single()

    if (!updateErr && data) {
      updatedItems.push(data)
    }
  }

  return {
    updatedCount: updatedItems.length,
    updatedItems
  }
}

/**
 * Publish selected (or all) staging items into `public.questions`.
 * Performs a final Category-Scoped Strict Exact Match check against `public.questions`,
 * inserts valid non-duplicate items, and deletes published items from Staging.
 */
export async function publishStagingItems({ categoryId, items, currentUserId }) {
  if (!categoryId) throw new Error('กรุณาเลือกหมวดหมู่วิชาก่อนเผยแพร่')
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('ไม่มีข้อสอบ Draft ที่เลือกสำหรับเผยแพร่')
  }

  // Final category-scoped strict exact match check against main `questions` table
  const mainExactSet = await fetchCategoryExactQuestionSet(categoryId, { includeStaging: false })
  const batchSeen = new Set()

  const toPublish = []
  const skippedDuplicates = []

  for (const item of items) {
    const cleanQuestionText = normalizeForStrictExactMatch(
      stripQuestionNumberPrefix(item.question_text).cleanedText
    )
    const cleanOptions = (item.options || []).map((opt) => String(opt ?? '').trim())

    if (!cleanQuestionText || cleanOptions.length < 4 || cleanOptions.length > 5 || cleanOptions.some((o) => !o)) {
      throw new Error(`ข้อสอบ "${(item.question_text || '').slice(0, 40)}..." มีข้อมูลโจทย์หรือตัวเลือกไม่ครบถ้วน`)
    }

    if (mainExactSet.has(cleanQuestionText) || batchSeen.has(cleanQuestionText)) {
      skippedDuplicates.push(item)
      continue
    }

    batchSeen.add(cleanQuestionText)
    toPublish.push({
      stagingId: item.id,
      payload: {
        category_id: categoryId,
        question_text: cleanQuestionText,
        options: cleanOptions,
        correct_option: Number(item.correct_option),
        explanation: String(item.explanation || '').trim() || null,
        is_options_randomized: item.is_options_randomized ?? true,
        image_url: item.image_url || null,
        explanation_image_url: item.explanation_image_url || null,
        is_active: true,
        created_by: currentUserId || item.created_by || null
      }
    })
  }

  // Insert in safe chunks of 100 rows to handle very large publishes (e.g. 500+ questions)
  const INSERT_BATCH_SIZE = 100
  const publishedStagingIds = []

  for (let i = 0; i < toPublish.length; i += INSERT_BATCH_SIZE) {
    const slice = toPublish.slice(i, i + INSERT_BATCH_SIZE)
    const { error: insertError } = await supabase
      .from('questions')
      .insert(slice.map((entry) => entry.payload))

    if (insertError) {
      // Remove any previously published batches from staging before throwing
      if (publishedStagingIds.length > 0) {
        await deleteStagingItems(publishedStagingIds)
      }
      throw new Error(`เผยแพร่ข้อสอบไม่สำเร็จ: ${insertError.message}`)
    }

    publishedStagingIds.push(...slice.map((entry) => entry.stagingId))
  }

  // Clean up published items from staging (also remove exact duplicates from staging if desired?
  // Keep duplicates out of main table and remove only published items so admin can inspect/delete duplicates)
  for (let i = 0; i < publishedStagingIds.length; i += INSERT_BATCH_SIZE) {
    await deleteStagingItems(publishedStagingIds.slice(i, i + INSERT_BATCH_SIZE))
  }

  return {
    publishedCount: publishedStagingIds.length,
    skippedDuplicatesCount: skippedDuplicates.length,
    skippedDuplicates
  }
}

// ============================================================================
// Checkpoint Persistence (Supabase + LocalStorage Mirror)
// ============================================================================

export async function loadExtractionCheckpoint(categoryId, fingerprint) {
  if (!categoryId || !fingerprint) return null
  const local = readLocalCheckpoint(categoryId, fingerprint)

  try {
    const { data, error } = await supabase
      .from(CHECKPOINT_TABLE)
      .select('*')
      .eq('category_id', categoryId)
      .eq('source_file_fingerprint', fingerprint)
      .maybeSingle()

    if (error) {
      return local
    }

    if (data && local) {
      return Number(data.last_completed_page || 0) >= Number(local.last_completed_page || 0) ? data : local
    }
    return data || local
  } catch {
    return local
  }
}

export async function saveExtractionCheckpoint(checkpoint) {
  if (!checkpoint?.category_id || !checkpoint?.source_file_fingerprint) return

  const record = {
    category_id: checkpoint.category_id,
    source_file_fingerprint: checkpoint.source_file_fingerprint,
    source_file_name: checkpoint.source_file_name,
    total_pages: Number(checkpoint.total_pages) || 1,
    last_completed_page: Number(checkpoint.last_completed_page) || 0,
    pending_tail_text: checkpoint.pending_tail_text || null,
    pending_tail_page: checkpoint.pending_tail_page || null,
    stats: checkpoint.stats || {},
    status: checkpoint.status || 'in_progress',
    created_by: checkpoint.created_by || null
  }

  writeLocalCheckpoint(record.category_id, record.source_file_fingerprint, {
    ...record,
    updated_at: new Date().toISOString()
  })

  try {
    await supabase
      .from(CHECKPOINT_TABLE)
      .upsert(record, { onConflict: 'category_id,source_file_fingerprint' })
  } catch {
    // LocalStorage mirror keeps checkpoint safe even if table isn't migrated yet
  }
}

export async function clearExtractionCheckpoint(categoryId, fingerprint) {
  if (!categoryId || !fingerprint) return
  removeLocalCheckpoint(categoryId, fingerprint)

  try {
    await supabase
      .from(CHECKPOINT_TABLE)
      .delete()
      .eq('category_id', categoryId)
      .eq('source_file_fingerprint', fingerprint)
  } catch {
    // Ignore if checkpoint table doesn't exist
  }
}
