import { useEffect, useRef, useCallback } from 'react'
import { AUTOSAVE_TIMER_INTERVAL_SEC, writeExamAutosave } from '../utils/examAutosaveStorage'

export default function useExamAutosave({
  examPhase,
  autosaveKey,
  categoryId,
  questions,
  userAnswers,
  flaggedIds,
  currentIdx,
  totalTimeSeconds,
  timeLeft
}) {
  const latestExamStateRef = useRef(null)
  const lastTimerSaveRef = useRef(0)

  const persistCurrentAutosave = useCallback(() => {
    const snap = latestExamStateRef.current
    if (!snap || snap.examPhase !== 'testing' || !snap.autosaveKey || snap.questions.length === 0) return

    const choiceOrders = {}
    const questionIds = []
    for (const q of snap.questions) {
      questionIds.push(q.id)
      choiceOrders[q.id] = q.originalOptionIndices
    }

    writeExamAutosave(snap.autosaveKey, {
      categoryId: snap.categoryId,
      questionIds,
      choiceOrders,
      answers: snap.userAnswers,
      flaggedIds: snap.flaggedIds,
      currentIndex: snap.currentIdx,
      totalTimeSeconds: snap.totalTimeSeconds,
      remainingSeconds: snap.timeLeft
    })
  }, [])

  const resetLastTimerCheckpoint = useCallback((seconds) => {
    lastTimerSaveRef.current = seconds
  }, [])

  useEffect(() => {
    latestExamStateRef.current = {
      examPhase,
      autosaveKey,
      categoryId,
      questions,
      userAnswers,
      flaggedIds,
      currentIdx,
      totalTimeSeconds,
      timeLeft
    }
  }, [examPhase, autosaveKey, categoryId, questions, userAnswers, flaggedIds, currentIdx, totalTimeSeconds, timeLeft])

  useEffect(() => {
    if (examPhase !== 'testing' || questions.length === 0 || !autosaveKey) return
    persistCurrentAutosave()
  }, [examPhase, autosaveKey, questions, userAnswers, flaggedIds, currentIdx, persistCurrentAutosave])

  useEffect(() => {
    if (examPhase !== 'testing' || totalTimeSeconds <= 0 || !autosaveKey) return
    if (Math.abs(lastTimerSaveRef.current - timeLeft) >= AUTOSAVE_TIMER_INTERVAL_SEC || timeLeft <= 1) {
      lastTimerSaveRef.current = timeLeft
      persistCurrentAutosave()
    }
  }, [examPhase, totalTimeSeconds, timeLeft, autosaveKey, persistCurrentAutosave])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') persistCurrentAutosave()
    }
    const handlePageHide = () => {
      persistCurrentAutosave()
    }
    const handleBeforeUnload = (e) => {
      persistCurrentAutosave()
      if (examPhase === 'testing' && Object.keys(userAnswers).length > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [examPhase, userAnswers, persistCurrentAutosave])

  return { persistCurrentAutosave, resetLastTimerCheckpoint }
}
