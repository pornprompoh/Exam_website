/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  fetchAllPaginated,
  fetchByIdsInBatches,
  getTableExactCount,
  runInBatches
} from '../../lib/supabasePagination'
import Navbar from '../../components/common/Navbar'
import LoadingScreen from '../../components/common/LoadingScreen'
import ConfirmModal from '../../components/common/ConfirmModal'
import ExamHeader from '../../components/exam/ExamHeader'
import QuestionCard from '../../components/exam/QuestionCard'
import ExamNavigator from '../../components/exam/ExamNavigator'
import ExamReviewList from '../../components/exam/ExamReviewList'

// Fisher-Yates shuffle (unbiased uniform permutation across full bank)
const shuffleArray = (array) => {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

// 7-day Auto-Save TTL (Pause-on-Close Timer, Lightweight ID-only payload)
const EXAM_AUTOSAVE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const AUTOSAVE_TIMER_INTERVAL_SEC = 5

function getExamAutosaveKey(userId, categoryId) {
  return `exam_autosave_${userId || 'anonymous'}_${categoryId}`
}

function clearLegacyDraftKey(categoryId, userId) {
  try {
    localStorage.removeItem(`exam-session-draft:${userId || 'anonymous'}:${categoryId}`)
  } catch {
    // Ignore storage errors
  }
}

function clearExamAutosave(key) {
  if (!key) return
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.error('ไม่สามารถลบข้อมูล Auto-Save ออกจากเครื่องได้:', error)
  }
}

function readExamAutosave(key, categoryId) {
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const data = JSON.parse(raw)

    // Auto-delete if expired (> 7 days) without prompting
    if (!Number.isFinite(data?.expiresAt) || Date.now() > data.expiresAt) {
      localStorage.removeItem(key)
      return null
    }

    const isValid =
      data.categoryId === categoryId &&
      Array.isArray(data.questionIds) &&
      data.questionIds.length > 0 &&
      data.answers &&
      typeof data.answers === 'object' &&
      !Array.isArray(data.answers) &&
      Number.isInteger(data.currentIndex) &&
      data.currentIndex >= 0 &&
      Number.isFinite(data.remainingSeconds) &&
      data.remainingSeconds >= 0 &&
      Number.isFinite(data?.timerConfig?.totalTimeSeconds) &&
      data.timerConfig.totalTimeSeconds >= 0

    if (isValid) return data
    localStorage.removeItem(key)
  } catch (error) {
    console.error('ไม่สามารถอ่านข้อมูล Auto-Save จากเครื่องได้:', error)
    clearExamAutosave(key)
  }
  return null
}

function writeExamAutosave(key, payload) {
  if (!key || !payload?.questionIds?.length) return
  try {
    const now = Date.now()
    const compactPayload = {
      version: 2,
      categoryId: payload.categoryId,
      questionIds: payload.questionIds,
      choiceOrders: payload.choiceOrders || {},
      answers: payload.answers || {},
      flaggedIds: Array.isArray(payload.flaggedIds) ? payload.flaggedIds : [],
      currentIndex: Number(payload.currentIndex) || 0,
      timerConfig: {
        totalTimeSeconds: Math.max(0, Number(payload.totalTimeSeconds) || 0)
      },
      remainingSeconds: Math.max(0, Number(payload.remainingSeconds) || 0),
      savedAt: now,
      expiresAt: now + EXAM_AUTOSAVE_TTL_MS
    }
    localStorage.setItem(key, JSON.stringify(compactPayload))
  } catch (error) {
    // Gracefully handle QuotaExceededError or private-browsing storage limits
    console.warn('ไม่สามารถบันทึก Auto-Save ลง localStorage ได้:', error)
  }
}

/**
 * Reconstruct a question's displayed choices & correct index from a saved `choiceOrder`
 * (or generate a fresh Fisher-Yates shuffle if no saved order exists).
 */
function prepareQuestionWithChoiceOrder(q, savedOrder = null) {
  const options = Array.isArray(q.options) ? q.options : []
  const origCorrect = Number(q.correct_option)

  if (
    Array.isArray(savedOrder) &&
    savedOrder.length === options.length &&
    savedOrder.every((idx) => Number.isInteger(idx) && idx >= 0 && idx < options.length) &&
    new Set(savedOrder).size === options.length
  ) {
    const displayOptions = savedOrder.map((origIdx) => options[origIdx])
    const displayCorrectOption = savedOrder.findIndex((origIdx) => origIdx === origCorrect)
    return {
      ...q,
      displayOptions,
      displayCorrectOption,
      originalOptionIndices: savedOrder
    }
  }

  if (!q.is_options_randomized || options.length === 0) {
    return {
      ...q,
      displayOptions: options,
      displayCorrectOption: origCorrect,
      originalOptionIndices: options.map((_, index) => index)
    }
  }

  const optionsWithOriginalIdx = options.map((opt, idx) => ({ text: opt, originalIdx: idx }))
  const shuffledOptions = shuffleArray(optionsWithOriginalIdx)
  const newCorrectIdx = shuffledOptions.findIndex((item) => item.originalIdx === origCorrect)

  return {
    ...q,
    displayOptions: shuffledOptions.map((item) => item.text),
    displayCorrectOption: newCorrectIdx,
    originalOptionIndices: shuffledOptions.map((item) => item.originalIdx)
  }
}

export default function ExamSession() {
  const { categoryId } = useParams()
  const [searchParams] = useSearchParams()
  const categoryName = searchParams.get('title') || 'ทดสอบข้อสอบ'
  const navigate = useNavigate()

  // Setup & Full-Bank Count (no 1,000-row cap!)
  const [totalBankCount, setTotalBankCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingText, setLoadingText] = useState('กำลังเตรียมคลังข้อสอบให้พร้อม...')
  const [startingExam, setStartingExam] = useState(false)
  const [startProgressText, setStartProgressText] = useState('')

  // Active Exam State
  const [questions, setQuestions] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [userAnswers, setUserAnswers] = useState({})
  const [flaggedIds, setFlaggedIds] = useState([])
  const [score, setScore] = useState(0)
  const [saving, setSaving] = useState(false)

  // Modals & Guards
  const [showExitZeroModal, setShowExitZeroModal] = useState(false)
  const [showExitProgressModal, setShowExitProgressModal] = useState(false)
  const [showZeroSubmitModal, setShowZeroSubmitModal] = useState(false)
  const [showPartialSubmitModal, setShowPartialSubmitModal] = useState(false)
  const [showTimeOutModal, setShowTimeOutModal] = useState(false)

  // Setup Controls (Preserve exact 10 / 20 / 30 / All shortcut buttons!)
  const [examPhase, setExamPhase] = useState('setup') // 'setup' | 'testing' | 'submitted'
  const [selectedCount, setSelectedCount] = useState(10)
  const [customCountInput, setCustomCountInput] = useState('')
  const [selectedTimeLimit, setSelectedTimeLimit] = useState(0)
  const [customTimeInput, setCustomTimeInput] = useState('')
  const [timeLeft, setTimeLeft] = useState(0)
  const [totalTimeSeconds, setTotalTimeSeconds] = useState(0)

  // Auto-Save State
  const [autosaveKey, setAutosaveKey] = useState('')
  const [pendingAutosave, setPendingAutosave] = useState(null)

  // Latest-value ref so visibilitychange / pagehide / periodic timer save always writes exact current state
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

  // Keep ref in sync for flush-on-unload / visibilitychange
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

  // Initial load: fetch EXACT count ONLY via getTableExactCount (0 row payload, no 1,000-row cap!)
  useEffect(() => {
    initExamSetup()
  }, [categoryId])

  // Auto-Save immediately on answers / currentIdx / questions / examPhase changes
  useEffect(() => {
    if (examPhase !== 'testing' || questions.length === 0 || !autosaveKey) return
    persistCurrentAutosave()
  }, [examPhase, autosaveKey, questions, userAnswers, flaggedIds, currentIdx, persistCurrentAutosave])

  // Periodic timer save (every 5 seconds while countdown ticks)
  useEffect(() => {
    if (examPhase !== 'testing' || totalTimeSeconds <= 0 || !autosaveKey) return
    if (Math.abs(lastTimerSaveRef.current - timeLeft) >= AUTOSAVE_TIMER_INTERVAL_SEC || timeLeft <= 1) {
      lastTimerSaveRef.current = timeLeft
      persistCurrentAutosave()
    }
  }, [examPhase, totalTimeSeconds, timeLeft, autosaveKey, persistCurrentAutosave])

  // Flush exact remainingSeconds on visibilitychange / pagehide / beforeunload (Pause-on-Close Timer!)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        persistCurrentAutosave()
      }
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

  // Countdown timer
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
      const invalidCategoryId = !normalizedCategoryId ||
        ['undefined', 'null'].includes(normalizedCategoryId.toLowerCase())

      if (invalidCategoryId) {
        alert('ไม่พบหมวดหมู่วิชาที่เลือก')
        return navigate('/', { replace: true })
      }

      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id || 'anonymous'
      const key = getExamAutosaveKey(userId, normalizedCategoryId)
      setAutosaveKey(key)
      clearLegacyDraftKey(normalizedCategoryId, userId)

      // 1) Fetch exact count from Supabase without 1,000-row truncation!
      const exactCount = await getTableExactCount('questions', (q) =>
        q.eq('category_id', normalizedCategoryId).eq('is_active', true)
      )

      if (exactCount === 0) {
        alert('ไม่พบข้อสอบในหมวดหมู่นี้')
        return navigate('/', { replace: true })
      }

      setTotalBankCount(exactCount)
      const initialCount = Math.min(10, exactCount)
      setSelectedCount(initialCount)
      setCustomCountInput(String(initialCount))

      // 2) Check 7-day Lightweight Auto-Save
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
      const validNum = num > totalBankCount ? totalBankCount : num
      setSelectedCount(validNum)
    }
  }

  const handleSelectCountBtn = (num) => {
    setSelectedCount(num)
    setCustomCountInput(String(num))
  }

  const handleCustomTimeChange = (val) => {
    setCustomTimeInput(val)
    if (selectedTimeLimit !== -1) {
      setSelectedTimeLimit(-1)
    }
  }

  /**
   * Resume from 7-day Lightweight Auto-Save:
   * - Fetches ONLY the saved `questionIds` in batches via `fetchByIdsInBatches`
   * - Safely skips any question IDs deleted from DB since save
   * - Restores EXACT choice shuffle order from `choiceOrders` so answers & keys match 100%
   * - Restores timer from EXACT `remainingSeconds` (Pause-on-Close Timer!)
   */
  const handleResumeAutosave = async () => {
    if (!pendingAutosave) return
    setStartingExam(true)
    setStartProgressText(`กำลังกู้คืนข้อสอบที่ทำค้างไว้ (${pendingAutosave.questionIds.length.toLocaleString()} ข้อ)...`)

    try {
      const fetchedRows = await fetchByIdsInBatches(
        'questions',
        '*',
        pendingAutosave.questionIds,
        {
          batchSize: 400,
          applyFilters: (q) => q.eq('is_active', true),
          onProgress: ({ processedIds, totalIds }) => {
            if (totalIds > 400) {
              setStartProgressText(`กำลังกู้คืนข้อสอบ ${processedIds.toLocaleString()} / ${totalIds.toLocaleString()} ข้อ...`)
            }
          }
        }
      )

      const rowById = new Map(fetchedRows.map((row) => [row.id, row]))
      const restoredQuestions = []
      for (const qId of pendingAutosave.questionIds) {
        const row = rowById.get(qId)
        if (!row) continue // Safely ignore questions deleted from DB
        const savedOrder = pendingAutosave.choiceOrders?.[qId] || null
        restoredQuestions.push(prepareQuestionWithChoiceOrder(row, savedOrder))
      }

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
      // Pause-on-Close Timer: resume strictly from saved remainingSeconds without subtracting wall-clock elapsed time
      const restoredRemaining = restoredTotalTime > 0
        ? Math.min(restoredTotalTime, Math.max(1, Number(pendingAutosave.remainingSeconds) || restoredTotalTime))
        : 0

      setQuestions(restoredQuestions)
      setUserAnswers(restoredAnswers)
      setFlaggedIds((pendingAutosave.flaggedIds || []).filter((id) => validQuestionMap.has(id)))
      setCurrentIdx(restoredIdx)
      setScore(0)
      setTotalTimeSeconds(restoredTotalTime)
      setTimeLeft(restoredRemaining)
      lastTimerSaveRef.current = restoredRemaining
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

  /**
   * True Full-Bank Randomization (100% of 2,880+ / 10,000+ questions):
   * 1) Fetch ALL active `id`s via `fetchAllPaginated` (lightweight!)
   * 2) Load user's history & unresolved mistakes via `fetchAllPaginated` (no URL overflow / 1,000-row cap!)
   * 3) Smart quota + Fisher-Yates shuffle across entire bank
   * 4) Fetch full rows ONLY for `selectedIds` via `fetchByIdsInBatches` with progress
   */
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

    // Starting a brand-new exam clears any older Auto-Save
    clearExamAutosave(autosaveKey)
    setPendingAutosave(null)

    setStartingExam(true)
    setStartProgressText('กำลังดึงรายการข้อสอบทั้งหมดเพื่อสุ่มจากทั้งคลัง...')

    try {
      const normalizedCategoryId = categoryId.trim()

      // 1) Fetch ALL active question IDs across entire category via fetchAllPaginated
      const allIdRows = await fetchAllPaginated(
        (client) =>
          client
            .from('questions')
            .select('id')
            .eq('category_id', normalizedCategoryId)
            .eq('is_active', true),
        {
          pageSize: 1000,
          orderColumn: 'id',
          onProgress: ({ fetchedCount }) => {
            if (maxQ > 1000) {
              setStartProgressText(`กำลังรวบรวมข้อสอบจากทั้งคลัง (${fetchedCount.toLocaleString()} / ${maxQ.toLocaleString()} ข้อ)...`)
            }
          }
        }
      )

      const allQuestionIds = allIdRows.map((r) => r.id)
      const allQuestionIdSet = new Set(allQuestionIds)
      if (allQuestionIds.length === 0) {
        alert('ไม่พบข้อสอบในหมวดหมู่นี้')
        return navigate('/', { replace: true })
      }
      finalCount = Math.min(finalCount, allQuestionIds.length)

      // 2) Smart Randomization: load user history & unresolved mistakes paginated (no 1,000-row cap / URL limit!)
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
            const unresolvedRows = await fetchByIdsInBatches(
              'mistake_bank',
              'id, question_id',
              [...mistakeIdSet],
              {
                batchSize: 300,
                idColumn: 'question_id',
                orderColumn: 'id',
                applyFilters: (q) => q.eq('user_id', session.user.id).eq('is_resolved', false)
              }
            )
            mistakeIdSet = new Set(unresolvedRows.map((r) => r.question_id))
          }
        } catch (historyErr) {
          console.error('ไม่สามารถโหลดประวัติข้อสอบได้ ระบบจะสุ่มจากข้อสอบทั้งหมด:', historyErr.message)
        }
      }

      // Partition ALL IDs across the entire bank (e.g., all 2,880 IDs!)
      const mistakePool = []
      const unseenPool = []
      const seenCorrectPool = []

      for (const id of allQuestionIds) {
        if (mistakeIdSet.has(id)) mistakePool.push(id)
        else if (!seenIdSet.has(id)) unseenPool.push(id)
        else seenCorrectPool.push(id)
      }

      const selectedIds = []
      // Quota 1: 20% from unresolved mistakes
      const targetMistakeCount = Math.floor(finalCount * 0.2)
      const shuffledMistakes = shuffleArray(mistakePool)
      selectedIds.push(...shuffledMistakes.slice(0, Math.min(targetMistakeCount, shuffledMistakes.length)))

      // Quota 2: Unseen questions
      const remainingForUnseen = finalCount - selectedIds.length
      if (remainingForUnseen > 0) {
        const shuffledUnseen = shuffleArray(unseenPool)
        selectedIds.push(...shuffledUnseen.slice(0, Math.min(remainingForUnseen, shuffledUnseen.length)))
      }

      // Quota 3: Fill remainder from seen-correct pool
      const remainingToFill = finalCount - selectedIds.length
      if (remainingToFill > 0) {
        const shuffledSeenCorrect = shuffleArray(seenCorrectPool)
        selectedIds.push(...shuffledSeenCorrect.slice(0, Math.min(remainingToFill, shuffledSeenCorrect.length)))
      }

      const finalOrderedIds = shuffleArray(selectedIds)

      // 3) Fetch full details ONLY for `finalOrderedIds` in safe batches
      setStartProgressText(
        finalOrderedIds.length > 400
          ? `กำลังโหลดรายละเอียดข้อสอบ 0 / ${finalOrderedIds.length.toLocaleString()} ข้อ...`
          : `กำลังโหลดข้อสอบ ${finalOrderedIds.length.toLocaleString()} ข้อ...`
      )

      const fetchedQuestions = await fetchByIdsInBatches(
        'questions',
        '*',
        finalOrderedIds,
        {
          batchSize: 400,
          onProgress: ({ processedIds, totalIds }) => {
            if (totalIds > 400) {
              setStartProgressText(`กำลังโหลดรายละเอียดข้อสอบ ${processedIds.toLocaleString()} / ${totalIds.toLocaleString()} ข้อ...`)
            }
          }
        }
      )

      const questionById = new Map(fetchedQuestions.map((q) => [q.id, q]))
      const prepared = []
      for (const id of finalOrderedIds) {
        const q = questionById.get(id)
        if (!q) continue
        prepared.push(prepareQuestionWithChoiceOrder(q, null))
      }

      setQuestions(prepared)
      setUserAnswers({})
      setFlaggedIds([])
      setCurrentIdx(0)
      setScore(0)

      const totalSecs = finalTime > 0 ? finalTime * 60 : 0
      setTotalTimeSeconds(totalSecs)
      setTimeLeft(totalSecs)
      lastTimerSaveRef.current = totalSecs

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

  // Exit Guard (0-answered -> confirm & discard Auto-Save with NO DB history; >=1 answered -> auto-saved & confirm)
  const handleBackNavigation = () => {
    if (examPhase === 'submitted' || examPhase === 'setup') {
      navigate('/')
      return
    }
    const answeredCountNow = Object.keys(userAnswers).length
    if (answeredCountNow === 0) {
      setShowExitZeroModal(true)
    } else {
      persistCurrentAutosave()
      setShowExitProgressModal(true)
    }
  }

  // Submit Guard (0-answered -> block!; partial -> confirm!; complete -> submit!)
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

    // Edge case: timer expired while user still answered 0 questions
    if (isTimeOut && answeredCountNow === 0) {
      setShowTimeOutModal(true)
      setScore(0)
      setExamPhase('submitted')
      setCurrentIdx(0)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (isTimeOut) {
      setShowTimeOutModal(true)
    }

    setSaving(true)
    let totalScore = 0
    const mistakeItems = []
    const answeredQuestionsList = []

    questions.forEach((q) => {
      const selectedDisplayIdx = userAnswers[q.id]
      // STRICT RULE: Unanswered questions are NEVER graded as mistakes and NEVER pushed to MistakeBank!
      if (selectedDisplayIdx === undefined || selectedDisplayIdx === null) {
        return
      }

      answeredQuestionsList.push(q)
      const isCorrect = selectedDisplayIdx === q.displayCorrectOption

      if (isCorrect) {
        totalScore += 1
      } else {
        const originalUserAnswerIdx = q.originalOptionIndices?.[selectedDisplayIdx]
        mistakeItems.push({
          question_id: q.id,
          user_answer: originalUserAnswerIdx !== undefined ? String(originalUserAnswerIdx) : null,
          is_resolved: false
        })
      }
    })

    setScore(totalScore)
    setExamPhase('submitted')
    setCurrentIdx(0)

    try {
      // Save session stats based on genuinely answered questions (so partial submits don't distort accuracy!)
      const { data: sessionData, error: sessionError } = await supabase
        .from('exam_sessions')
        .insert([{
          category_id: categoryId,
          total_questions: answeredQuestionsList.length,
          score: totalScore,
          completed_at: new Date().toISOString()
        }])
        .select()
        .single()

      const { data: { session } } = await supabase.auth.getSession()
      if (session && answeredQuestionsList.length > 0) {
        const answeredIds = answeredQuestionsList.map((q) => q.id)
        const existingHistory = await fetchByIdsInBatches(
          'user_question_history',
          'question_id, seen_count',
          answeredIds,
          {
            batchSize: 300,
            idColumn: 'question_id',
            orderColumn: 'question_id',
            applyFilters: (q) => q.eq('user_id', session.user.id)
          }
        )

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

        // Batch upsert user_question_history (safe even for 2,880 answered questions!)
        await runInBatches(historyRows, 200, async (chunk) => {
          const { error: historyUpsertError } = await supabase
            .from('user_question_history')
            .upsert(chunk, { onConflict: 'user_id,question_id' })
          if (historyUpsertError) throw historyUpsertError
        })
      }

      // Batch insert ONLY genuinely answered WRONG questions into mistake_bank!
      if (!sessionError && sessionData && mistakeItems.length > 0) {
        const mistakesWithSession = mistakeItems.map((item) => ({
          ...item,
          session_id: sessionData.id
        }))
        await runInBatches(mistakesWithSession, 200, async (chunk) => {
          const { error: mistakeInsertError } = await supabase
            .from('mistake_bank')
            .insert(chunk)
          if (mistakeInsertError) throw mistakeInsertError
        })
      }
    } catch (dbErr) {
      console.error('ไม่สามารถบันทึกประวัติสอบได้:', dbErr.message)
    } finally {
      setSaving(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  if (loading || startingExam) {
    return <LoadingScreen text={startingExam ? (startProgressText || 'กำลังสุ่มและโหลดข้อสอบ...') : loadingText} />
  }

  // ==========================================================================
  // PHASE 1: SETUP SCREEN (Preserves exact 10 / 20 / 30 / ทั้งหมด shortcut buttons!)
  // ==========================================================================
  if (examPhase === 'setup') {
    const maxQ = totalBankCount
    const countOptions = [10, 20, 30, maxQ].filter((val, idx, self) => val <= maxQ && self.indexOf(val) === idx)
    if (!countOptions.includes(maxQ)) countOptions.push(maxQ)

    const timeOptions = [
      { label: '🛑 ไม่จับเวลา (ชิลๆ)', value: 0 },
      { label: '⏱️ 30 นาที', value: 30 },
      { label: '⏱️ 60 นาที', value: 60 },
      { label: '✏️ กำหนดเวลาเอง', value: -1 }
    ]

    const displayTimeText = selectedTimeLimit === 0
      ? 'ไม่จับเวลา'
      : selectedTimeLimit === -1
        ? (customTimeInput ? `${customTimeInput} นาที` : 'กำหนดเอง')
        : `${selectedTimeLimit} นาที`

    const draftAnsweredCount = pendingAutosave ? Object.keys(pendingAutosave.answers || {}).length : 0

    return (
      <div className="min-h-screen bg-slate-50/70 pb-24 font-sans text-slate-800">
        <Navbar
          showNavPills={true}
          customLeftContent={
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
              <Link to="/" className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center font-bold transition-all shrink-0">←</Link>
              <div className="min-w-0">
                <span className="font-black text-sm sm:text-lg text-slate-900 tracking-tight block truncate">{categoryName}</span>
                <span className="block text-[10px] sm:text-[11px] font-bold text-teal-600 -mt-0.5 tracking-wide truncate">ตั้งค่าห้องสอบก่อนเริ่มทำข้อสอบ</span>
              </div>
            </div>
          }
        />

        <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-8 sm:mt-12 space-y-5">
          {/* 7-Day Auto-Save Resume Card */}
          {pendingAutosave && (
            <div className="w-full bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 sm:p-6 shadow-md space-y-4 animate-fadeIn">
              <div className="flex items-start gap-3">
                <span className="w-11 h-11 rounded-2xl bg-amber-200/80 text-amber-800 flex items-center justify-center text-xl shrink-0">
                  📌
                </span>
                <div className="min-w-0 space-y-1">
                  <h2 className="text-sm sm:text-base font-black text-amber-950">
                    พบการทำข้อสอบค้างไว้ {draftAnsweredCount.toLocaleString()} / {pendingAutosave.questionIds.length.toLocaleString()} ข้อ
                  </h2>
                  <p className="text-xs text-amber-900/80 leading-relaxed">
                    บันทึกล่าสุดเมื่อ{' '}
                    <strong className="font-mono">
                      {new Date(pendingAutosave.savedAt).toLocaleString('th-TH', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })} น.
                    </strong>
                    {pendingAutosave.timerConfig?.totalTimeSeconds > 0 && (
                      <> · เวลาที่หยุดพักไว้เหลือ <strong className="font-mono text-amber-950">{formatTime(pendingAutosave.remainingSeconds)}</strong></>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleResumeAutosave}
                  className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black text-xs sm:text-sm shadow-sm cursor-pointer transition-all"
                >
                  ▶️ ทำต่อจากเดิม (ข้อที่ {(pendingAutosave.currentIndex || 0) + 1})
                </button>
                <button
                  type="button"
                  onClick={handleDiscardAutosave}
                  className="sm:w-auto py-3 px-4 rounded-2xl bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs sm:text-sm cursor-pointer transition-all"
                >
                  🔄 เริ่มทำใหม่
                </button>
              </div>
            </div>
          )}

          <div className="w-full bg-white p-5 sm:p-10 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-900/5 space-y-7 sm:space-y-8 animate-fadeIn">
            <div className="text-center space-y-2 pb-6 border-b border-slate-100">
              <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
                ⚙️
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">ปรับแต่งรูปแบบการสอบของคุณ</h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                เลือกหรือพิมพ์จำนวนข้อและเวลาในการสอบที่ต้องการได้ตามใจชอบ ระบบจะทำการสุ่มโจทย์จากทั้งคลังและสลับตัวเลือกใหม่ทุกรอบครับ
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                  1. เลือกจำนวนข้อสอบ (จากทั้งหมดที่มี {maxQ.toLocaleString()} ข้อ) *
                </label>
              </div>

              {/* Exact original 4 shortcut buttons: 10 / 20 / 30 / ทั้งหมด */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {countOptions.map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => handleSelectCountBtn(cnt)}
                    className={`min-h-12 py-3 px-3 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                      selectedCount === cnt && parseInt(customCountInput, 10) === cnt
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-[1.02]'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                    }`}
                  >
                    <span className="text-base sm:text-lg font-mono">{cnt.toLocaleString()}</span>
                    <span className="text-[10px] opacity-70">{cnt === maxQ ? 'ทั้งหมด' : 'ข้อ'}</span>
                  </button>
                ))}
              </div>

              <div className="pt-1">
                <div className="flex items-center justify-between bg-slate-50/80 border border-slate-200 rounded-2xl px-4 py-2.5">
                  <span className="text-xs font-bold text-slate-600">✏️ กำหนดจำนวนข้อเอง (1 - {maxQ.toLocaleString()}):</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max={maxQ}
                      value={customCountInput}
                      onChange={(e) => handleCustomCountChange(e.target.value)}
                      placeholder={`1-${maxQ}`}
                      className="w-24 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-black text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                    />
                    <span className="text-xs font-bold text-slate-500">ข้อ</span>
                  </div>
                </div>
                {parseInt(customCountInput, 10) > maxQ && (
                  <p className="text-[11px] text-red-500 font-bold mt-1.5 pl-1">
                    * ปรับเป็น {maxQ.toLocaleString()} ข้อให้อัตโนมัติ (ไม่เกินจำนวนข้อสอบที่มีจริง)
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3.5">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                2. กำหนดเวลาในการสอบ (COUNTDOWN TIMER) *
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {timeOptions.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      if (t.value === -1) {
                        setSelectedTimeLimit(-1)
                        setCustomTimeInput((prev) => prev || '15')
                        return
                      }
                      setSelectedTimeLimit(t.value)
                      setCustomTimeInput('')
                    }}
                    className={`min-h-12 p-3.5 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer border text-left flex items-center justify-between ${
                      selectedTimeLimit === t.value
                        ? 'bg-teal-600 text-white border-teal-600 shadow-md scale-[1.01]'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                    }`}
                  >
                    <span>{t.label}</span>
                    {selectedTimeLimit === t.value && <span className="text-base">✓</span>}
                  </button>
                ))}
              </div>

              {selectedTimeLimit === -1 && (
                <div className="pt-2 animate-fadeIn">
                  <div className="flex items-center justify-between bg-teal-50/60 border-2 border-teal-500 rounded-2xl px-4 py-2.5">
                    <span className="text-xs font-bold text-teal-900">⏱️ พิมพ์จำนวนนาทีที่ต้องการ:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={customTimeInput}
                        onChange={(e) => handleCustomTimeChange(e.target.value)}
                        placeholder="เช่น 45"
                        className="w-20 px-3 py-1.5 bg-white border border-teal-400 rounded-xl text-sm font-black text-center text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                      />
                      <span className="text-xs font-bold text-teal-800">นาที</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs sm:text-sm text-amber-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">📋</span>
                <span>สรุปการสอบรอบนี้:</span>
              </div>
              <div className="font-extrabold font-mono text-amber-950">
                {selectedCount.toLocaleString()} ข้อ &bull; {displayTimeText}
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartExamSession}
              className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black rounded-2xl text-sm sm:text-base transition-all shadow-lg hover:shadow-xl cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🚀</span><span>เริ่มจับเวลาและทำข้อสอบทันที</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentQ = questions[currentIdx]
  const isLastQuestion = currentIdx === questions.length - 1
  const answeredCount = Object.keys(userAnswers).length
  const unansweredCount = Math.max(0, questions.length - answeredCount)
  const isAllAnswered = answeredCount === questions.length

  const timePercent = totalTimeSeconds > 0 ? (timeLeft / totalTimeSeconds) * 100 : 100
  const isTimeCritical = totalTimeSeconds > 0 && timePercent <= 20

  return (
    <div className="min-h-screen bg-slate-50/70 pb-24 font-sans text-slate-800 relative overflow-x-hidden">
      {/* Guard 1: Exit while answeredCount === 0 */}
      <ConfirmModal
        isOpen={showExitZeroModal}
        type="warning"
        title="คุณยังไม่ได้ทำข้อสอบเลย ต้องการออกจากห้องสอบใช่หรือไม่?"
        description="หากกดยืนยันออก ระบบจะล้างรอบนี้ทิ้งโดยไม่บันทึกประวัติใดๆ ลงสถิติหรือคลังข้อผิดพลาดครับ"
        cancelText="← ไม่ออก / ทำต่อ"
        confirmText="🚪 ยืนยันออก"
        onClose={() => setShowExitZeroModal(false)}
        onConfirm={() => {
          clearExamAutosave(autosaveKey)
          navigate('/')
        }}
      />

      {/* Guard 2: Exit while answeredCount >= 1 (Auto-Saved for 7 days with paused timer!) */}
      <ConfirmModal
        isOpen={showExitProgressModal}
        type="info"
        title="พักการทำข้อสอบและกลับหน้าหลักใช่หรือไม่?"
        description={
          <>
            คุณทำไปแล้ว <strong className="text-teal-600 font-mono text-sm sm:text-base">{answeredCount.toLocaleString()}</strong> / {questions.length.toLocaleString()} ข้อ<br />
            ระบบได้บันทึกความคืบหน้า (Auto-Save 7 วัน) และ<strong className="text-slate-900">หยุดเวลาที่เหลือไว้ให้แล้ว</strong> คุณสามารถกลับมาทำต่อจากเดิมได้ทุกเมื่อครับ
          </>
        }
        cancelText="← ทำข้อสอบต่อ"
        confirmText="💾 พักไว้แล้วกลับหน้าหลัก"
        onClose={() => setShowExitProgressModal(false)}
        onConfirm={() => {
          persistCurrentAutosave()
          navigate('/')
        }}
      />

      {/* Guard 3: Submit blocked at 0 answered */}
      <ConfirmModal
        isOpen={showZeroSubmitModal}
        type="warning"
        title="ยังส่งข้อสอบไม่ได้!"
        description="กรุณาทำข้อสอบอย่างน้อย 1 ข้อก่อนส่งคำตอบครับ"
        confirmText="✨ เข้าใจแล้ว กลับไปทำข้อสอบ"
        cancelText=""
        onConfirm={() => setShowZeroSubmitModal(false)}
        onClose={() => setShowZeroSubmitModal(false)}
      />

      {/* Guard 4: Partial Submit Confirmation (answeredCount >= 1 && < total) */}
      <ConfirmModal
        isOpen={showPartialSubmitModal}
        type="warning"
        title="ยืนยันส่งข้อสอบเลยใช่หรือไม่?"
        description={
          <>
            ทำไปแล้ว <strong className="text-teal-700 font-mono">{answeredCount.toLocaleString()} / {questions.length.toLocaleString()} ข้อ</strong> — ยังมีข้อที่ยังไม่ได้ทำอีก{' '}
            <strong className="text-amber-700 font-mono">{unansweredCount.toLocaleString()} ข้อ</strong><br />
            ข้อที่ยังไม่ได้ทำจะ<strong>ไม่แสดงเฉลย</strong>และ<strong>ไม่ถูกเก็บเข้าคลังข้อผิดพลาด</strong> ต้องการส่งข้อสอบเลยหรือไม่?
          </>
        }
        cancelText="← กลับไปทำต่อ"
        confirmText="🚀 ยืนยันส่งข้อสอบเลย"
        onClose={() => setShowPartialSubmitModal(false)}
        onConfirm={() => executeSubmitExam(false)}
      />

      {/* Time Out Notice */}
      <ConfirmModal
        isOpen={showTimeOutModal}
        type="info"
        title="⏳ หมดเวลาทำข้อสอบแล้ว!"
        description="ระบบได้ส่งคำตอบที่คุณทำไว้เรียบร้อยแล้ว ข้อที่เว้นว่างจะถูกซ่อนเฉลยและไม่เก็บเข้าคลังข้อผิดพลาดครับ"
        confirmText="💡 ดูผลคะแนนและเฉลย"
        cancelText=""
        onConfirm={() => setShowTimeOutModal(false)}
        onClose={() => setShowTimeOutModal(false)}
      />

      <ExamHeader
        categoryName={categoryName}
        questionsLength={questions.length}
        examPhase={examPhase}
        score={score}
        answeredCount={answeredCount}
        isAllAnswered={isAllAnswered}
        totalTimeSeconds={totalTimeSeconds}
        timeLeft={timeLeft}
        timePercent={timePercent}
        isTimeCritical={isTimeCritical}
        formatTime={formatTime}
        onBackNavigation={handleBackNavigation}
      />

      {examPhase === 'submitted' ? (
        <ExamReviewList
          questions={questions}
          userAnswers={userAnswers}
          score={score}
          answeredCount={answeredCount}
          categoryName={categoryName}
          onRestartExam={() => {
            setExamPhase('setup')
            setQuestions([])
            setUserAnswers({})
            setCurrentIdx(0)
            initExamSetup()
          }}
          onGoHome={() => navigate('/')}
        />
      ) : (
        <div className="max-w-6xl mx-auto px-3 sm:px-6 mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8 min-w-0">
          {currentQ && (
            <QuestionCard
              currentQ={currentQ}
              currentIdx={currentIdx}
              questionsLength={questions.length}
              examPhase={examPhase}
              userAnswers={userAnswers}
              isLastQuestion={isLastQuestion}
              isAllAnswered={isAllAnswered}
              saving={saving}
              onSelectOption={handleSelectOption}
              onPrevious={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
              onNext={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
              onSubmit={handleRequestSubmit}
            />
          )}

          <ExamNavigator
            questions={questions}
            userAnswers={userAnswers}
            currentIdx={currentIdx}
            examPhase={examPhase}
            answeredCount={answeredCount}
            saving={saving}
            onSelectQuestion={setCurrentIdx}
            onSubmitExam={handleRequestSubmit}
          />
        </div>
      )}
    </div>
  )
}
