import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Navbar from '../../components/common/Navbar'
import LoadingScreen from '../../components/common/LoadingScreen'
import EmptyState from '../../components/common/EmptyState'
import ConfirmModal from '../../components/common/ConfirmModal'

export default function MistakeBank() {
  const [mistakes, setMistakes] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [modalTarget, setModalTarget] = useState(null)

  useEffect(() => {
    fetchMistakes()
  }, [])

  async function fetchMistakes() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data, error } = await supabase
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

      if (error) throw error

      const validMistakes = (data || []).filter(item => item.questions !== null)
      setMistakes(validMistakes)

      const catMap = {}
      validMistakes.forEach(m => {
        if (m.questions?.categories) {
          catMap[m.questions.category_id] = m.questions.categories.name
        }
      })
      setCategories(Object.entries(catMap).map(([id, name]) => ({ id, name })))
    } catch (err) {
      alert('ดึงข้อมูลคลังข้อผิดไม่สำเร็จ: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmResolve() {
    if (!modalTarget) return
    const id = modalTarget.id

    try {
      const { error } = await supabase
        .from('mistake_bank')
        .update({ is_resolved: true })
        .eq('id', id)

      if (error) throw error
      
      setMistakes((prev) => prev.filter((item) => item.id !== id))
      setModalTarget(null)
    } catch (err) {
      alert('ไม่สามารถอัปเดตสถานะได้: ' + err.message)
    }
  }

  const filteredMistakes = mistakes.filter((m) => {
    if (selectedCategory === 'ALL') return true
    return String(m.questions?.category_id) === String(selectedCategory)
  })

  return (
    <div className="min-h-screen bg-slate-50/70 font-sans text-slate-800 pb-24 overflow-x-hidden">
      
      <ConfirmModal
        isOpen={!!modalTarget}
        type="success"
        title="ทบทวนข้อนี้เข้าใจแล้วใช่ไหม?"
        description={
          <>
            ข้อสอบนี้จะถูกลบออกจากคลังข้อผิดพลาดของคุณ และจะไม่แสดงในรายการทบทวนอีก<br/>
            คุณสามารถกลับมาฝึกทำข้อสอบวิชานี้ใหม่ได้เสมอที่หน้าแรกครับ
          </>
        }
        cancelText="← เก็บไว้ทบทวนต่อ"
        confirmText="✨ เข้าใจแล้ว นำออกเลย"
        onClose={() => setModalTarget(null)}
        onConfirm={handleConfirmResolve}
      />

      <Navbar showNavPills={true} />

      <div className="max-w-5xl mx-auto px-3 sm:px-6 mt-6 sm:mt-8 min-w-0">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8 min-w-0">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <span className="text-base sm:text-lg">🔍</span>
            <span className="font-extrabold text-slate-800 text-xs sm:text-sm">กรองตามหมวดวิชา:</span>
          </div>
          
          <div className="w-full sm:w-auto sm:max-w-xs min-w-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3.5 py-2 sm:py-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all cursor-pointer truncate pr-8"
            >
              <option value="ALL">💡 แสดงทั้งหมด ({mistakes.length} ข้อ)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>📖 {cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <LoadingScreen text="กำลังเปิดสมุดคลังข้อผิดพลาด..." />
        ) : filteredMistakes.length === 0 ? (
          <EmptyState 
            icon="🎉"
            title="สุดยอดมาก! คลังข้อผิดว่างเปล่า"
            description="คุณยังไม่มีข้อที่ทำผิดในหมวดนี้ หรือคุณได้ทำการทบทวนและทำความเข้าใจจนครบหมดแล้วครับ"
            actionText="กลับไปเลือกวิชาสอบ"
            onAction={() => window.location.href = '/'}
          />
        ) : (
          <div className="space-y-5 sm:space-y-6 min-w-0">
            {filteredMistakes.map((item, idx) => {
              const q = item.questions
              const userAnswerIdx = item.user_answer !== null ? Number(item.user_answer) : null
              const correctIdx = Number(q.correct_option)

              return (
                <div 
                  key={item.id} 
                  className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-md transition-all min-w-0"
                >
                  <div className="bg-slate-100/80 px-4 sm:px-6 py-3 border-b border-slate-200/60 flex flex-wrap items-center justify-between gap-1.5 text-xs font-bold text-slate-600 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block shrink-0"/>
                      <span className="text-slate-900 font-extrabold truncate">📖 {q.categories?.name || 'หมวดวิชาทั่วไป'}</span>
                      <span className="text-slate-300 shrink-0">|</span>
                      <span className="shrink-0">#{idx + 1}</span>
                    </div>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono shrink-0">
                      {new Date(item.created_at).toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
                    </span>
                  </div>

                  <div className="p-4 sm:p-8 space-y-5 sm:space-y-6 min-w-0">
                    
                    <div className="text-slate-900 font-bold text-sm sm:text-lg leading-relaxed break-words [word-break:break-word] min-w-0">
                      {q.question_text}
                    </div>

                    {q.image_url && (
                      <div className="bg-slate-50 p-2 sm:p-3 rounded-2xl border border-slate-200 flex justify-center overflow-hidden">
                        <img src={q.image_url} alt="รูปโจทย์" className="max-w-full max-h-72 object-contain rounded-xl" loading="lazy" />
                      </div>
                    )}

                    <div className="space-y-2.5 min-w-0 pt-1">
                      <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                        ตัวเลือกทั้งหมด และจุดที่คุณต้องทบทวน:
                      </div>

                      {q.options?.map((optText, optIdx) => {
                        const isUserChoice = userAnswerIdx === optIdx
                        const isCorrectChoice = correctIdx === optIdx

                        let cardStyle = "bg-slate-50/60 border-slate-200/80 text-slate-600"
                        let badgeStyle = "bg-slate-200 text-slate-700"
                        let statusBadge = null

                        if (isCorrectChoice) {
                          cardStyle = "bg-emerald-50/80 border-emerald-500 text-emerald-950 font-bold ring-1 ring-emerald-500 shadow-2xs"
                          badgeStyle = "bg-emerald-500 text-white font-black"
                          statusBadge = <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md ml-auto shrink-0 shadow-xs">🎯 คำตอบที่ถูกต้อง</span>
                        } else if (isUserChoice) {
                          // 🌟 เอาเส้นขีดฆ่าทิ้ง เหลือแค่พื้นหลังสีแดงตัวหนา อ่านสบายตา!
                          cardStyle = "bg-red-50/80 border-red-300 text-red-900 font-semibold shadow-2xs"
                          badgeStyle = "bg-red-500 text-white font-black"
                          statusBadge = <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md ml-auto shrink-0 shadow-xs">❌ คุณเคยตอบข้อนี้</span>
                        }

                        return (
                          <div 
                            key={optIdx} 
                            className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex items-center gap-3 min-w-0 ${cardStyle}`}
                          >
                            <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-xl text-xs flex items-center justify-center shrink-0 font-mono ${badgeStyle}`}>
                              {optIdx + 1}
                            </span>
                            <span className="text-xs sm:text-sm leading-relaxed break-words [word-break:break-word] flex-1 min-w-0">
                              {optText}
                            </span>
                            {statusBadge}
                          </div>
                        )
                      })}

                      {userAnswerIdx === null && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800 flex items-center gap-2">
                          <span>⚠️</span><span>ข้อนี้คุณไม่ได้เลือกคำตอบ (อาจจะหมดเวลา หรือเว้นว่างไว้)</span>
                        </div>
                      )}
                    </div>

                    {(q.explanation || q.explanation_image_url) && (
                      <div className="p-4 sm:p-5 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-slate-800 min-w-0 mt-4">
                        <div className="font-black text-amber-900 text-xs sm:text-sm flex items-center gap-1.5 mb-2">
                          <span>💡</span><span>คำอธิบายเฉลยเพิ่มเติม:</span>
                        </div>
                        {q.explanation && <p className="text-xs sm:text-sm text-slate-700 leading-relaxed break-words [word-break:break-word] min-w-0">{q.explanation}</p>}
                        {q.explanation_image_url && (
                          <div className="mt-3 bg-white p-2 sm:p-3 rounded-xl border border-amber-200/80 flex justify-center overflow-hidden">
                            <img src={q.explanation_image_url} alt="รูปเฉลย" className="max-w-full max-h-64 object-contain rounded-lg" loading="lazy" />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-3 sm:pt-4 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => setModalTarget(item)}
                        className="w-full sm:w-auto px-5 sm:px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-sm hover:shadow cursor-pointer flex items-center justify-center gap-2 group shrink-0"
                      >
                        <span>✓</span>
                        <span>ทบทวนเข้าใจแล้ว (นำออกจากคลัง)</span>
                      </button>
                    </div>

                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}