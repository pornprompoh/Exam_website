/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Navbar from '../../components/common/Navbar'
import LoadingScreen from '../../components/common/LoadingScreen'
import ConfirmModal from '../../components/common/ConfirmModal'
import ExamHeader from '../../components/exam/ExamHeader'
import QuestionCard from '../../components/exam/QuestionCard'
import ExamNavigator from '../../components/exam/ExamNavigator'

// 🌟 ฟังก์ชันสุ่มที่ได้มาตรฐาน (Fisher-Yates) กระจายตัวดีกว่า Math.random() ทั่วไป
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const EXAM_DRAFT_MAX_AGE = 24 * 60 * 60 * 1000

function getExamDraftKey(categoryId, userId) {
  return `exam-session-draft:${userId || 'anonymous'}:${categoryId}`
}

function readExamDraft(key, categoryId) {
  try {
    const rawDraft = localStorage.getItem(key)
    if (!rawDraft) return null
    const draft = JSON.parse(rawDraft)
    const isValid = draft.categoryId === categoryId &&
      Number.isFinite(draft.savedAt) &&
      draft.savedAt <= Date.now() &&
      Date.now() - draft.savedAt < EXAM_DRAFT_MAX_AGE &&
      Array.isArray(draft.questions) &&
      draft.questions.length > 0 &&
      draft.userAnswers &&
      typeof draft.userAnswers === 'object' &&
      !Array.isArray(draft.userAnswers) &&
      Number.isInteger(draft.currentIdx) &&
      Number.isFinite(draft.timeLeft) &&
      Number.isFinite(draft.totalTimeSeconds) &&
      draft.timeLeft >= 0 &&
      draft.totalTimeSeconds >= draft.timeLeft
    if (isValid) return draft
    localStorage.removeItem(key)
  } catch (error) {
    console.error('ไม่สามารถอ่านฉบับร่างข้อสอบจากเครื่องได้:', error)
    clearExamDraft(key)
  }
  return null
}

function clearExamDraft(key) {
  if (!key) return
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.error('ไม่สามารถลบฉบับร่างข้อสอบจากเครื่องได้:', error)
  }
}

export default function ExamSession() {
  const { categoryId } = useParams()
  const [searchParams] = useSearchParams()
  const categoryName = searchParams.get('title') || 'ทดสอบข้อสอบ'
  const navigate = useNavigate()

  const [allRawQuestions, setAllRawQuestions] = useState([])
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [userAnswers, setUserAnswers] = useState({})
  const [score, setScore] = useState(0)
  const [saving, setSaving] = useState(false)
  
  const [showExitModal, setShowExitModal] = useState(false)
  const [showIncompleteModal, setShowIncompleteModal] = useState(false)
  const [showTimeOutModal, setShowTimeOutModal] = useState(false)

  const [examPhase, setExamPhase] = useState('setup')
  const [selectedCount, setSelectedCount] = useState(10)
  const [customCountInput, setCustomCountInput] = useState('') 
  const [selectedTimeLimit, setSelectedTimeLimit] = useState(0)
  const [customTimeInput, setCustomTimeInput] = useState('') 
  const [timeLeft, setTimeLeft] = useState(0)
  const [totalTimeSeconds, setTotalTimeSeconds] = useState(0)
  const [draftKey, setDraftKey] = useState('')

  useEffect(() => {
    fetchRawQuestions()
  }, [categoryId])

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (examPhase === 'testing' && Object.keys(userAnswers).length > 0) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [examPhase, userAnswers])

  useEffect(() => {
    if (examPhase !== 'testing' || questions.length === 0 || !draftKey) return
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        categoryId,
        questions,
        currentIdx,
        userAnswers,
        timeLeft,
        totalTimeSeconds,
        savedAt: Date.now()
      }))
    } catch (error) {
      console.error('ไม่สามารถบันทึกฉบับร่างข้อสอบลงเครื่องได้:', error)
    }
  }, [categoryId, currentIdx, draftKey, examPhase, questions, timeLeft, totalTimeSeconds, userAnswers])

  useEffect(() => {
    let timer = null
    if (examPhase === 'testing' && totalTimeSeconds > 0) {
      if (timeLeft > 0) {
        timer = setInterval(() => {
          setTimeLeft((prev) => prev - 1)
        }, 1000)
      } else {
        handleSubmitExam(true)
      }
    }
    return () => clearInterval(timer)
  }, [examPhase, timeLeft, totalTimeSeconds])

  async function fetchRawQuestions() {
    setLoading(true)
    try {
      const normalizedCategoryId = typeof categoryId === 'string' ? categoryId.trim() : ''
      const invalidCategoryId = !normalizedCategoryId ||
        ['undefined', 'null'].includes(normalizedCategoryId.toLowerCase())

      if (invalidCategoryId) {
        alert('ไม่พบหมวดหมู่วิชาที่เลือก')
        return navigate('/', { replace: true })
      }

      const { data: { session } } = await supabase.auth.getSession()
      const currentDraftKey = getExamDraftKey(normalizedCategoryId, session?.user?.id)
      setDraftKey(currentDraftKey)
      const savedDraft = readExamDraft(currentDraftKey, normalizedCategoryId)

      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('category_id', normalizedCategoryId)
        .eq('is_active', true)

      if (error) throw error
      if (!data || data.length === 0) {
        alert('ไม่พบข้อสอบในหมวดหมู่นี้')
        return navigate('/', { replace: true })
      }

      setAllRawQuestions(data)
      const activeQuestionIds = new Set(data.map((question) => question.id))
      const savedQuestions = new Map((savedDraft?.questions || []).map((question) => [question.id, question]))
      const isDraftUsable = savedDraft &&
        savedDraft.questions.every((question) => (
          activeQuestionIds.has(question.id) &&
          Array.isArray(question.displayOptions) &&
          question.displayOptions.length > 0 &&
          Number.isInteger(question.displayCorrectOption) &&
          question.displayCorrectOption >= 0 &&
          question.displayCorrectOption < question.displayOptions.length &&
          Array.isArray(question.originalOptionIndices) &&
          question.originalOptionIndices.length === question.displayOptions.length
        )) &&
        Object.entries(savedDraft.userAnswers).every(([questionId, answerIndex]) => {
          const question = savedQuestions.get(questionId)
          return question && Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex < question.displayOptions.length
        })
      if (savedDraft && isDraftUsable) {
        setQuestions(savedDraft.questions)
        setUserAnswers(savedDraft.userAnswers)
        setCurrentIdx(Math.min(Math.max(Number(savedDraft.currentIdx) || 0, 0), savedDraft.questions.length - 1))
        setTotalTimeSeconds(Math.max(Number(savedDraft.totalTimeSeconds) || 0, 0))
        setTimeLeft(Math.max(Number(savedDraft.timeLeft) || 0, 0))
        setExamPhase('testing')
        return
      }
      if (savedDraft) clearExamDraft(currentDraftKey)

      const initialCount = Math.min(10, data.length)
      setSelectedCount(initialCount)
      setCustomCountInput(String(initialCount))
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCustomCountChange = (val) => {
    setCustomCountInput(val)
    const num = parseInt(val, 10)
    if (!isNaN(num) && num > 0) {
      const maxQ = allRawQuestions.length
      const validNum = num > maxQ ? maxQ : num
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

  const handleStartExamSession = async () => {
    const maxQ = allRawQuestions.length
    let finalCount = parseInt(customCountInput, 10)
    if (isNaN(finalCount) || finalCount <= 0) finalCount = Math.min(10, maxQ)
    if (finalCount > maxQ) finalCount = maxQ

    let finalTime = selectedTimeLimit
    if (selectedTimeLimit === -1) {
      finalTime = parseInt(customTimeInput, 10)
      if (isNaN(finalTime) || finalTime <= 0) finalTime = 15
      if (finalTime > 120) finalTime = 120
    }

    // 🌟 ระบบสุ่มแบบอัจฉริยะ (Smart Randomization)
    let session = null
    try {
      const { data } = await supabase.auth.getSession()
      session = data?.session || null
    } catch (sessionError) {
      console.error('ไม่สามารถตรวจสอบ session ได้ ระบบจะเริ่มสอบโดยไม่ใช้ประวัติส่วนตัว:', sessionError)
    }
    let seenIds = []
    let mistakeIds = []

    if (session && allRawQuestions.length > 0) {
      const questionIds = allRawQuestions.map((question) => question.id)
      const { data: historyData, error: historyError } = await supabase
        .from('user_question_history')
        .select('question_id, seen_count, last_result')
        .eq('user_id', session.user.id)
        .in('question_id', questionIds)

      if (historyError) {
        console.error('ไม่สามารถโหลดประวัติข้อสอบได้ ระบบจะสุ่มจากข้อสอบทั้งหมด:', historyError.message)
      } else {
        const historyByQuestionId = new Map(
          (historyData || []).map((item) => [item.question_id, item])
        )
        seenIds = [...historyByQuestionId.entries()]
          .filter(([, item]) => Number(item.seen_count) > 0)
          .map(([questionId]) => questionId)
        mistakeIds = [...historyByQuestionId.entries()]
          .filter(([, item]) => item.last_result === 'wrong')
          .map(([questionId]) => questionId)
      }
    }

    if (!session) {
      console.info('ไม่พบ session ผู้ใช้ จึงเริ่มสอบโดยไม่ใช้ประวัติส่วนตัว')
    }

    /* Keep the detailed mistake bank separate from history; history determines
       the latest result while mistake_bank stores the answer and explanation. */
    if (session && mistakeIds.length > 0) {
      const { data: unresolvedMistakes, error: mistakeError } = await supabase
        .from('mistake_bank')
        .select('question_id')
        .eq('user_id', session.user.id)
        .eq('is_resolved', false)
        .in('question_id', mistakeIds)

      if (mistakeError) {
        console.error('ไม่สามารถโหลดรายละเอียดข้อผิดได้ ระบบจะใช้ประวัติผลล่าสุดแทน:', mistakeError.message)
      } else {
        mistakeIds = [...new Set((unresolvedMistakes || []).map((item) => item.question_id))]
      }
    }

    // แบ่งกลุ่มข้อสอบ
    const mistakePool = allRawQuestions.filter(q => mistakeIds.includes(q.id))
    const unseenPool = allRawQuestions.filter(q => !seenIds.includes(q.id))
    const seenCorrectPool = allRawQuestions.filter(q => seenIds.includes(q.id) && !mistakeIds.includes(q.id))

    let selectedQuestions = []
    
    // โควต้า 1: ดึงข้อที่เคยทำ "ผิด" มาให้ทำใหม่ (ประมาณ 20% ของจำนวนที่จะสอบ)
    let targetMistakeCount = Math.floor(finalCount * 0.2)
    const shuffledMistakes = shuffleArray(mistakePool)
    const actualMistakeCount = Math.min(targetMistakeCount, shuffledMistakes.length)
    selectedQuestions.push(...shuffledMistakes.slice(0, actualMistakeCount))

    // โควต้า 2: ดึงข้อที่ "ยังไม่เคยทำ" (ประมาณ 80% หรือเติมให้เต็ม)
    const remainingForUnseen = finalCount - selectedQuestions.length
    const shuffledUnseen = shuffleArray(unseenPool)
    const actualUnseenCount = Math.min(remainingForUnseen, shuffledUnseen.length)
    selectedQuestions.push(...shuffledUnseen.slice(0, actualUnseenCount))

    // โควต้า 3: ถ้าข้อสอบยังไม่ครบตามจำนวน (แปลว่าทำเกือบหมดคลังแล้ว) ให้เอาข้อที่เคยทำถูกมาวนซ้ำ
    const remainingToFill = finalCount - selectedQuestions.length
    if (remainingToFill > 0) {
      const shuffledSeenCorrect = shuffleArray(seenCorrectPool)
      selectedQuestions.push(...shuffledSeenCorrect.slice(0, Math.min(remainingToFill, shuffledSeenCorrect.length)))
    }

    // สุ่มสลับลำดับข้อสอบทั้งหมดอีกรอบ เพื่อไม่ให้ข้อผิดไปกองอยู่หน้าแรกๆ
    const finalSelectedSlice = shuffleArray(selectedQuestions)

    // จัดเตรียมตัวเลือก (สลับช้อยส์ด้วย Fisher-Yates)
    const prepared = finalSelectedSlice.map((q) => {
      if (!q.is_options_randomized || !q.options) {
        return { 
          ...q, 
          displayOptions: q.options, 
          displayCorrectOption: Number(q.correct_option),
          originalOptionIndices: q.options?.map((_, index) => index) || []
        }
      }
      
      const optionsWithOriginalIdx = q.options.map((opt, idx) => ({ text: opt, originalIdx: idx }))
      const shuffledOptions = shuffleArray(optionsWithOriginalIdx) // สลับช้อยส์
      const newCorrectIdx = shuffledOptions.findIndex((item) => item.originalIdx === Number(q.correct_option))

      return {
        ...q,
        displayOptions: shuffledOptions.map((item) => item.text),
        displayCorrectOption: newCorrectIdx,
        originalOptionIndices: shuffledOptions.map((item) => item.originalIdx)
      }
    })

    setQuestions(prepared)
    setUserAnswers({})
    setCurrentIdx(0)
    setScore(0)

    if (finalTime > 0) {
      const seconds = finalTime * 60
      setTotalTimeSeconds(seconds)
      setTimeLeft(seconds)
    } else {
      setTotalTimeSeconds(0)
      setTimeLeft(0)
    }

    setExamPhase('testing')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSelectOption = (questionId, optionIdx) => {
    if (examPhase !== 'testing') return
    setUserAnswers((prev) => ({ ...prev, [questionId]: optionIdx }))
  }

  const handleBackNavigation = () => {
    if (examPhase === 'submitted' || examPhase === 'setup' || Object.keys(userAnswers).length === 0) {
      clearExamDraft(draftKey)
      navigate('/')
    } else {
      setShowExitModal(true)
    }
  }

  async function handleSubmitExam(isTimeOut = false) {
    clearExamDraft(draftKey)
    const answeredCount = Object.keys(userAnswers).length

    if (!isTimeOut) {
      if (answeredCount < questions.length) {
        return setShowIncompleteModal(true)
      }
    } else {
      setShowTimeOutModal(true)
    }

    setSaving(true)
    let totalScore = 0
    const mistakeItems = []
    const resolvedQuestionIds = []

    questions.forEach((q) => {
      const selectedDisplayIdx = userAnswers[q.id]
      const isCorrect = selectedDisplayIdx !== undefined && selectedDisplayIdx === q.displayCorrectOption

      if (isCorrect) {
        totalScore += 1
        resolvedQuestionIds.push(q.id)
      } else {
        const originalUserAnswerIdx = selectedDisplayIdx !== undefined 
          ? q.originalOptionIndices[selectedDisplayIdx] 
          : null

        mistakeItems.push({
          question_id: q.id,
          user_answer: originalUserAnswerIdx !== null ? String(originalUserAnswerIdx) : null,
          is_resolved: false
        })
        
      }
    })

    setScore(totalScore)
    setExamPhase('submitted')
    setCurrentIdx(0)

    try {
      const { data: sessionData, error: sessionError } = await supabase
        .from('exam_sessions')
        .insert([{
          category_id: categoryId,
          total_questions: questions.length,
          score: totalScore,
          completed_at: new Date().toISOString()
        }])
        .select()
        .single()

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const questionIds = questions.map((question) => question.id)
        const { data: existingHistory, error: historyReadError } = await supabase
          .from('user_question_history')
          .select('question_id, seen_count')
          .eq('user_id', session.user.id)
          .in('question_id', questionIds)

        if (historyReadError) throw historyReadError

        const existingCountByQuestionId = new Map(
          (existingHistory || []).map((item) => [item.question_id, Number(item.seen_count) || 0])
        )
        const historyRows = questions.map((question) => {
          const selectedDisplayIdx = userAnswers[question.id]
          const result = selectedDisplayIdx === undefined
            ? 'unanswered'
            : selectedDisplayIdx === question.displayCorrectOption
              ? 'correct'
              : 'wrong'

          return {
            user_id: session.user.id,
            question_id: question.id,
            seen_count: (existingCountByQuestionId.get(question.id) || 0) + 1,
            last_seen_at: new Date().toISOString(),
            last_result: result
          }
        })

        const { error: historyUpsertError } = await supabase
          .from('user_question_history')
          .upsert(historyRows, { onConflict: 'user_id,question_id' })
        if (historyUpsertError) throw historyUpsertError
      }

      if (!sessionError && sessionData && mistakeItems.length > 0) {
        const mistakesWithSession = mistakeItems.map(item => ({ ...item, session_id: sessionData.id }))
        const { error: mistakeInsertError } = await supabase
          .from('mistake_bank')
          .insert(mistakesWithSession)
        if (mistakeInsertError) throw mistakeInsertError
      }

      if (resolvedQuestionIds.length > 0) {
        if (session) {
          const { error: resolveError } = await supabase
            .from('user_question_history')
            .update({ last_result: 'correct', last_seen_at: new Date().toISOString() })
            .eq('user_id', session.user.id)
            .in('question_id', resolvedQuestionIds)
          if (resolveError) throw resolveError
        }
      }
    } catch (dbErr) {
      console.error('ไม่สามารถบันทึกประวัติสอบได้:', dbErr.message)
    } finally {
      setSaving(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  if (loading) {
    return <LoadingScreen text="กำลังเตรียมคลังข้อสอบให้พร้อม..." />
  }

  if (examPhase === 'setup') {
    const maxQ = allRawQuestions.length
    const countOptions = [10, 20, 30, maxQ].filter((val, idx, self) => val <= maxQ && self.indexOf(val) === idx)
    if (!countOptions.includes(maxQ)) countOptions.push(maxQ)

    const timeOptions = [
      { label: '🛑 ไม่จับเวลา (ชิลๆ)', value: 0 },
      { label: '⏱️ 30 นาที', value: 30 },
      { label: '⏱️ 60 นาที', value: 60 },
      { label: '✏️ กำหนดเวลาเอง', value: -1 },
    ]

    const displayTimeText = selectedTimeLimit === 0 
      ? 'ไม่จับเวลา' 
      : selectedTimeLimit === -1 
        ? (customTimeInput ? `${customTimeInput} นาที` : 'กำหนดเอง') 
        : `${selectedTimeLimit} นาที`

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

        <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-8 sm:mt-12">
          <div className="w-full bg-white p-5 sm:p-10 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-900/5 space-y-7 sm:space-y-8 animate-fadeIn">
            
            <div className="text-center space-y-2 pb-6 border-b border-slate-100">
              <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
                ⚙️
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">ปรับแต่งรูปแบบการสอบของคุณ</h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                เลือกหรือพิมพ์จำนวนข้อและเวลาในการสอบที่ต้องการได้ตามใจชอบ ระบบจะทำการสุ่มโจทย์และสลับตัวเลือกใหม่ทุกรอบครับ
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                  1. เลือกจำนวนข้อสอบ (จากทั้งหมดที่มี {maxQ} ข้อ) *
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {countOptions.map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => handleSelectCountBtn(cnt)}
                    className={`min-h-12 py-3 px-3 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                      selectedCount === cnt && parseInt(customCountInput) === cnt
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-[1.02]'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                    }`}
                  >
                    <span className="text-base sm:text-lg font-mono">{cnt}</span>
                    <span className="text-[10px] opacity-70">{cnt === maxQ ? 'ทั้งหมด' : 'ข้อ'}</span>
                  </button>
                ))}
              </div>

              <div className="pt-1">
                <div className="flex items-center justify-between bg-slate-50/80 border border-slate-200 rounded-2xl px-4 py-2.5">
                  <span className="text-xs font-bold text-slate-600">✏️ กำหนดจำนวนข้อเอง (1 - {maxQ}):</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max={maxQ}
                      value={customCountInput}
                      onChange={(e) => handleCustomCountChange(e.target.value)}
                      placeholder={`1-${maxQ}`}
                      className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-black text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                    />
                    <span className="text-xs font-bold text-slate-500">ข้อ</span>
                  </div>
                </div>
                {parseInt(customCountInput) > maxQ && (
                  <p className="text-[11px] text-red-500 font-bold mt-1.5 pl-1">* ปรับเป็น {maxQ} ข้อให้อัตโนมัติ (ไม่เกินจำนวนข้อสอบที่มีจริง)</p>
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
                {selectedCount} ข้อ &bull; {displayTimeText}
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
  const isAllAnswered = answeredCount === questions.length

  const timePercent = totalTimeSeconds > 0 ? (timeLeft / totalTimeSeconds) * 100 : 100
  const isTimeCritical = totalTimeSeconds > 0 && timePercent <= 20

  return (
    <div className="min-h-screen bg-slate-50/70 pb-24 font-sans text-slate-800 relative overflow-x-hidden">
      
      {/* Modals... */}
      <ConfirmModal
        isOpen={showExitModal}
        type="danger"
        title="ต้องการออกจากห้องสอบใช่หรือไม่?"
        description={
          <>
            คุณกำลังอยู่ในระหว่างการทำข้อสอบ (ทำไปแล้ว <strong className="text-teal-600 font-mono text-sm sm:text-base">{answeredCount}</strong> / {questions.length} ข้อ)<br/>
            หากกดออกจากห้องสอบตอนนี้ <span className="text-red-600 font-bold underline decoration-2">ความคืบหน้าและเวลาที่นับอยู่จะไม่ถูกบันทึก</span> และต้องเริ่มตั้งค่าสอบใหม่ครับ
          </>
        }
        cancelText="← กลับไปทำข้อสอบต่อ"
        confirmText="🚪 ยืนยันออกทันที"
        onClose={() => setShowExitModal(false)}
        onConfirm={() => {
          clearExamDraft(draftKey)
          navigate('/')
        }}
      />

      <ConfirmModal
        isOpen={showIncompleteModal}
        type="warning"
        title="คุณยังทำข้อสอบไม่ครบทุกข้อ!"
        description={`คุณทำไปได้เพียง ${answeredCount} จากทั้งหมด ${questions.length} ข้อ กรุณาทำข้อที่เหลือให้ครบถ้วนก่อนส่งข้อสอบและตรวจคะแนนครับ`}
        confirmText="✨ เข้าใจแล้ว กลับไปทำต่อ"
        cancelText="ปิด"
        onConfirm={() => setShowIncompleteModal(false)}
        onClose={() => setShowIncompleteModal(false)}
      />

      <ConfirmModal
        isOpen={showTimeOutModal}
        type="info"
        title="⏳ หมดเวลาทำข้อสอบแล้ว!"
        description="ระบบได้ทำการส่งคำตอบล่าสุดของคุณ และกำลังประมวลผลคะแนนสอบโดยอัตโนมัติ กรุณารอสักครู่ครับ"
        confirmText="💡 ดูเฉลยและคะแนนสอบ"
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

      <div className="max-w-6xl mx-auto px-3 sm:px-6 mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8 min-w-0">
        
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
          onSubmit={() => handleSubmitExam(false)}
        />

        <ExamNavigator
          questions={questions}
          userAnswers={userAnswers}
          currentIdx={currentIdx}
          examPhase={examPhase}
          answeredCount={answeredCount}
          onSelectQuestion={setCurrentIdx}
        />
        </div>
    </div>
  )
}
