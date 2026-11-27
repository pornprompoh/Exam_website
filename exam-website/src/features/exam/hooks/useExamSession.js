/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  clearExamAutosave,
  clearLegacyDraftKey,
  getExamAutosaveKey,
  readExamAutosave
} from '../utils/examAutosaveStorage'
import { gradeExamAnswers } from '../utils/examShuffleUtils'
import {
  fetchQuestionsForAutosaveResume,
  fetchSmartRandomizedQuestions,
  getExamSetupMeta,
  submitExamResults
} from '../services/examService'
import useExamAutosave from './useExamAutosave'

export default function useExamSession(categoryId) {
  const navigate = useNavigate()

  const [totalBankCount, setTotalBankCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingText, setLoadingText] = useState('กำลังเตรียมคลังข้อสอบให้พร้อม...')
  const [startingExam, setStartingExam] = useState(false)
  const [startProgressText, setStartProgressText] = useState('')

  const [questions, setQuestions] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [userAnswers, setUserAnswers] = useState({})
  const [flaggedIds, setFlaggedIds] = useState([])
  const [score, setScore] = useState(0)
  const [saving, setSaving] = useState(false)

  const [showExitZeroModal, setShowExitZeroModal] = useState(false)
  const [showExitProgressModal, setShowExitProgressModal] = useState(false)
  const [showZeroSubmitModal, setShowZeroSubmitModal] = useState(false)
  const [showPartialSubmitModal, setShowPartialSubmitModal] = useState(false)
  const [showTimeOutModal, setShowTimeOutModal] = useState(false)

  const [examPhase, setExamPhase] = useState('setup')
  const [selectedCount, setSelectedCount] = useState(10)
  const [customCountInput, setCustomCountInput] = useState('')
  const [selectedTimeLimit, setSelectedTimeLimit] = useState(0)
  const [customTimeInput, setCustomTimeInput] = useState('')
  const [timeLeft, setTimeLeft] = useState(0)
  const [totalTimeSeconds, setTotalTimeSeconds] = useState(0)

  const [autosaveKey, setAutosaveKey] = useState('')
  const [pendingAutosave, setPendingAutosave] = useState(null)

  const { persistCurrentAutosave, resetLastTimerCheckpoint } = useExamAutosave({
    examPhase,
    autosaveKey,
    categoryId,
    questions,
    userAnswers,
    flaggedIds,
    currentIdx,
    totalTimeSeconds,
    timeLeft
  })

  useEffect(() => {
    initExamSetup()
  }, [categoryId])

  useEffect(() => {
    let timer = null
    if (examPhase === 'testing' && totalTimeSeconds > 0) {
      if (timeLeft > 0) {
        timer = setInterval(() => {
          setTimeLeft((prev) => Math.max(0, prev - 1))
        }, 1000)
      } else {
        executeSubmitExam(true)
      }
    }
    return () => clearInterval(timer)
  }, [examPhase, timeLeft, totalTimeSeconds])

  async function initExamSetup() {
    setLoading(true)
    setLoadingText('กำลังตรวจสอบจำนวนข้อสอบทั้งหมดในคลัง...')
    try {
      const normalizedCategoryId = typeof categoryId === 'string' ? categoryId.trim() : ''
      const invalidCategoryId =
        !normalizedCategoryId || ['undefined', 'null'].includes(normalizedCategoryId.toLowerCase())

      if (invalidCategoryId) {
        alert('ไม่พบหมวดหมู่วิชาที่เลือก')
        return navigate('/', { replace: true })
      }

      const { userId, exactCount } = await getExamSetupMeta(normalizedCategoryId)
      const key = getExamAutosaveKey(userId, normalizedCategoryId)
      setAutosaveKey(key)
      clearLegacyDraftKey(normalizedCategoryId, userId)

      if (exactCount === 0) {
        alert('ไม่พบข้อสอบในหมวดหมู่นี้')
        return navigate('/', { replace: true })
      }

      setTotalBankCount(exactCount)
      const initialCount = Math.min(10, exactCount)
      setSelectedCount(initialCount)
      setCustomCountInput(String(initialCount))

      const saved = readExamAutosave(key, normalizedCategoryId)
      setPendingAutosave(saved)
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCustomCountChange = (val) => {
    setCustomCountInput(val)
    const num = parseInt(val, 10)
    if (!Number.isNaN(num) && num > 0) {
      setSelectedCount(num > totalBankCount ? totalBankCount : num)
    }
  }

  const handleSelectCountBtn = (num) => {
    setSelectedCount(num)
    setCustomCountInput(String(num))
  }

  const handleCustomTimeChange = (val) => {
    setCustomTimeInput(val)
    if (selectedTimeLimit !== -1) setSelectedTimeLimit(-1)
  }

  const handleResumeAutosave = async () => {
    if (!pendingAutosave) return
    setStartingExam(true)
    setStartProgressText(`กำลังกู้คืนข้อสอบที่ทำค้างไว้ (${pendingAutosave.questionIds.length.toLocaleString()} ข้อ)...`)

    try {
      const restoredQuestions = await fetchQuestionsForAutosaveResume(pendingAutosave, ({ processedIds, totalIds }) => {
        if (totalIds > 400) {
          setStartProgressText(`กำลังกู้คืนข้อสอบ ${processedIds.toLocaleString()} / ${totalIds.toLocaleString()} ข้อ...`)
        }
      })

      if (restoredQuestions.length === 0) {
        clearExamAutosave(autosaveKey)
        setPendingAutosave(null)
        alert('ข้อสอบในรอบที่บันทึกไว้ถูกลบหรือปิดใช้งานแล้ว กรุณาเริ่มทำชุดใหม่ครับ')
        return
      }

      const validQuestionMap = new Map(restoredQuestions.map((q) => [q.id, q]))
      const restoredAnswers = {}
      for (const [qId, ansIdx] of Object.entries(pendingAutosave.answers || {})) {
        const q = validQuestionMap.get(qId)
        if (q && Number.isInteger(ansIdx) && ansIdx >= 0 && ansIdx < q.displayOptions.length) {
          restoredAnswers[qId] = ansIdx
        }
      }

      const restoredIdx = Math.min(Math.max(0, Number(pendingAutosave.currentIndex) || 0), restoredQuestions.length - 1)
      const restoredTotalTime = Math.max(0, Number(pendingAutosave.timerConfig?.totalTimeSeconds) || 0)
      const restoredRemaining =
        restoredTotalTime > 0
          ? Math.min(restoredTotalTime, Math.max(1, Number(pendingAutosave.remainingSeconds) || restoredTotalTime))
          : 0

      setQuestions(restoredQuestions)
      setUserAnswers(restoredAnswers)
      setFlaggedIds((pendingAutosave.flaggedIds || []).filter((id) => validQuestionMap.has(id)))
      setCurrentIdx(restoredIdx)
      setScore(0)
      setTotalTimeSeconds(restoredTotalTime)
      setTimeLeft(restoredRemaining)
      resetLastTimerCheckpoint(restoredRemaining)
      setPendingAutosave(null)
      setExamPhase('testing')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      alert('ไม่สามารถกู้คืนข้อสอบที่ทำค้างไว้ได้: ' + err.message)
    } finally {
      setStartingExam(false)
      setStartProgressText('')
    }
  }

  const handleDiscardAutosave = () => {
    clearExamAutosave(autosaveKey)
    setPendingAutosave(null)
  }

  const handleStartExamSession = async () => {
    const maxQ = totalBankCount
    let finalCount = parseInt(customCountInput, 10)
    if (Number.isNaN(finalCount) || finalCount <= 0) finalCount = Math.min(10, maxQ)
    if (finalCount > maxQ) finalCount = maxQ

    let finalTime = selectedTimeLimit
    if (selectedTimeLimit === -1) {
      finalTime = parseInt(customTimeInput, 10)
      if (Number.isNaN(finalTime) || finalTime <= 0) finalTime = 15
      if (finalTime > 120) finalTime = 120
    }

    clearExamAutosave(autosaveKey)
    setPendingAutosave(null)

    setStartingExam(true)
    setStartProgressText('กำลังดึงรายการข้อสอบทั้งหมดเพื่อสุ่มจากทั้งคลัง...')

    try {
      const prepared = await fetchSmartRandomizedQuestions({
        categoryId: categoryId.trim(),
        requestedCount: finalCount,
        maxBankCount: maxQ,
        onProgressText: setStartProgressText
      })

      if (prepared.length === 0) {
        alert('ไม่พบข้อสอบในหมวดหมู่นี้')
        return navigate('/', { replace: true })
      }

      setQuestions(prepared)
      setUserAnswers({})
      setFlaggedIds([])
      setCurrentIdx(0)
      setScore(0)

      const totalSecs = finalTime > 0 ? finalTime * 60 : 0
      setTotalTimeSeconds(totalSecs)
      setTimeLeft(totalSecs)
      resetLastTimerCheckpoint(totalSecs)

      setExamPhase('testing')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      alert('ไม่สามารถเริ่มทำข้อสอบได้: ' + err.message)
    } finally {
      setStartingExam(false)
      setStartProgressText('')
    }
  }

  const handleSelectOption = (questionId, optionIdx) => {
    if (examPhase !== 'testing') return
    setUserAnswers((prev) => ({ ...prev, [questionId]: optionIdx }))
  }

  const handleBackNavigation = () => {
    if (examPhase === 'submitted' || examPhase === 'setup') {
      navigate('/')
      return
    }
    if (Object.keys(userAnswers).length === 0) {
      setShowExitZeroModal(true)
    } else {
      persistCurrentAutosave()
      setShowExitProgressModal(true)
    }
  }

  const handleRequestSubmit = () => {
    if (saving || examPhase !== 'testing') return
    const answeredCountNow = Object.keys(userAnswers).length

    if (answeredCountNow === 0) {
      setShowZeroSubmitModal(true)
      return
    }
    if (answeredCountNow < questions.length) {
      setShowPartialSubmitModal(true)
      return
    }
    executeSubmitExam(false)
  }

  async function executeSubmitExam(isTimeOut = false) {
    clearExamAutosave(autosaveKey)
    const answeredCountNow = Object.keys(userAnswers).length

    if (isTimeOut && answeredCountNow === 0) {
      setShowTimeOutModal(true)
      setScore(0)
      setExamPhase('submitted')
      setCurrentIdx(0)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (isTimeOut) setShowTimeOutModal(true)

    setSaving(true)
    const { totalScore, mistakeItems, answeredQuestionsList } = gradeExamAnswers(questions, userAnswers)

    setScore(totalScore)
    setExamPhase('submitted')
    setCurrentIdx(0)

    try {
      await submitExamResults({
        categoryId,
        answeredQuestionsList,
        totalScore,
        userAnswers,
        mistakeItems
      })
    } catch (dbErr) {
      console.error('ไม่สามารถบันทึกประวัติสอบได้:', dbErr.message)
    } finally {
      setSaving(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleRestartExam = () => {
    setExamPhase('setup')
    setQuestions([])
    setUserAnswers({})
    setCurrentIdx(0)
    initExamSetup()
  }

  const handleConfirmExitZero = () => {
    clearExamAutosave(autosaveKey)
    navigate('/')
  }

  const handleConfirmExitProgress = () => {
    persistCurrentAutosave()
    navigate('/')
  }

  return {
    loading,
    loadingText,
    startingExam,
    startProgressText,
    examPhase,
    totalBankCount,
    selectedCount,
    customCountInput,
    selectedTimeLimit,
    setSelectedTimeLimit,
    customTimeInput,
    setCustomTimeInput,
    pendingAutosave,
    questions,
    currentIdx,
    setCurrentIdx,
    userAnswers,
    score,
    saving,
    timeLeft,
    totalTimeSeconds,
    showExitZeroModal,
    setShowExitZeroModal,
    showExitProgressModal,
    setShowExitProgressModal,
    showZeroSubmitModal,
    setShowZeroSubmitModal,
    showPartialSubmitModal,
    setShowPartialSubmitModal,
    showTimeOutModal,
    setShowTimeOutModal,
    handleCustomCountChange,
    handleSelectCountBtn,
    handleCustomTimeChange,
    handleResumeAutosave,
    handleDiscardAutosave,
    handleStartExamSession,
    handleSelectOption,
    handleBackNavigation,
    handleRequestSubmit,
    executeSubmitExam,
    handleRestartExam,
    handleConfirmExitZero,
    handleConfirmExitProgress,
    goHome: () => navigate('/')
  }
}
