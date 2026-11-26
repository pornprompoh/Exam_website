import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllPaginated, getTableExactCount } from '../lib/supabasePagination'

const initialAnalytics = {
  sessions: [],
  subjectStats: [],
  totalQuestions: 0,
  totalSessions: 0,
  overallAccuracy: 0,
  resolvedRate: 0
}

export default function useAnalytics() {
  const [analytics, setAnalytics] = useState(initialAnalytics)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setAnalytics(initialAnalytics)
        return
      }

      // Paginated fetch eliminates 1,000-row ceiling on exam_sessions & user_question_history,
      // and uses exact head counts for mistake_bank resolved rate!
      const [sessionsRaw, totalMistakesCount, resolvedMistakesCount] = await Promise.all([
        fetchAllPaginated(
          (client) =>
            client
              .from('exam_sessions')
              .select('*, categories ( name )')
              .eq('user_id', session.user.id)
              .order('completed_at', { ascending: false }),
          { pageSize: 1000, orderColumn: 'id' }
        ),
        getTableExactCount('mistake_bank', (q) => q.eq('user_id', session.user.id)),
        getTableExactCount('mistake_bank', (q) => q.eq('user_id', session.user.id).eq('is_resolved', true))
      ])

      const sessions = sessionsRaw.sort(
        (a, b) => new Date(b.completed_at || 0).getTime() - new Date(a.completed_at || 0).getTime()
      )

      let history = []
      try {
        history = await fetchAllPaginated(
          (client) =>
            client
              .from('user_question_history')
              .select('question_id, seen_count, last_result')
              .eq('user_id', session.user.id),
          { pageSize: 1000, orderColumn: 'question_id' }
        )
      } catch (historyError) {
        console.error('ไม่สามารถโหลดประวัติข้อสอบรายข้อได้ จะใช้สถิติจากรอบสอบแทน:', historyError.message)
      }

      const totalSessionCount = sessions.length
      const sessionQuestionCount = sessions.reduce((sum, item) => sum + (item.total_questions || 0), 0)
      const sessionScore = sessions.reduce((sum, item) => sum + (item.score || 0), 0)
      const historyQuestionCount = history.reduce((sum, item) => sum + (Number(item.seen_count) || 0), 0)
      const answeredHistory = history.filter((item) => item.last_result === 'correct' || item.last_result === 'wrong')
      const correctHistoryCount = answeredHistory.filter((item) => item.last_result === 'correct').length
      const accuracy = answeredHistory.length > 0
        ? ((correctHistoryCount / answeredHistory.length) * 100).toFixed(1)
        : sessionQuestionCount > 0
          ? ((sessionScore / sessionQuestionCount) * 100).toFixed(1)
          : 0

      const resolved = totalMistakesCount > 0
        ? ((resolvedMistakesCount / totalMistakesCount) * 100).toFixed(1)
        : 100

      const subjectMap = {}
      sessions.forEach((item) => {
        const name = item.categories?.name || 'หมวดวิชาทั่วไป'
        if (!subjectMap[name]) subjectMap[name] = { name, sessions: 0, questions: 0, score: 0 }
        subjectMap[name].sessions += 1
        subjectMap[name].questions += item.total_questions || 0
        subjectMap[name].score += item.score || 0
      })
      const subjectStats = Object.values(subjectMap).map((subject) => ({
        ...subject,
        accuracy: subject.questions > 0 ? Number(((subject.score / subject.questions) * 100).toFixed(1)) : 0
      })).sort((a, b) => b.questions - a.questions)

      setAnalytics({
        sessions,
        subjectStats,
        totalQuestions: historyQuestionCount || sessionQuestionCount,
        totalSessions: totalSessionCount,
        overallAccuracy: accuracy,
        resolvedRate: resolved
      })
    } catch (loadError) {
      setError(loadError)
    } finally {
      setLoading(false)
    }
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

  return { ...analytics, loading, error, refresh }
}
