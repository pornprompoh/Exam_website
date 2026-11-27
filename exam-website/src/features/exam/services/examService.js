import { supabase } from '../../../shared/lib/supabase'
import {
  fetchAllPaginated,
  fetchByIdsInBatches,
  getTableExactCount,
  runInBatches
} from '../../../shared/lib/supabasePagination'
import { prepareQuestionWithChoiceOrder, shuffleArray } from '../utils/examShuffleUtils'

export async function getExamSetupMeta(categoryId) {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id || 'anonymous'
  const exactCount = await getTableExactCount('questions', (q) =>
    q.eq('category_id', categoryId).eq('is_active', true)
  )
  return { userId, exactCount }
}

export async function fetchQuestionsForAutosaveResume(pendingAutosave, onProgress) {
  const fetchedRows = await fetchByIdsInBatches('questions', '*', pendingAutosave.questionIds, {
    batchSize: 400,
    applyFilters: (q) => q.eq('is_active', true),
    onProgress
  })

  const rowById = new Map(fetchedRows.map((row) => [row.id, row]))
  const restoredQuestions = []
  for (const qId of pendingAutosave.questionIds) {
    const row = rowById.get(qId)
    if (!row) continue
    const savedOrder = pendingAutosave.choiceOrders?.[qId] || null
    restoredQuestions.push(prepareQuestionWithChoiceOrder(row, savedOrder))
  }
  return restoredQuestions
}

export async function fetchSmartRandomizedQuestions({
  categoryId,
  requestedCount,
  maxBankCount,
  onProgressText
}) {
  const allIdRows = await fetchAllPaginated(
    (client) =>
      client
        .from('questions')
        .select('id')
        .eq('category_id', categoryId)
        .eq('is_active', true),
    {
      pageSize: 1000,
      orderColumn: 'id',
      onProgress: ({ fetchedCount }) => {
        if (maxBankCount > 1000) {
          onProgressText?.(
            `กำลังรวบรวมข้อสอบจากทั้งคลัง (${fetchedCount.toLocaleString()} / ${maxBankCount.toLocaleString()} ข้อ)...`
          )
        }
      }
    }
  )

  const allQuestionIds = allIdRows.map((r) => r.id)
  if (allQuestionIds.length === 0) return []

  const allQuestionIdSet = new Set(allQuestionIds)
  const finalCount = Math.min(requestedCount, allQuestionIds.length)

  let session = null
  try {
    const { data } = await supabase.auth.getSession()
    session = data?.session || null
  } catch (sessionError) {
    console.error('ไม่สามารถตรวจสอบ session ได้ ระบบจะเริ่มสอบโดยไม่ใช้ประวัติส่วนตัว:', sessionError)
  }

  const seenIdSet = new Set()
  let mistakeIdSet = new Set()

  if (session) {
    try {
      const historyRows = await fetchAllPaginated(
        (client) =>
          client
            .from('user_question_history')
            .select('question_id, seen_count, last_result')
            .eq('user_id', session.user.id),
        { pageSize: 1000, orderColumn: 'question_id' }
      )

      for (const item of historyRows) {
        if (!allQuestionIdSet.has(item.question_id)) continue
        if (Number(item.seen_count) > 0) seenIdSet.add(item.question_id)
        if (item.last_result === 'wrong') mistakeIdSet.add(item.question_id)
      }

      if (mistakeIdSet.size > 0) {
        const unresolvedRows = await fetchByIdsInBatches('mistake_bank', 'id, question_id', [...mistakeIdSet], {
          batchSize: 300,
          idColumn: 'question_id',
          orderColumn: 'id',
          applyFilters: (q) => q.eq('user_id', session.user.id).eq('is_resolved', false)
        })
        mistakeIdSet = new Set(unresolvedRows.map((r) => r.question_id))
      }
    } catch (historyErr) {
      console.error('ไม่สามารถโหลดประวัติข้อสอบได้ ระบบจะสุ่มจากข้อสอบทั้งหมด:', historyErr.message)
    }
  }

  const mistakePool = []
  const unseenPool = []
  const seenCorrectPool = []

  for (const id of allQuestionIds) {
    if (mistakeIdSet.has(id)) mistakePool.push(id)
    else if (!seenIdSet.has(id)) unseenPool.push(id)
    else seenCorrectPool.push(id)
  }

  const selectedIds = []
  const targetMistakeCount = Math.floor(finalCount * 0.2)
  const shuffledMistakes = shuffleArray(mistakePool)
  selectedIds.push(...shuffledMistakes.slice(0, Math.min(targetMistakeCount, shuffledMistakes.length)))

  const remainingForUnseen = finalCount - selectedIds.length
  if (remainingForUnseen > 0) {
    const shuffledUnseen = shuffleArray(unseenPool)
    selectedIds.push(...shuffledUnseen.slice(0, Math.min(remainingForUnseen, shuffledUnseen.length)))
  }

  const remainingToFill = finalCount - selectedIds.length
  if (remainingToFill > 0) {
    const shuffledSeenCorrect = shuffleArray(seenCorrectPool)
    selectedIds.push(...shuffledSeenCorrect.slice(0, Math.min(remainingToFill, shuffledSeenCorrect.length)))
  }

  const finalOrderedIds = shuffleArray(selectedIds)

  onProgressText?.(
    finalOrderedIds.length > 400
      ? `กำลังโหลดรายละเอียดข้อสอบ 0 / ${finalOrderedIds.length.toLocaleString()} ข้อ...`
      : `กำลังโหลดข้อสอบ ${finalOrderedIds.length.toLocaleString()} ข้อ...`
  )

  const fetchedQuestions = await fetchByIdsInBatches('questions', '*', finalOrderedIds, {
    batchSize: 400,
    onProgress: ({ processedIds, totalIds }) => {
      if (totalIds > 400) {
        onProgressText?.(
          `กำลังโหลดรายละเอียดข้อสอบ ${processedIds.toLocaleString()} / ${totalIds.toLocaleString()} ข้อ...`
        )
      }
    }
  })

  const questionById = new Map(fetchedQuestions.map((q) => [q.id, q]))
  const prepared = []
  for (const id of finalOrderedIds) {
    const q = questionById.get(id)
    if (!q) continue
    prepared.push(prepareQuestionWithChoiceOrder(q, null))
  }
  return prepared
}

export async function submitExamResults({
  categoryId,
  answeredQuestionsList,
  totalScore,
  userAnswers,
  mistakeItems
}) {
  const { data: sessionData, error: sessionError } = await supabase
    .from('exam_sessions')
    .insert([
      {
        category_id: categoryId,
        total_questions: answeredQuestionsList.length,
        score: totalScore,
        completed_at: new Date().toISOString()
      }
    ])
    .select()
    .single()

  const { data: { session } } = await supabase.auth.getSession()
  if (session && answeredQuestionsList.length > 0) {
    const answeredIds = answeredQuestionsList.map((q) => q.id)
    const existingHistory = await fetchByIdsInBatches('user_question_history', 'question_id, seen_count', answeredIds, {
      batchSize: 300,
      idColumn: 'question_id',
      orderColumn: 'question_id',
      applyFilters: (q) => q.eq('user_id', session.user.id)
    })

    const existingCountByQuestionId = new Map(
      existingHistory.map((item) => [item.question_id, Number(item.seen_count) || 0])
    )
    const nowIso = new Date().toISOString()

    const historyRows = answeredQuestionsList.map((question) => {
      const selectedDisplayIdx = userAnswers[question.id]
      const isCorrect = selectedDisplayIdx === question.displayCorrectOption
      return {
        user_id: session.user.id,
        question_id: question.id,
        seen_count: (existingCountByQuestionId.get(question.id) || 0) + 1,
        last_seen_at: nowIso,
        last_result: isCorrect ? 'correct' : 'wrong'
      }
    })

    await runInBatches(historyRows, 200, async (chunk) => {
      const { error: historyUpsertError } = await supabase
        .from('user_question_history')
        .upsert(chunk, { onConflict: 'user_id,question_id' })
      if (historyUpsertError) throw historyUpsertError
    })
  }

  if (!sessionError && sessionData && mistakeItems.length > 0) {
    const mistakesWithSession = mistakeItems.map((item) => ({
      ...item,
      session_id: sessionData.id
    }))
    await runInBatches(mistakesWithSession, 200, async (chunk) => {
      const { error: mistakeInsertError } = await supabase.from('mistake_bank').insert(chunk)
      if (mistakeInsertError) throw mistakeInsertError
    })
  }
}
