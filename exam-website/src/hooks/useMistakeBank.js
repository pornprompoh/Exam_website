import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function useMistakeBank() {
  const [mistakes, setMistakes] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setMistakes([])
        setCategories([])
        return
      }

      const { data: historyData, error: historyError } = await supabase
        .from('user_question_history')
        .select('question_id')
        .eq('user_id', session.user.id)
        .eq('last_result', 'wrong')

      if (historyError) console.error('ไม่สามารถโหลดประวัติผลล่าสุดได้ จะใช้คลังข้อผิดเป็น fallback:', historyError.message)
      const wrongQuestionIds = historyError ? null : [...new Set((historyData || []).map((item) => item.question_id))]
      if (wrongQuestionIds && wrongQuestionIds.length === 0) {
        setMistakes([])
        setCategories([])
        return
      }

      let mistakeQuery = supabase
        .from('mistake_bank')
        .select(`
          id,
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
        `)
        .eq('user_id', session.user.id)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
      if (wrongQuestionIds) mistakeQuery = mistakeQuery.in('question_id', wrongQuestionIds)

      const { data, error: mistakeError } = await mistakeQuery
      if (mistakeError) throw mistakeError

      const validMistakes = (data || []).filter((item) => item.questions !== null)
      setMistakes(validMistakes)
      const categoryMap = {}
      validMistakes.forEach((item) => {
        if (item.questions?.categories) categoryMap[item.questions.category_id] = item.questions.categories.name
      })
      setCategories(Object.entries(categoryMap).map(([id, name]) => ({ id, name })))
    } catch (loadError) {
      setError(loadError)
    } finally {
      setLoading(false)
    }
  }, [])

  const resolveMistake = useCallback(async (item) => {
    const question = item.questions
    const { data: { session } } = await supabase.auth.getSession()

    let resolveQuery = supabase.from('mistake_bank').update({ is_resolved: true }).eq('is_resolved', false)
    if (question?.id && session) {
      resolveQuery = resolveQuery.eq('user_id', session.user.id).eq('question_id', question.id)
    } else {
      resolveQuery = resolveQuery.eq('id', item.id)
    }
    const { error: resolveError } = await resolveQuery
    if (resolveError) {
      setError(resolveError)
      throw resolveError
    }

    if (session && question?.id) {
      const { error: historyError } = await supabase
        .from('user_question_history')
        .update({ last_result: 'correct', last_seen_at: new Date().toISOString() })
        .eq('user_id', session.user.id)
        .eq('question_id', question.id)
      if (historyError) {
        setError(historyError)
        throw historyError
      }
    }

    setMistakes((current) => current.filter((mistake) => mistake.id !== item.id))
    setError(null)
  }, [])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (active) return refresh()
      return undefined
    })
    return () => {
      active = false
    }
  }, [refresh])

  return { mistakes, categories, loading, error, refresh, resolveMistake }
}
