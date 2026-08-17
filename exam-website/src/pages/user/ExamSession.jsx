import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Navbar from '../../components/common/Navbar'
import LoadingScreen from '../../components/common/LoadingScreen'
import ConfirmModal from '../../components/common/ConfirmModal'

// 🌟 ฟังก์ชันสุ่มที่ได้มาตรฐาน (Fisher-Yates) กระจายตัวดีกว่า Math.random() ทั่วไป
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

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
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('category_id', categoryId)
        .eq('is_active', true)

      if (error) throw error
      if (!data || data.length === 0) {
        alert('ไม่พบข้อสอบในหมวดหมู่นี้')
        return navigate('/')
      }

      setAllRawQuestions(data)
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

  const handleStartExamSession = () => {
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
    const storageSeenKey = `seen_questions_cat_${categoryId}`
    const storageMistakeKey = `mistake_questions_cat_${categoryId}`
    
    // ดึงประวัติจาก LocalStorage
    const seenIds = JSON.parse(localStorage.getItem(storageSeenKey)) || []
    const mistakeIds = JSON.parse(localStorage.getItem(storageMistakeKey)) || []

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
          originalOptionIndices: [0, 1, 2, 3]
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
      navigate('/')
    } else {
      setShowExitModal(true)
    }
  }

  async function handleSubmitExam(isTimeOut = false) {
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

    // 🌟 เตรียมตัวแปรเพื่อบันทึกประวัติลง LocalStorage
    const storageSeenKey = `seen_questions_cat_${categoryId}`
    const storageMistakeKey = `mistake_questions_cat_${categoryId}`
    let currentSeenIds = JSON.parse(localStorage.getItem(storageSeenKey)) || []
    let currentMistakeIds = JSON.parse(localStorage.getItem(storageMistakeKey)) || []

    questions.forEach((q) => {
      const selectedDisplayIdx = userAnswers[q.id]
      const isCorrect = selectedDisplayIdx !== undefined && selectedDisplayIdx === q.displayCorrectOption

      // บันทึกว่าข้อนี้เคยเห็นแล้ว (Seen)
      if (!currentSeenIds.includes(q.id)) {
        currentSeenIds.push(q.id)
      }

      if (isCorrect) {
        totalScore += 1
        // ถ้าตอบถูก ให้ลบข้อนี้ออกจากรายการข้อที่เคยทำผิด
        currentMistakeIds = currentMistakeIds.filter(id => id !== q.id)
      } else {
        const originalUserAnswerIdx = selectedDisplayIdx !== undefined 
          ? q.originalOptionIndices[selectedDisplayIdx] 
          : null

        mistakeItems.push({
          question_id: q.id,
          user_answer: originalUserAnswerIdx !== null ? String(originalUserAnswerIdx) : null,
          is_resolved: false
        })
        
        // ถ้าตอบผิด ให้เพิ่มข้อนี้เข้าไปในรายการข้อที่เคยทำผิด
        if (!currentMistakeIds.includes(q.id)) {
          currentMistakeIds.push(q.id)
        }
      }
    })

    // บันทึกประวัติอัปเดตกลับลงเครื่อง
    localStorage.setItem(storageSeenKey, JSON.stringify(currentSeenIds))
    localStorage.setItem(storageMistakeKey, JSON.stringify(currentMistakeIds))

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

      if (!sessionError && sessionData && mistakeItems.length > 0) {
        const mistakesWithSession = mistakeItems.map(item => ({ ...item, session_id: sessionData.id }))
        await supabase.from('mistake_bank').insert(mistakesWithSession)
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
          <div className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-900/5 space-y-8 animate-fadeIn">
            
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
                    className={`py-3 px-3 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
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
                    className={`p-3.5 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer border text-left flex items-center justify-between ${
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
        onConfirm={() => navigate('/')}
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

      <Navbar 
        showNavPills={false}
        customLeftContent={
          <div className="flex items-center gap-2 sm:gap-4 shrink-0 min-w-0">
            <button 
              onClick={handleBackNavigation}
              className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 rounded-xl flex items-center justify-center text-sm font-bold transition-all cursor-pointer shadow-2xs shrink-0"
              title="กลับไปเลือกวิชา"
            >
              ←
            </button>
            <div className="min-w-0">
              <span className="font-black text-sm sm:text-lg text-slate-900 tracking-tight block truncate">{categoryName}</span>
              <span className="block text-[10px] sm:text-[11px] font-bold text-teal-600 -mt-0.5 tracking-wide truncate flex items-center gap-1.5">
                <span>📝 โหมดทดสอบ</span><span className="w-1 h-1 rounded-full bg-teal-300"></span><span>{questions.length} ข้อ</span>
              </span>
            </div>
          </div>
        }
        customRightContent={
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {examPhase === 'submitted' ? (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 sm:px-5 py-2 rounded-xl font-black text-xs sm:text-sm shadow-md flex items-center gap-1.5 shrink-0 animate-fadeIn">
                <span>🏆</span><span className="hidden sm:inline">ผลการสอบ:</span><span className="text-sm sm:text-base underline decoration-2">{score}</span><span>/{questions.length}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 sm:p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs shrink-0">
                {totalTimeSeconds > 0 && (
                  <div className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl font-mono font-black text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-sm border ${
                    isTimeCritical 
                      ? 'bg-red-500 text-white border-red-600 animate-pulse' 
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}>
                    <span>⏳</span>
                    <span>{formatTime(timeLeft)}</span>
                  </div>
                )}
                
                <div className="bg-white border border-slate-200 text-slate-600 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm shrink-0">
                  <span className={`w-2 h-2 rounded-full inline-block ${isAllAnswered ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`}></span>
                  <span className="hidden sm:inline">ทำแล้ว</span>
                  <span><strong className="text-teal-600 font-mono text-xs sm:text-sm">{answeredCount}</strong>/{questions.length}</span>
                </div>
              </div>
            )}
          </div>
        }
      />

      {examPhase === 'testing' && (
        <div className="w-full bg-slate-200 h-1.5 sticky top-16 z-20 overflow-hidden shadow-sm">
          <div 
            className={`h-full transition-all duration-1000 ease-linear ${
              totalTimeSeconds > 0 && isTimeCritical ? 'bg-red-500' : 'bg-gradient-to-r from-teal-400 to-emerald-500'
            }`}
            style={{ width: `${totalTimeSeconds > 0 ? timePercent : 100}%` }}
          />
        </div>
      )}

      <div className="max-w-6xl mx-auto px-3 sm:px-6 mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8 min-w-0">
        
        <div className="lg:col-span-3 order-1 lg:order-1 space-y-6 min-w-0">
          <div className="bg-white p-5 sm:p-10 rounded-3xl border border-slate-200/80 shadow-sm min-w-0">
            
            <div className="flex flex-wrap items-center justify-between gap-2.5 mb-5 sm:mb-6 pb-4 sm:pb-5 border-b border-slate-100">
              <span className="text-[11px] sm:text-xs font-black text-teal-700 bg-teal-50 border border-teal-200/80 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-xl uppercase tracking-wider shrink-0">
                QUESTION {currentIdx + 1} / {questions.length}
              </span>
              {examPhase === 'submitted' && (
                <span className={`text-[11px] sm:text-xs font-bold px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-xl flex items-center gap-1.5 shrink-0 ${
                  userAnswers[currentQ.id] === currentQ.displayCorrectOption ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  <span>{userAnswers[currentQ.id] === currentQ.displayCorrectOption ? '✅' : '❌'}</span>
                  <span>{userAnswers[currentQ.id] === currentQ.displayCorrectOption ? 'ถูกต้อง' : 'ตอบผิด / ไม่ได้ตอบ'}</span>
                </span>
              )}
            </div>

            <div className="text-slate-900 font-bold text-base sm:text-lg md:text-xl mb-6 leading-relaxed break-words [word-break:break-word] min-w-0">
              {currentQ.question_text}
            </div>

            {currentQ.image_url && (
              <div className="mb-6 sm:mb-8 bg-slate-50/80 p-2 sm:p-4 rounded-2xl border border-slate-200/80 flex justify-center shadow-inner overflow-hidden">
                <img src={currentQ.image_url} alt="รูปประกอบโจทย์" className="max-w-full max-h-80 object-contain rounded-xl" loading="lazy" />
              </div>
            )}

            <div className="space-y-3 min-w-0">
              {currentQ.displayOptions?.map((optionText, optIdx) => {
                const isSelected = userAnswers[currentQ.id] === optIdx
                const isCorrectOption = currentQ.displayCorrectOption === optIdx
                let cardStyle = 'border-slate-200 hover:border-teal-400 bg-white hover:bg-slate-50/50 text-slate-700'
                let badgeStyle = 'bg-slate-100 text-slate-600 border border-slate-200'

                if (examPhase === 'submitted') {
                  if (isCorrectOption) {
                    cardStyle = 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-bold shadow-xs ring-1 ring-emerald-500'
                    badgeStyle = 'bg-emerald-500 text-white font-bold border-emerald-500'
                  } else if (isSelected && !isCorrectOption) {
                    cardStyle = 'border-red-300 bg-red-50/70 text-red-900 font-semibold'
                    badgeStyle = 'bg-red-500 text-white font-bold border-red-500'
                  } else {
                    cardStyle = 'border-slate-150 bg-slate-50/40 text-slate-400 opacity-60'
                  }
                } else if (isSelected) {
                  cardStyle = 'border-teal-500 bg-teal-50/60 text-teal-950 font-bold shadow-xs ring-1 ring-teal-500'
                  badgeStyle = 'bg-teal-600 text-white font-bold border-teal-600'
                }

                return (
                  <div
                    key={optIdx}
                    onClick={() => handleSelectOption(currentQ.id, optIdx)}
                    className={`p-3.5 sm:p-4.5 rounded-2xl border transition-all flex items-start gap-3 sm:gap-3.5 min-w-0 ${examPhase === 'testing' ? 'cursor-pointer active:scale-[0.998]' : 'cursor-default'} ${cardStyle}`}
                  >
                    <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-xl text-xs flex items-center justify-center shrink-0 font-mono mt-0.5 transition-colors ${badgeStyle}`}>{optIdx + 1}</span>
                    <span className="text-xs sm:text-base leading-relaxed break-words [word-break:break-word] flex-1 min-w-0 pt-0.5">{optionText}</span>
                    {examPhase === 'submitted' && isCorrectOption && <span className="text-sm sm:text-base shrink-0">🎯</span>}
                    {examPhase === 'submitted' && isSelected && !isCorrectOption && <span className="text-sm sm:text-base shrink-0">❌</span>}
                  </div>
                )
              })}
            </div>

            {examPhase === 'submitted' && (currentQ.explanation || currentQ.explanation_image_url) && (
              <div className="mt-6 sm:mt-8 p-5 sm:p-6 bg-amber-50/80 border border-amber-200/80 rounded-3xl text-slate-800 shadow-2xs animate-fadeIn min-w-0">
                <div className="font-black text-amber-900 text-xs sm:text-sm flex items-center gap-2 mb-3"><span className="text-sm sm:text-base">💡</span><span>คำอธิบายเฉลยละเอียด:</span></div>
                {currentQ.explanation && <p className="text-xs sm:text-sm text-slate-700 leading-relaxed break-words [word-break:break-word] mb-4 min-w-0">{currentQ.explanation}</p>}
                {currentQ.explanation_image_url && (
                  <div className="mt-3 bg-white p-2 sm:p-3 rounded-2xl border border-amber-200/80 flex justify-center shadow-inner overflow-hidden">
                    <img src={currentQ.explanation_image_url} alt="รูปประกอบเฉลย" className="max-w-full max-h-72 object-contain rounded-xl" loading="lazy" />
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 sm:mt-10 pt-5 sm:pt-6 border-t border-slate-100 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 sm:gap-4">
              <button
                onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                disabled={currentIdx === 0}
                className="flex-1 sm:flex-none py-2.5 sm:py-2.5 px-4 sm:px-5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 font-bold text-xs sm:text-sm transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shrink-0"
              >
                <span>←</span><span>ข้อก่อนหน้า</span>
              </button>

              {!isLastQuestion ? (
                <button
                  onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="flex-1 sm:flex-none py-2.5 sm:py-2.5 px-5 sm:px-6 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs sm:text-sm transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>ข้อถัดไป</span><span>→</span>
                </button>
              ) : (
                examPhase === 'testing' && (
                  isAllAnswered ? (
                    <button
                      onClick={() => handleSubmitExam(false)}
                      disabled={saving}
                      className="w-full sm:w-auto py-3 sm:px-6 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2 shrink-0 order-first sm:order-none mb-2 sm:mb-0"
                    >
                      <span>✨</span><span>ส่งข้อสอบและตรวจคะแนน</span>
                    </button>
                  ) : (
                    <div className="w-full sm:w-auto py-2.5 px-4 sm:px-5 bg-amber-50 border border-amber-200 text-amber-800 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0 order-first sm:order-none mb-2 sm:mb-0 text-center">
                      <span>⚠️ กรุณาทำข้อสอบให้ครบทุกข้อก่อนส่ง</span>
                    </div>
                  )
                )
              )}
            </div>

          </div>
        </div>

        <div className="lg:col-span-1 order-2 lg:order-2">
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm sticky top-24">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2"><span>📑</span><span>แผงนำทางข้อสอบ</span></h2>
              <span className="text-[11px] font-bold text-slate-400 font-mono">{answeredCount}/{questions.length}</span>
            </div>
            
            <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2 max-h-60 sm:max-h-72 lg:max-h-80 overflow-y-auto p-1">
              {questions.map((q, idx) => {
                const isAnswered = userAnswers[q.id] !== undefined
                const isCurrent = currentIdx === idx
                let btnStyle = 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent font-semibold'
                if (examPhase === 'submitted') {
                  const isCorrect = userAnswers[q.id] === q.displayCorrectOption
                  btnStyle = isCorrect ? 'bg-emerald-500 text-white font-bold shadow-2xs shadow-emerald-500/30' : 'bg-red-500 text-white font-bold shadow-2xs shadow-red-500/30'
                } else if (isAnswered) {
                  btnStyle = 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-bold shadow-2xs shadow-teal-500/20'
                }
                if (isCurrent) btnStyle += ' ring-4 ring-teal-500/30 ring-offset-1 scale-105 z-10'

                return (
                  <button key={q.id} onClick={() => setCurrentIdx(idx)} className={`h-10 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center ${btnStyle}`}>
                    {idx + 1}
                  </button>
                )
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-500 space-y-2 font-medium">
              {examPhase === 'testing' ? (
                <>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-gradient-to-r from-teal-500 to-emerald-600 inline-block shrink-0 shadow-2xs"/><span>ทำข้อนี้แล้ว (Answered)</span></div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-slate-100 border border-slate-300 inline-block shrink-0"/><span>ยังไม่ได้ทำ (Unanswered)</span></div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-emerald-500 inline-block shrink-0 shadow-2xs"/><span>ตอบถูก (Correct)</span></div>
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-red-500 inline-block shrink-0 shadow-2xs"/><span>ตอบผิด / ไม่ได้ตอบ (Incorrect)</span></div>
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}