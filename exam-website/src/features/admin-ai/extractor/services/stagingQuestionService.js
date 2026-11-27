import { supabase } from '../../../../shared/lib/supabase'
import { fetchAllPaginated, getTableExactCount, runInBatches } from '../../../../shared/lib/supabasePagination'
import { normalizeForStrictExactMatch, stripQuestionNumberPrefix } from '../../shared/utils/examTextFormatUtils'
import { matchAnswerKeysToPendingQuestions } from '../utils/answerKeyMatchingUtils'
import { CHECKPOINT_TABLE, removeLocalCheckpoint } from './extractionCheckpointService'

const STAGING_TABLE = 'question_staging_items'

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

export function resolveItemAnswerStatus(item) {
  if (!item) return 'pending_answer'
  if (['pending_answer', 'book_verified', 'ai_overridden', 'ai_solved'].includes(item.answer_status)) {
    return item.answer_status
  }
  if (item.correct_option === null || item.correct_option === undefined) return 'pending_answer'
  if (item.is_ai_solved) return 'ai_solved'
  return 'book_verified'
}

async function fetchAllQuestionTextsFromTable(tableName, categoryId) {
  const rows = await fetchAllPaginated(
    (client) => client.from(tableName).select('id, question_text').eq('category_id', categoryId),
    { pageSize: 1000, orderColumn: 'id', ascending: true }
  )

  return rows.map((row) => row.question_text).filter((text) => typeof text === 'string' && text.trim())
}

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
  const { data, error } = await supabase.from(STAGING_TABLE).insert(rows).select('*')

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

  const { data, error } = await supabase.from(STAGING_TABLE).update(payload).eq('id', id).select('*').single()

  if (error) throw formatSupabaseStagingError(error, 'ไม่สามารถอัปเดตข้อสอบ Draft ได้')
  return data
}

export async function resolveStagingOverrideDecision(
  id,
  { decision, bookAnswer = null, explanation = undefined }
) {
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
    if (explanation !== undefined) {
      payload.explanation = String(explanation ?? '').trim() || null
    }
  }

  const { data, error } = await supabase.from(STAGING_TABLE).update(payload).eq('id', id).select('*').single()

  if (error) throw formatSupabaseStagingError(error, 'ไม่สามารถบันทึกการตัดสินใจเฉลยได้')
  return data
}

export async function deleteStagingItems(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return
  await runInBatches(ids, 200, async (chunkIds) => {
    const { error } = await supabase.from(STAGING_TABLE).delete().in('id', chunkIds)
    if (error) throw formatSupabaseStagingError(error, 'ไม่สามารถลบข้อสอบ Draft ได้')
  })
}

export async function clearCategoryStagingItems(categoryId, { clearCheckpoints = true } = {}) {
  if (!categoryId) return
  const { error } = await supabase.from(STAGING_TABLE).delete().eq('category_id', categoryId)

  if (error) throw formatSupabaseStagingError(error, 'ไม่สามารถล้างข้อสอบ Draft ของหมวดหมู่นี้ได้')

  if (clearCheckpoints) {
    removeLocalCheckpoint(categoryId, null)
    try {
      await supabase.from(CHECKPOINT_TABLE).delete().eq('category_id', categoryId)
    } catch {
      // Ignore if checkpoint table is unavailable
    }
  }
}

export async function applyPass2AnswerKeyMatches({ categoryId, fingerprint, answerKeyPool }) {
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
      override_reason:
        item.answer_status === 'ai_overridden' ? String(item.override_reason ?? '').trim() || null : null,
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
