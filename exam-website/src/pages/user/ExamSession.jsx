import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function ExamSession() {
  const { categoryId } = useParams()
  const [searchParams] = useSearchParams()
  const categoryName = searchParams.get('title') || 'ทดสอบข้อสอบ'
  const navigate = useNavigate()

  // -- State ควบคุมข้อมูลข้อสอบ --
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  
  // เก็บคำตอบของผู้ใช้: { [id_ข้อสอบ]: index_ช้อยส์ที่เลือก }
  const [userAnswers, setUserAnswers] = useState({})
  
  // สถานะการส่งข้อสอบ: false = กำลังทำ, true = ส่งแล้ว (โหมดดูเฉลย)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchAndPrepareQuestions()
  }, [categoryId])

  async function fetchAndPrepareQuestions() {
    setLoading(true)
    try {
      // 1. ดึงข้อสอบเฉพาะวิชานี้ที่เปิดใช้งานอยู่
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

      // 2. สลับลำดับข้อสอบแบบสุ่ม (Randomize Questions)
      const shuffledQuestions = [...data].sort(() => Math.random() - 0.5)

      // 3. จัดการสลับช้อยส์ (ถ้าข้อสอบนั้นเปิดโหมด is_options_randomized ไว้)
      const preparedQuestions = shuffledQuestions.map((q) => {
        // ถ้าไม่เปิดสลับช้อยส์ ให้ใช้ช้อยส์เดิมและเฉลยเดิม
        if (!q.is_options_randomized || !q.options) {
          return { ...q, displayOptions: q.options, displayCorrectOption: Number(q.correct_option) }
        }

        // จับคู่ช้อยส์กับ index เดิมเพื่อไม่ให้ลืมว่าข้อไหนคือข้อที่ถูก
        const optionsWithOriginalIdx = q.options.map((opt, idx) => ({
          text: opt,
          originalIdx: idx
        }))

        // สลับตำแหน่งช้อยส์
        optionsWithOriginalIdx.sort(() => Math.random() - 0.5)

        // หาว่าเฉลยที่ถูกต้อง (originalIdx ตรงกับ correct_option) ตอนนี้ย้ายไปอยู่ที่ index ไหนแล้ว
        const newCorrectIdx = optionsWithOriginalIdx.findIndex(
          (item) => item.originalIdx === Number(q.correct_option)
        )

        return {
          ...q,
          displayOptions: optionsWithOriginalIdx.map((item) => item.text),
          displayCorrectOption: newCorrectIdx
        }
      })

      setQuestions(preparedQuestions)
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // เลือกช้อยส์คำตอบ
  const handleSelectOption = (questionId, optionIdx) => {
    if (isSubmitted) return // ถ้าส่งข้อสอบแล้ว ห้ามเปลี่ยนคำตอบ
    setUserAnswers((prev) => ({ ...prev, [questionId]: optionIdx }))
  }

  // ฟังก์ชันกดส่งข้อสอบและบันทึกลงฐานข้อมูล
  async function handleSubmitExam() {
    const answeredCount = Object.keys(userAnswers).length
    if (answeredCount < questions.length) {
      const confirmSubmit = window.confirm(
        `คุณทำข้อสอบไปแค่ ${answeredCount}/${questions.length} ข้อ ยืนยันที่จะส่งข้อสอบทันทีหรือไม่?`
      )
      if (!confirmSubmit) return
    } else {
      if (!window.confirm('คุณต้องการส่งข้อสอบและตรวจคะแนนใช่หรือไม่?')) return
    }

    setSaving(true)
    let totalScore = 0
    const mistakeItems = []

    // 1. ตรวจคำตอบและนับคะแนน
    questions.forEach((q) => {
      const selectedIdx = userAnswers[q.id]
      const isCorrect = selectedIdx !== undefined && selectedIdx === q.displayCorrectOption

      if (isCorrect) {
        totalScore += 1
      } else {
        // ถ้าตอบผิด หรือไม่ได้ตอบ ให้เก็บข้อมูลไว้ลงคลังข้อผิด
        mistakeItems.push({
          question_id: q.id,
          user_answer: selectedIdx !== undefined ? String(selectedIdx) : null,
          is_resolved: false
        })
      }
    })

    setScore(totalScore)
    setIsSubmitted(true)
    setCurrentIdx(0) // กลับมาโชว์เฉลยเริ่มจากข้อแรก

    // 2. บันทึกผลสอบลง Supabase (ในระบบจริงจะผูกกับ user_id ตอนนี้ใช้ null หรือจำลองก่อนได้ครับ)
    try {
      // บันทึกรอบการสอบลงตาราง exam_sessions
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

      // ถ้าบันทึกรอบสอบสำเร็จ และมีข้อที่ทำผิด ให้บันทึกลงคลังข้อผิด (mistake_bank)
      if (!sessionError && sessionData && mistakeItems.length > 0) {
        const mistakesWithSession = mistakeItems.map(item => ({
          ...item,
          session_id: sessionData.id
        }))
        await supabase.from('mistake_bank').insert(mistakesWithSession)
      }
    } catch (dbErr) {
      console.error('ไม่สามารถบันทึกประวัติสอบได้:', dbErr.message)
    } finally {
      setSaving(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="text-4xl animate-bounce mb-4">⌛</div>
        <p className="text-slate-600 font-medium">กำลังเตรียมข้อสอบและสลับตัวเลือก...</p>
      </div>
    )
  }

  const currentQ = questions[currentIdx]
  const isLastQuestion = currentIdx === questions.length - 1

  return (
    <div className="min-h-screen bg-slate-100 pb-12 font-sans">
      {/* Top Bar แสดงสถานะสอบ */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-4xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div>
            <Link to="/" className="text-xs font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 mb-0.5">
              ← กลับไปเลือกวิชา
            </Link>
            <h1 className="font-bold text-slate-800 text-sm sm:text-base line-clamp-1">{categoryName}</h1>
          </div>

          <div className="flex items-center gap-3">
            {isSubmitted ? (
              <div className="bg-emerald-50 border border-emerald-200 px-3.5 py-1 rounded-xl text-emerald-700 font-bold text-sm">
                🏆 คะแนน: {score} / {questions.length}
              </div>
            ) : (
              <button
                onClick={handleSubmitExam}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition-colors cursor-pointer"
              >
                {saving ? '⏳ กำลังตรวจ...' : '✨ ส่งข้อสอบ'}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 mt-6 grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* คอลัมน์ซ้าย (บนมือถือจะอยู่ด้านล่าง): แผนผังข้อสอบ (Question Grid Navigation) */}
        <div className="md:col-span-1 order-2 md:order-1">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs sticky top-24">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              📑 รายการข้อ ({questions.length} ข้อ)
            </h2>
            
            <div className="grid grid-cols-5 gap-1.5 max-h-60 md:max-h-80 overflow-y-auto p-1">
              {questions.map((q, idx) => {
                const isAnswered = userAnswers[q.id] !== undefined
                const isCurrent = currentIdx === idx
                
                // สีปุ่มในโหมดเฉลยหลังส่งข้อสอบ
                let btnStyle = 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                if (isSubmitted) {
                  const isCorrect = userAnswers[q.id] === q.displayCorrectOption
                  btnStyle = isCorrect ? 'bg-emerald-500 text-white font-bold' : 'bg-red-500 text-white font-bold'
                } else if (isAnswered) {
                  btnStyle = 'bg-indigo-600 text-white font-bold'
                }

                if (isCurrent) {
                  btnStyle += ' ring-2 ring-indigo-400 ring-offset-2 scale-105'
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-9 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-center ${btnStyle}`}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>

            {/* คำอธิบายสัญลักษณ์สี */}
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
              {!isSubmitted ? (
                <>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"/> ทำแล้ว</div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block"/> ยังไม่ได้ทำ</div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"/> ตอบถูก</div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"/> ตอบผิด / ไม่ได้ตอบ</div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* คอลัมน์ขวา: พื้นที่แสดงโจทย์และช้อยส์ */}
        <div className="md:col-span-3 order-1 md:order-2 space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
            
            {/* หัวข้อลำดับข้อ */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <span className="text-sm font-extrabold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                ข้อที่ {currentIdx + 1} จาก {questions.length}
              </span>
              {isSubmitted && (
                <span className={`text-xs font-bold px-3 py-1 rounded-lg ${
                  userAnswers[currentQ.id] === currentQ.displayCorrectOption
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {userAnswers[currentQ.id] === currentQ.displayCorrectOption ? '✅ ตอบถูก' : '❌ ตอบผิด'}
                </span>
              )}
            </div>

            {/* คำถาม/โจทย์ */}
            <div className="text-slate-800 font-semibold text-base sm:text-lg mb-6 leading-relaxed whitespace-pre-wrap">
              {currentQ.question_text}
            </div>

            {/* รูปประกอบโจทย์ (ถ้ามี) */}
            {currentQ.image_url && (
              <div className="mb-6 bg-slate-50 p-2 rounded-xl border border-slate-200 flex justify-center">
                <img 
                  src={currentQ.image_url} 
                  alt="รูปประกอบโจทย์" 
                  className="max-h-80 object-contain rounded-lg"
                  loading="lazy"
                />
              </div>
            )}

            {/* รายการตัวเลือกช้อยส์ */}
            <div className="space-y-3">
              {currentQ.displayOptions?.map((optionText, optIdx) => {
                const isSelected = userAnswers[currentQ.id] === optIdx
                const isCorrectOption = currentQ.displayCorrectOption === optIdx

                // เปลี่ยนสไตล์สีช้อยส์ตามโหมด (กำลังทำ vs ดูเฉลย)
                let cardStyle = 'border-slate-200 hover:border-indigo-300 bg-white text-slate-700'
                let badgeStyle = 'bg-slate-100 text-slate-600'

                if (isSubmitted) {
                  if (isCorrectOption) {
                    cardStyle = 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-medium shadow-xs'
                    badgeStyle = 'bg-emerald-500 text-white font-bold'
                  } else if (isSelected && !isCorrectOption) {
                    cardStyle = 'border-red-400 bg-red-50/70 text-red-900 line-through decoration-red-400'
                    badgeStyle = 'bg-red-500 text-white font-bold'
                  } else {
                    cardStyle = 'border-slate-100 bg-slate-50/50 text-slate-400 opacity-60'
                  }
                } else if (isSelected) {
                  cardStyle = 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-medium shadow-xs ring-1 ring-indigo-600'
                  badgeStyle = 'bg-indigo-600 text-white font-bold'
                }

                return (
                  <div
                    key={optIdx}
                    onClick={() => handleSelectOption(currentQ.id, optIdx)}
                    className={`p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                      !isSubmitted ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'
                    } ${cardStyle}`}
                  >
                    <span className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center shrink-0 mt-0.5 transition-colors ${badgeStyle}`}>
                      {optIdx + 1}
                    </span>
                    <span className="text-sm sm:text-base leading-snug flex-1 pt-0.5">
                      {optionText}
                    </span>
                    
                    {/* ไอคอนติ๊กถูก/ผิด ด้านหลังช้อยส์ตอนดูเฉลย */}
                    {isSubmitted && isCorrectOption && <span className="text-lg">🎯</span>}
                    {isSubmitted && isSelected && !isCorrectOption && <span className="text-base">❌</span>}
                  </div>
                )
              })}
            </div>

            {/* กล่องเฉลยละเอียด (จะโชว์ก็ต่อเมื่อกดส่งข้อสอบแล้วเท่านั้น) */}
            {isSubmitted && (currentQ.explanation || currentQ.explanation_image_url) && (
              <div className="mt-8 p-5 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-slate-800 animate-fadeIn">
                <div className="font-extrabold text-amber-900 text-sm flex items-center gap-1.5 mb-2">
                  <span>💡 คำอธิบายเฉลยละเอียด:</span>
                </div>
                {currentQ.explanation && (
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap mb-3">
                    {currentQ.explanation}
                  </p>
                )}
                {currentQ.explanation_image_url && (
                  <div className="mt-3 bg-white p-2 rounded-xl border border-amber-200 flex justify-center">
                    <img 
                      src={currentQ.explanation_image_url} 
                      alt="รูปประกอบเฉลย" 
                      className="max-h-72 object-contain rounded-lg"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>
            )}

            {/* ปุ่มกดนำทางด้านล่าง (ก่อนหน้า / ถัดไป) */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
              <button
                onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
                disabled={currentIdx === 0}
                className="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent text-slate-700 font-semibold text-sm transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                ← ข้อก่อนหน้า
              </button>

              {!isLastQuestion ? (
                <button
                  onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer shadow-sm"
                >
                  ข้อถัดไป →
                </button>
              ) : (
                !isSubmitted && (
                  <button
                    onClick={handleSubmitExam}
                    disabled={saving}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-sm animate-pulse"
                  >
                    ✨ ส่งข้อสอบทั้งหมด
                  </button>
                )
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}