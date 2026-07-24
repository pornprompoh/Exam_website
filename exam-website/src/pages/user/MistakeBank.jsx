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

      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white py-12 sm:py-16 border-b border-slate-700 shadow-inner">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
            คลังข้อผิดพลาด และสมุดทบทวน 💡
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            ระบบรวบรวมข้อที่คุณเคยทำผิดหรือลืมตอบไว้โดยอัตโนมัติ กลับมาทบทวนเฉลยละเอียดที่นี่ และกดนำออกเมื่อคุณทำความเข้าใจข้อนั้นได้อย่างถ่องแท้แล้วครับ
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8 min-w-0">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4 mb-8 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🔍</span>
            <span className="font-extrabold text-slate-800 text-sm">กรองตามหมวดวิชา:</span>
          </div>
          
          <div className="w-full sm:w-auto sm:max-w-xs min-w-[220px]">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all cursor-pointer"
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
          <div className="space-y-6 min-w-0">
            {filteredMistakes.map((item, idx) => {
              const q = item.questions
              const userAnswerIdx = item.user_answer !== null ? Number(item.user_answer) : null
              const correctIdx = Number(q.correct_option)

              return (
                <div 
                  key={item.id} 
                  className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-md transition-all min-w-0"
                >
                  <div className="bg-slate-100/80 px-6 py-3.5 border-b border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block shrink-0"/>
                      <span className="text-slate-900 font-extrabold truncate">📖 {q.categories?.name || 'หมวดวิชาทั่วไป'}</span>
                      <span className="text-slate-300 shrink-0">|</span>
                      <span className="shrink-0">รายการที่ #{idx + 1}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">
                      {new Date(item.created_at).toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="p-6 sm:p-8 space-y-6 min-w-0">
                    {/* บังคับตัดบรรทัดโจทย์ยาว */}
                    <div className="text-slate-900 font-bold text-base sm:text-lg leading-relaxed break-words [word-break:break-word] min-w-0">
                      {q.question_text}
                    </div>

                    {q.image_url && (
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex justify-center">
                        <img src={q.image_url} alt="รูปโจทย์" className="max-h-72 object-contain rounded-xl" loading="lazy" />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 min-w-0">
                      <div className="p-4 rounded-2xl bg-red-50/70 border border-red-200 text-red-900 text-xs sm:text-sm min-w-0">
                        <div className="font-extrabold text-red-700 mb-1 flex items-center gap-1.5">
                          <span>❌ คำตอบที่คุณเคยเลือก:</span>
                        </div>
                        <div className="font-medium leading-relaxed break-words [word-break:break-word] min-w-0">
                          {userAnswerIdx !== null && q.options && q.options[userAnswerIdx]
                            ? `${userAnswerIdx + 1}. ${q.options[userAnswerIdx]}`
                            : 'ไม่ได้ตอบ (หมดเวลา / เว้นว่าง)'}
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-300 text-emerald-950 text-xs sm:text-sm shadow-2xs min-w-0">
                        <div className="font-extrabold text-emerald-800 mb-1 flex items-center gap-1.5">
                          <span>✅ คำตอบที่ถูกต้อง:</span>
                        </div>
                        <div className="font-bold leading-relaxed break-words [word-break:break-word] min-w-0">
                          {q.options && q.options[correctIdx]
                            ? `${correctIdx + 1}. ${q.options[correctIdx]}`
                            : 'ไม่มีข้อมูลเฉลย'}
                        </div>
                      </div>
                    </div>

                    {(q.explanation || q.explanation_image_url) && (
                      <div className="p-5 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-slate-800 min-w-0">
                        <div className="font-black text-amber-900 text-xs sm:text-sm flex items-center gap-1.5 mb-2">
                          <span>💡</span><span>คำอธิบายเฉลยเพิ่มเติม:</span>
                        </div>
                        {/* บังคับตัดบรรทัดเฉลยยาว */}
                        {q.explanation && <p className="text-xs sm:text-sm text-slate-700 leading-relaxed break-words [word-break:break-word] min-w-0">{q.explanation}</p>}
                        {q.explanation_image_url && (
                          <div className="mt-3 bg-white p-3 rounded-xl border border-amber-200/80 flex justify-center">
                            <img src={q.explanation_image_url} alt="รูปเฉลย" className="max-h-64 object-contain rounded-lg" loading="lazy" />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => setModalTarget(item)}
                        className="px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-2 group shrink-0"
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