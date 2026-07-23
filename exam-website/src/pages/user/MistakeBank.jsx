import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function MistakeBank() {
  const [mistakes, setMistakes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState('ALL')
  const [categories, setCategories] = useState([])

  useEffect(() => {
    fetchMistakes()
  }, [])

  async function fetchMistakes() {
    setLoading(true)
    try {
      // 1. ดึงข้อที่ทำผิดทั้งหมด ที่ยังไม่ได้กดปลดล็อก (is_resolved = false)
      // พร้อมดึงข้อมูลโจทย์ (questions) และชื่อวิชา (categories) มาโชว์ด้วย
      const { data, error } = await supabase
        .from('mistake_bank')
        .select(`
          id,
          user_answer,
          created_at,
          questions (
            id,
            question_text,
            image_url,
            options,
            correct_option,
            explanation,
            explanation_image_url,
            category_id,
            categories (
              id,
              name
            )
          )
        `)
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })

      if (error) throw error

      // กรองเอาเฉพาะรายการที่ยังมีข้อสอบอยู่ในระบบ (ป้องกัน error กรณีข้อสอบถูกลบไปแล้ว)
      const validMistakes = (data || []).filter(item => item.questions !== null)
      setMistakes(validMistakes)

      // 2. ดึงรายชื่อวิชาทั้งหมดที่มีในคลังข้อผิด เพื่อเอามาทำตัวกรอง (Filter dropdown)
      const uniqueCats = []
      const map = new Map()
      validMistakes.forEach(item => {
        const cat = item.questions?.categories
        if (cat && !map.has(cat.id)) {
          map.set(cat.id, true)
          uniqueCats.push(cat)
        }
      })
      setCategories(uniqueCats)

    } catch (err) {
      alert('ดึงข้อมูลคลังข้อผิดไม่สำเร็จ: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ฟังก์ชันกด "ทบทวนเข้าใจแล้ว" (เปลี่ยนสถานะ is_resolved เป็น true)
  async function handleResolve(mistakeId) {
    try {
      const { error } = await supabase
        .from('mistake_bank')
        .update({ is_resolved: true })
        .eq('id', mistakeId)

      if (error) throw error

      // ลบข้อนั้นออกจากหน้าเว็บทันที
      setMistakes(prev => prev.filter(m => m.id !== mistakeId))
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    }
  }

  // กรองข้อผิดตามวิชาที่เลือก
  const filteredMistakes = filterCategory === 'ALL' 
    ? mistakes 
    : mistakes.filter(m => m.questions?.category_id === filterCategory)

  return (
    <div className="min-h-screen bg-slate-100 pb-12 font-sans">
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-xs">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
              ← กลับหน้าแรก
            </Link>
            <h1 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
              📑 คลังข้อผิดของฉัน <span className="text-xs bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-mono">{mistakes.length} ข้อ</span>
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 mt-8">
        
        {/* กล่องคำอธิบาย และ ตัวกรองวิชา */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-800 text-base mb-1">💡 ทบทวนจุดอ่อนเพื่อปิดประตูพลาด</h2>
            <p className="text-xs text-slate-500">
              ข้อสอบที่คุณเคยตอบผิดจะถูกมารวมไว้ที่นี่ เมื่ออ่านเฉลยจนเข้าใจแล้ว ให้กดปุ่ม "เข้าใจแล้ว" เพื่อนำออกจากรายการ
            </p>
          </div>

          {/* ตัวกรองหมวดหมู่ */}
          {categories.length > 0 && (
            <div className="shrink-0">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="ALL">📚 แสดงทุกวิชา ({mistakes.length})</option>
                {categories.map(cat => {
                  const count = mistakes.filter(m => m.questions?.category_id === cat.id).length
                  return (
                    <option key={cat.id} value={cat.id}>{cat.name} ({count})</option>
                  )
                })}
              </select>
            </div>
          )}
        </div>

        {/* รายการข้อผิด */}
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-sm animate-pulse">
            ⏳ กำลังโหลดคลังข้อผิดของคุณ...
          </div>
        ) : filteredMistakes.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="font-bold text-slate-800 text-lg mb-1">เยี่ยมมาก! ไม่มีข้อผิดค้างอยู่ในคลังเลย</h3>
            <p className="text-slate-400 text-sm mb-6">คุณทบทวนข้อผิดจนครบหมดแล้ว หรือยังไม่เคยทำข้อสอบพลาดเลยครับ</p>
            <Link to="/" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm inline-block">
              🚀 ไปฝึกทำข้อสอบเพิ่มกันเลย
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredMistakes.map((item, index) => {
              const q = item.questions
              const userAnswerIdx = item.user_answer !== null ? Number(item.user_answer) : null
              const correctIdx = Number(q.correct_option)

              return (
                <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative overflow-hidden">
                  
                  {/* แถบหัวข้อบอกวิชา และ วันที่ทำผิด */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 text-xs">
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-bold rounded-lg">
                      📖 {q.categories?.name || 'ทั่วไป'}
                    </span>
                    <span className="text-slate-400">
                      ทำผิดเมื่อ: {new Date(item.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
                    </span>
                  </div>

                  {/* คำถาม / โจทย์ */}
                  <div className="font-semibold text-slate-800 text-base mb-4 leading-relaxed whitespace-pre-wrap">
                    <span className="text-indigo-600 font-bold mr-2">#{index + 1}.</span>
                    {q.question_text}
                  </div>

                  {/* รูปโจทย์ (ถ้ามี) */}
                  {q.image_url && (
                    <div className="mb-4 bg-slate-50 p-2 rounded-xl border border-slate-200 flex justify-center">
                      <img src={q.image_url} alt="รูปโจทย์" className="max-h-60 object-contain rounded-lg" loading="lazy" />
                    </div>
                  )}

                  {/* ช้อยส์ทั้งหมด */}
                  <div className="space-y-2 mb-6">
                    {q.options?.map((optText, idx) => {
                      const isUserChoice = userAnswerIdx === idx
                      const isCorrectChoice = correctIdx === idx

                      let style = 'border-slate-100 bg-slate-50/50 text-slate-500'
                      let badge = 'bg-slate-200 text-slate-600'

                      if (isCorrectChoice) {
                        style = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-500'
                        badge = 'bg-emerald-500 text-white'
                      } else if (isUserChoice && !isCorrectChoice) {
                        style = 'border-red-300 bg-red-50 text-red-900 line-through decoration-red-400'
                        badge = 'bg-red-500 text-white'
                      }

                      return (
                        <div key={idx} className={`p-3 rounded-xl border flex items-start gap-3 text-sm ${style}`}>
                          <span className={`w-6 h-6 rounded-md text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold ${badge}`}>
                            {idx + 1}
                          </span>
                          <span className="flex-1 leading-snug">{optText}</span>
                          {isCorrectChoice && <span className="text-sm font-normal text-emerald-700">✅ คำตอบที่ถูก</span>}
                          {isUserChoice && !isCorrectChoice && <span className="text-sm font-normal text-red-600">❌ คุณตอบข้อนี้</span>}
                        </div>
                      )
                    })}
                  </div>

                  {/* กล่องเฉลยละเอียด */}
                  {(q.explanation || q.explanation_image_url) && (
                    <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-xl mb-6">
                      <div className="font-bold text-amber-900 text-xs flex items-center gap-1.5 mb-1.5">
                        <span>💡 คำอธิบายเพิ่มเติม:</span>
                      </div>
                      {q.explanation && <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{q.explanation}</p>}
                      {q.explanation_image_url && (
                        <div className="mt-2 bg-white p-2 rounded-lg border border-amber-200 flex justify-center">
                          <img src={q.explanation_image_url} alt="รูปเฉลย" className="max-h-52 object-contain rounded-lg" loading="lazy" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* ปุ่มกดจำได้แล้ว */}
                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => handleResolve(item.id)}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>✅ ทบทวนเข้าใจแล้ว (นำออกจากคลัง)</span>
                    </button>
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