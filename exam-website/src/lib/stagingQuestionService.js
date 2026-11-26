import { supabase } from './supabase'
import { fetchAllPaginated, getTableExactCount, runInBatches } from './supabasePagination'
import {
  matchAnswerKeysToPendingQuestions,
  normalizeForStrictExactMatch,
  stripQuestionNumberPrefix
} from './examTextUtils'

const STAGING_TABLE = 'question_staging_items'
const CHECKPOINT_TABLE = 'question_extraction_checkpoints'
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

function readAllLocalCheckpointsForCategory(categoryId) {
  if (typeof window === 'undefined' || !categoryId) return []
  const prefix = `${LOCAL_CHECKPOINT_PREFIX}${categoryId}:`
  const list = []
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        const raw = window.localStorage.getItem(key)
        if (raw) list.push(JSON.parse(raw))
      }
    }
  } catch {
    // Ignore storage errors
  }
  return list
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
  if (error?.code === '42P01' || (msg.includes(STAGING_TABLE) && msg.includes('does not exist'))) {
    return new Error(
      `ยังไม่พบตาราง "${STAGING_TABLE}" ใน Supabase กรุณารันไฟล์ SQL Migration (supabase/migrations/20261126_create_question_staging.sql และ 20261126_upgrade_staging_3pass_pipeline.sql) ก่อนใช้งาน`
    )
  }
  if (
    error?.code === '42703' ||
    msg.includes('answer_status') ||
    msg.includes('book_answer') ||
    msg.includes('override_reason') ||
    msg.includes('verified_by_model')
  ) {
    return new Error(
      'โครงสร้างตาราง Staging ยังไม่อัปเดตเป็นเวอร์ชัน 3-Pass Hybrid กรุณารันไฟล์ SQL Migration (supabase/migrations/20261126_upgrade_staging_3pass_pipeline.sql) บน Supabase ก่อนครับ'
    )
  }
  if (error?.code === '42501' || msg.toLowerCase().includes('row-level security')) {
    return new Error('ไม่มีสิทธิ์เข้าถึงตาราง Staging (จำกัดสิทธิ์เฉพาะผู้ดูแลระบบ Admin ตาม RLS Policy)')
  }
  return new Error(msg || fallbackMessage)
}

/**
 * Derive a reliable `answer_status` even for older rows that might lack the column.
 */
export function resolveItemAnswerStatus(item) {
  if (!item) return 'pending_answer'
  if (['pending_answer', 'book_verified', 'ai_overridden', 'ai_solved'].includes(item.answer_status)) {
    return item.answer_status
  }
  if (item.correct_option === null || item.correct_option === undefined) return 'pending_answer'
  if (item.is_ai_solved) return 'ai_solved'
  return 'book_verified'
}

/**
 * Fetch ALL question_text strings in a category across a single table using
 * `fetchAllPaginated` with deterministic `.order('id', { ascending: true })`
 * so 3,000–10,000+ question banks are 100% deduplicated with zero missed/duplicated rows.
 */
async function fetchAllQuestionTextsFromTable(tableName, categoryId) {
  const rows = await fetchAllPaginated(
    (client) =>
      client
        .from(tableName)
        .select('id, question_text')
        .eq('category_id', categoryId),
    { pageSize: 1000, orderColumn: 'id', ascending: true }
  )

  return rows
    .map((row) => row.question_text)
    .filter((text) => typeof text === 'string' && text.trim())
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
  try {
    return await getTableExactCount(STAGING_TABLE, (q) => q.eq('category_id', categoryId))
  } catch (error) {
    if (error.code === '42P01' || error.code === '42501') return 0
    throw formatSupabaseStagingError(error, 'ไม่สามารถนับจำนวนข้อสอบ Draft ในตาราง Staging ได้')
  }
}

export async function fetchCategoryStagingItems(categoryId) {
  if (!categoryId) return []
  try {
    return await fetchAllPaginated(
      (client) =>
        client
          .from(STAGING_TABLE)
          .select('*')
          .eq('category_id', categoryId)
          .order('created_at', { ascending: true }),
      { pageSize: 1000, orderColumn: 'id', ascending: true }
    )
  } catch (error) {
    throw formatSupabaseStagingError(error, 'ไม่สามารถดึงรายการข้อสอบ Draft ได้')
  }
}

/**
 * Fetch BOTH exact count (`count: 'exact'`) and full paginated items from Supabase
 * so UI Draft counters NEVER drift or truncate at 1,000 rows.
 */
export async function fetchCategoryStagingSnapshot(categoryId) {
  if (!categoryId) return { items: [], exactCount: 0 }
  const [exactCount, items] = await Promise.all([
    fetchCategoryStagingCount(categoryId),
    fetchCategoryStagingItems(categoryId)
  ])
  return {
    items,
    exactCount: Math.max(exactCount, items.length)
  }
}

export async function fetchPendingStagingItems(categoryId, fingerprint = null) {
  if (!categoryId) return []
  try {
    return await fetchAllPaginated(
      (client) => {
        let query = client
          .from(STAGING_TABLE)
          .select('*')
          .eq('category_id', categoryId)
          .eq('answer_status', 'pending_answer')

        if (fingerprint) {
          query = query.eq('source_file_fingerprint', fingerprint)
        }

        return query
          .order('source_page', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true })
      },
      { pageSize: 1000, orderColumn: 'id', ascending: true }
    )
  } catch (error) {
    throw formatSupabaseStagingError(error, 'ไม่สามารถดึงข้อสอบที่รอจับคู่/ตรวจเฉลยได้')
  }
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
  const options = Array.isArray(updatedFields.options)
    ? updatedFields.options.map((opt) => String(opt ?? '').trim())
    : []

  const hasValidCorrectOption =
    updatedFields.correct_option !== null &&
    updatedFields.correct_option !== undefined &&
    updatedFields.correct_option !== '' &&
    Number.isInteger(Number(updatedFields.correct_option)) &&
    Number(updatedFields.correct_option) >= 0 &&
    Number(updatedFields.correct_option) < options.length

  const payload = {
    question_text: String(updatedFields.question_text ?? '').trim(),
    options,
    correct_option: hasValidCorrectOption ? Number(updatedFields.correct_option) : null,
    explanation: String(updatedFields.explanation ?? '').trim() || null
  }

  if (updatedFields.answer_status) {
    payload.answer_status = updatedFields.answer_status
  } else if (hasValidCorrectOption && updatedFields.answer_status === 'pending_answer') {
    payload.answer_status = 'book_verified'
  }

  if (typeof updatedFields.is_ai_solved === 'boolean') {
    payload.is_ai_solved = updatedFields.is_ai_solved
  }
  if (typeof updatedFields.has_source_answer === 'boolean') {
    payload.has_source_answer = updatedFields.has_source_answer
  }
  if (updatedFields.override_reason !== undefined) {
    payload.override_reason = updatedFields.override_reason || null
  }
  if (updatedFields.book_answer !== undefined) {
    payload.book_answer = updatedFields.book_answer
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

/**
 * Interactive Audit Action: Admin confirms AI's override OR reverts back to the original book answer.
 */
export async function resolveStagingOverrideDecision(id, {
  decision, // 'confirm_ai' | 'revert_to_book'
  bookAnswer = null,
  explanation = undefined
}) {
  const payload = {}

  if (decision === 'revert_to_book') {
    if (bookAnswer === null || bookAnswer === undefined || !Number.isInteger(Number(bookAnswer))) {
      throw new Error('ไม่พบเฉลยต้นฉบับจากหนังสือสำหรับย้อนกลับ')
    }
    payload.correct_option = Number(bookAnswer)
    payload.answer_status = 'book_verified'
    payload.is_ai_solved = false
    payload.has_source_answer = true
    if (explanation !== undefined) {
      payload.explanation = String(explanation ?? '').trim() || null
    }
  } else {
    // confirm_ai: keep AI's answer & optional edited explanation
    if (explanation !== undefined) {
      payload.explanation = String(explanation ?? '').trim() || null
    }
  }

  const { data, error } = await supabase
    .from(STAGING_TABLE)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw formatSupabaseStagingError(error, 'ไม่สามารถบันทึกการตัดสินใจเฉลยได้')
  return data
}

export async function deleteStagingItems(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return
  await runInBatches(ids, 200, async (chunkIds) => {
    const { error } = await supabase
      .from(STAGING_TABLE)
      .delete()
      .in('id', chunkIds)
    if (error) throw formatSupabaseStagingError(error, 'ไม่สามารถลบข้อสอบ Draft ได้')
  })
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
 * Pass 2 DB Sync:
 * Matches pending staging questions (`book_answer IS NULL`) for a `(categoryId, fingerprint)`
 * against the full-file `answerKeyPool` and saves matched `book_answer` + `book_explanation`
 * into Supabase (keeping `answer_status = 'pending_answer'` ready for Pass 3 verification).
 */
export async function applyPass2AnswerKeyMatches({
  categoryId,
  fingerprint,
  answerKeyPool
}) {
  const pendingRows = await fetchPendingStagingItems(categoryId, fingerprint)
  const needsMatch = pendingRows.filter((row) => row.book_answer === null || row.book_answer === undefined)
  const alreadyHasBookAnswer = pendingRows.length - needsMatch.length

  const { matched, unmatched } = matchAnswerKeysToPendingQuestions(needsMatch, answerKeyPool)

  let updatedCount = 0
  for (const entry of matched) {
    const { error } = await supabase
      .from(STAGING_TABLE)
      .update({
        book_answer: entry.book_answer,
        correct_option: entry.book_answer,
        has_source_answer: true,
        book_explanation: entry.book_explanation || entry.question.book_explanation || null
      })
      .eq('id', entry.question.id)

    if (!error) updatedCount += 1
  }

  return {
    totalPending: pendingRows.length,
    alreadyHadInlineBookAnswer: alreadyHasBookAnswer,
    matchedFromKeyPool: updatedCount,
    unmatchedForAiSolve: unmatched.length
  }
}

/**
 * Pass 3 Incremental Batch Save:
 * Persists Pass 3 verification / override / solve results immediately after every batch.
 * Never overwrites `book_answer`.
 */
export async function savePass3BatchResults(batchUpdates) {
  if (!Array.isArray(batchUpdates) || batchUpdates.length === 0) return []

  const savedRows = []
  for (const item of batchUpdates) {
    const payload = {
      correct_option: Number(item.correct_option),
      answer_status: item.answer_status,
      is_ai_solved: item.answer_status === 'ai_solved' || item.answer_status === 'ai_overridden',
      has_source_answer: item.answer_status === 'book_verified' || item.answer_status === 'ai_overridden',
      explanation: String(item.explanation ?? '').trim() || null,
      override_reason: item.answer_status === 'ai_overridden'
        ? (String(item.override_reason ?? '').trim() || null)
        : null,
      verified_by_model: item.verified_by_model || null
    }

    const { data, error } = await supabase
      .from(STAGING_TABLE)
      .update(payload)
      .eq('id', item.id)
      .select('*')
      .single()

    if (error) {
      throw formatSupabaseStagingError(error, 'ไม่สามารถบันทึกผล Pass 3 ลงตาราง Staging ได้')
    }
    if (data) savedRows.push(data)
  }

  return savedRows
}

/**
 * Publish selected (or all) staging items into `public.questions`.
 * Blocks any item still in `pending_answer` or missing a valid `correct_option`.
 * Performs a final Category-Scoped Strict Exact Match check against `public.questions`.
 */
export async function publishStagingItems({ categoryId, items, currentUserId }) {
  if (!categoryId) throw new Error('กรุณาเลือกหมวดหมู่วิชาก่อนเผยแพร่')
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('ไม่มีข้อสอบ Draft ที่เลือกสำหรับเผยแพร่')
  }

  const pendingOrIncomplete = items.filter((item) => {
    const status = resolveItemAnswerStatus(item)
    const optionCount = Array.isArray(item.options) ? item.options.length : 0
    return (
      status === 'pending_answer' ||
      item.correct_option === null ||
      item.correct_option === undefined ||
      !Number.isInteger(Number(item.correct_option)) ||
      Number(item.correct_option) < 0 ||
      Number(item.correct_option) >= optionCount
    )
  })

  if (pendingOrIncomplete.length > 0) {
    throw new Error(
      `พบข้อสอบที่ยังรอจับคู่/ตรวจเฉลย (pending_answer) จำนวน ${pendingOrIncomplete.length} ข้อ กรุณากดปุ่ม "ดำเนินการจับคู่และตรวจเฉลยต่อ (Pass 2–3)" หรือแก้ไขระบุเฉลยให้ครบก่อนเผยแพร่ครับ`
    )
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

  const INSERT_BATCH_SIZE = 100
  const publishedStagingIds = []

  for (let i = 0; i < toPublish.length; i += INSERT_BATCH_SIZE) {
    const slice = toPublish.slice(i, i + INSERT_BATCH_SIZE)
    const { error: insertError } = await supabase
      .from('questions')
      .insert(slice.map((entry) => entry.payload))

    if (insertError) {
      if (publishedStagingIds.length > 0) {
        await deleteStagingItems(publishedStagingIds)
      }
      throw new Error(`เผยแพร่ข้อสอบไม่สำเร็จ: ${insertError.message}`)
    }

    publishedStagingIds.push(...slice.map((entry) => entry.stagingId))
  }

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
// Checkpoint Persistence (Supabase + LocalStorage Mirror, includes Answer Key Pool)
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

    if (error) return local

    if (data && local) {
      const dbPass = Number(data.current_pass || 1)
      const localPass = Number(local.current_pass || 1)
      if (dbPass !== localPass) return dbPass > localPass ? data : local
      const dbPoolLen = Array.isArray(data.answer_key_pool) ? data.answer_key_pool.length : 0
      const localPoolLen = Array.isArray(local.answer_key_pool) ? local.answer_key_pool.length : 0
      if (Number(data.last_completed_page || 0) === Number(local.last_completed_page || 0)) {
        return dbPoolLen >= localPoolLen ? data : local
      }
      return Number(data.last_completed_page || 0) >= Number(local.last_completed_page || 0) ? data : local
    }
    return data || local
  } catch {
    return local
  }
}

export async function loadCategoryCheckpoints(categoryId) {
  if (!categoryId) return []
  const localList = readAllLocalCheckpointsForCategory(categoryId)

  try {
    const { data, error } = await supabase
      .from(CHECKPOINT_TABLE)
      .select('*')
      .eq('category_id', categoryId)
      .order('updated_at', { ascending: false })

    if (error) return localList

    const byFingerprint = new Map()
    for (const row of localList) {
      if (row?.source_file_fingerprint) byFingerprint.set(row.source_file_fingerprint, row)
    }
    for (const row of data || []) {
      if (row?.source_file_fingerprint) byFingerprint.set(row.source_file_fingerprint, row)
    }
    return [...byFingerprint.values()]
  } catch {
    return localList
  }
}

export async function saveExtractionCheckpoint(checkpoint) {
  if (!checkpoint?.category_id || !checkpoint?.source_file_fingerprint) return

  const record = {
    category_id: checkpoint.category_id,
    source_file_fingerprint: checkpoint.source_file_fingerprint,
    source_file_name: checkpoint.source_file_name || 'unknown',
    total_pages: Number(checkpoint.total_pages) || 1,
    last_completed_page: Number(checkpoint.last_completed_page) || 0,
    pending_tail_text: checkpoint.pending_tail_text || null,
    pending_tail_page: checkpoint.pending_tail_page || null,
    current_pass: Number(checkpoint.current_pass) || 1,
    last_section: checkpoint.last_section || null,
    answer_key_pool: Array.isArray(checkpoint.answer_key_pool) ? checkpoint.answer_key_pool : [],
    escalation_queue: Array.isArray(checkpoint.escalation_queue) ? checkpoint.escalation_queue : [],
    pass3_processed_count: Number(checkpoint.pass3_processed_count) || 0,
    pass3_total_count: Number(checkpoint.pass3_total_count) || 0,
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
    // LocalStorage mirror preserves checkpoint & Answer Key Pool even if DB table lags
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
