import { supabase } from '../../../shared/lib/supabase'
import { fetchAllPaginated, fetchByIdsInBatches } from '../../../shared/lib/supabasePagination'

const MISTAKE_SELECT = `
  id,
  question_id,
  user_answer,
  is_resolved,
  created_at,
  questions (
    id,
    question_text,
    options,
    correct_option,
    explanation,
    image_url,
    explanation_image_url,
    category_id,
    categories ( name )
  )
`

export async function fetchUnresolvedMistakes() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return { mistakes: [], categories: [] }
  }

  let wrongQuestionIds = null
  try {
    const historyData = await fetchAllPaginated(
      (client) =>
        client
          .from('user_question_history')
          .select('question_id')
          .eq('user_id', session.user.id)
          .eq('last_result', 'wrong'),
      { pageSize: 1000, orderColumn: 'question_id' }
    )
    wrongQuestionIds = [...new Set(historyData.map((item) => item.question_id))]
  } catch (historyError) {
    console.error('ไม่สามารถโหลดประวัติผลล่าสุดได้ จะใช้คลังข้อผิดเป็น fallback:', historyError.message)
  }

  if (wrongQuestionIds && wrongQuestionIds.length === 0) {
    return { mistakes: [], categories: [] }
  }

  let rawMistakes
  if (wrongQuestionIds) {
    rawMistakes = await fetchByIdsInBatches('mistake_bank', MISTAKE_SELECT, wrongQuestionIds, {
      batchSize: 250,
      idColumn: 'question_id',
      orderColumn: 'id',
      applyFilters: (q) => q.eq('user_id', session.user.id).eq('is_resolved', false)
    })
  } else {
    rawMistakes = await fetchAllPaginated(
      (client) =>
        client
          .from('mistake_bank')
          .select(MISTAKE_SELECT)
          .eq('user_id', session.user.id)
          .eq('is_resolved', false),
      { pageSize: 1000, orderColumn: 'id' }
    )
  }

  const validMistakes = rawMistakes
    .filter((item) => item.questions !== null)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

  const categoryMap = {}
  validMistakes.forEach((item) => {
    if (item.questions?.categories) categoryMap[item.questions.category_id] = item.questions.categories.name
  })
  const categories = Object.entries(categoryMap).map(([id, name]) => ({ id, name }))

  return { mistakes: validMistakes, categories }
}

export async function markMistakeResolved(item) {
  const question = item.questions
  const { data: { session } } = await supabase.auth.getSession()

  let resolveQuery = supabase.from('mistake_bank').update({ is_resolved: true }).eq('is_resolved', false)
  if (question?.id && session) {
    resolveQuery = resolveQuery.eq('user_id', session.user.id).eq('question_id', question.id)
  } else {
    resolveQuery = resolveQuery.eq('id', item.id)
  }
  const { error: resolveError } = await resolveQuery
  if (resolveError) throw resolveError

  if (session && question?.id) {
    const { error: historyError } = await supabase
      .from('user_question_history')
      .update({ last_result: 'correct', last_seen_at: new Date().toISOString() })
      .eq('user_id', session.user.id)
      .eq('question_id', question.id)
    if (historyError) throw historyError
  }
}
