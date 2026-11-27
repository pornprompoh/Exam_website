import { supabase } from '../../../../shared/lib/supabase'
import { fetchAllPaginated, getTableExactCount } from '../../../../shared/lib/supabasePagination'

export function formatAuditorDbError(error, fallbackMessage) {
  const msg = String(error?.message || '')
  if (
    error?.code === '42703' ||
    msg.includes('audit_status') ||
    msg.includes('audit_suggested_answer') ||
    msg.includes('audit_reason')
  ) {
    return new Error(
      'ยังไม่พบคอลัมน์ audit_* ในตาราง questions กรุณารันไฟล์ SQL Migration (supabase/migrations/20261126_add_question_audit_columns.sql) บน Supabase ก่อนใช้งานครับ'
    )
  }
  return new Error(msg || fallbackMessage)
}

export async function fetchCategoryAuditStats(categoryId = 'ALL') {
  const countByStatus = async (status = null) => {
    try {
      return await getTableExactCount('questions', (q) => {
        let query = q
        if (categoryId && categoryId !== 'ALL') {
          query = query.eq('category_id', categoryId)
        }
        if (status) {
          query = query.eq('audit_status', status)
        }
        return query
      })
    } catch (error) {
      throw formatAuditorDbError(error, 'ไม่สามารถโหลดสถิติการตรวจทานเฉลยได้')
    }
  }

  const [total, unchecked, verified, flagged] = await Promise.all([
    countByStatus(null),
    countByStatus('unchecked'),
    countByStatus('verified'),
    countByStatus('flagged')
  ])

  return { total, unchecked, verified, flagged }
}

export async function fetchFlaggedBadgeCounts(categoryId) {
  try {
    const [categoryFlagged, totalFlagged] = await Promise.all([
      categoryId
        ? getTableExactCount('questions', (q) => q.eq('category_id', categoryId).eq('audit_status', 'flagged'))
        : Promise.resolve(0),
      getTableExactCount('questions', (q) => q.eq('audit_status', 'flagged'))
    ])
    return { categoryFlagged, totalFlagged }
  } catch {
    return { categoryFlagged: 0, totalFlagged: 0 }
  }
}

export async function fetchFlaggedQuestions(categoryId = 'ALL') {
  try {
    return await fetchAllPaginated(
      (client) => {
        let query = client
          .from('questions')
          .select(
            'id, category_id, question_text, options, correct_option, explanation, image_url, audit_status, audit_suggested_answer, audit_suggested_explanation, audit_reason, audit_model, audit_checked_at'
          )
          .eq('audit_status', 'flagged')

        if (categoryId && categoryId !== 'ALL') {
          query = query.eq('category_id', categoryId)
        }

        return query.order('audit_checked_at', { ascending: false, nullsFirst: false })
      },
      { pageSize: 1000, orderColumn: 'id', ascending: true }
    )
  } catch (error) {
    throw formatAuditorDbError(error, 'ไม่สามารถดึงรายการข้อสอบที่ติดสถานะ flagged ได้')
  }
}

export async function fetchUncheckedQuestions(categoryId = 'ALL', maxLimit = null) {
  try {
    return await fetchAllPaginated(
      (client) => {
        let query = client
          .from('questions')
          .select('id, category_id, question_text, options, correct_option, explanation, image_url')
          .eq('audit_status', 'unchecked')

        if (categoryId && categoryId !== 'ALL') {
          query = query.eq('category_id', categoryId)
        }

        return query.order('created_at', { ascending: true })
      },
      {
        pageSize: 1000,
        maxRows: maxLimit || Number.POSITIVE_INFINITY,
        orderColumn: 'id',
        ascending: true
      }
    )
  } catch (error) {
    throw formatAuditorDbError(error, 'ไม่สามารถดึงข้อสอบที่ยังไม่ตรวจได้')
  }
}

export async function markQuestionsVerifiedInDb(ids, modelName) {
  if (!Array.isArray(ids) || ids.length === 0) return
  const nowIso = new Date().toISOString()
  const CHUNK = 200
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await supabase
      .from('questions')
      .update({
        audit_status: 'verified',
        audit_suggested_answer: null,
        audit_suggested_explanation: null,
        audit_reason: null,
        audit_model: modelName || null,
        audit_checked_at: nowIso
      })
      .in('id', ids.slice(i, i + CHUNK))

    if (error) throw formatAuditorDbError(error, 'ไม่สามารถอัปเดตสถานะ verified ลงฐานข้อมูลได้')
  }
}

export async function markQuestionFlaggedInDb(
  id,
  { suggestedAnswer = null, suggestedExplanation = null, reason = '', modelName = null }
) {
  const { error } = await supabase
    .from('questions')
    .update({
      audit_status: 'flagged',
      audit_suggested_answer: suggestedAnswer,
      audit_suggested_explanation: suggestedExplanation,
      audit_reason: reason || null,
      audit_model: modelName || null,
      audit_checked_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) throw formatAuditorDbError(error, 'ไม่สามารถติดสถานะ flagged ลงฐานข้อมูลได้')
}

export async function acceptAuditSuggestions(flaggedItems) {
  if (!Array.isArray(flaggedItems) || flaggedItems.length === 0) return { updatedCount: 0, skippedCount: 0 }

  const nowIso = new Date().toISOString()
  let updatedCount = 0
  let skippedCount = 0

  for (const item of flaggedItems) {
    const options = Array.isArray(item.options) ? item.options : []
    const suggested = item.audit_suggested_answer
    const isValidSuggested =
      suggested !== null &&
      suggested !== undefined &&
      Number.isInteger(Number(suggested)) &&
      Number(suggested) >= 0 &&
      Number(suggested) < options.length

    if (!isValidSuggested) {
      skippedCount += 1
      continue
    }

    const nextExplanation = String(item.audit_suggested_explanation ?? '').trim() || item.explanation || null

    const { error } = await supabase
      .from('questions')
      .update({
        correct_option: Number(suggested),
        explanation: nextExplanation,
        audit_status: 'verified',
        audit_suggested_answer: null,
        audit_suggested_explanation: null,
        audit_reason: null,
        audit_checked_at: nowIso
      })
      .eq('id', item.id)

    if (error) throw formatAuditorDbError(error, 'ไม่สามารถอนุมัติใช้เฉลย AI ได้')
    updatedCount += 1
  }

  return { updatedCount, skippedCount }
}

export async function keepOriginalAnswers(questionIds) {
  if (!Array.isArray(questionIds) || questionIds.length === 0) return 0
  const nowIso = new Date().toISOString()
  const CHUNK = 200
  for (let i = 0; i < questionIds.length; i += CHUNK) {
    const { error } = await supabase
      .from('questions')
      .update({
        audit_status: 'verified',
        audit_suggested_answer: null,
        audit_suggested_explanation: null,
        audit_reason: null,
        audit_checked_at: nowIso
      })
      .in('id', questionIds.slice(i, i + CHUNK))

    if (error) throw formatAuditorDbError(error, 'ไม่สามารถยืนยันคงเฉลยเดิมได้')
  }
  return questionIds.length
}

export async function manualResolveAuditedQuestion(id, { correctOption, explanation }) {
  const { error } = await supabase
    .from('questions')
    .update({
      correct_option: Number(correctOption),
      explanation: String(explanation ?? '').trim() || null,
      audit_status: 'verified',
      audit_suggested_answer: null,
      audit_suggested_explanation: null,
      audit_reason: null,
      audit_checked_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) throw formatAuditorDbError(error, 'ไม่สามารถบันทึกการแก้ไขเฉลยด้วยตนเองได้')
}

export async function resetAuditStatus(categoryId = 'ALL') {
  let query = supabase.from('questions').update({
    audit_status: 'unchecked',
    audit_suggested_answer: null,
    audit_suggested_explanation: null,
    audit_reason: null,
    audit_model: null,
    audit_checked_at: null
  })

  if (categoryId && categoryId !== 'ALL') {
    query = query.eq('category_id', categoryId)
  } else {
    query = query.neq('audit_status', 'unchecked')
  }

  const { error } = await query
  if (error) throw formatAuditorDbError(error, 'ไม่สามารถรีเซ็ตสถานะการตรวจทานได้')
}
