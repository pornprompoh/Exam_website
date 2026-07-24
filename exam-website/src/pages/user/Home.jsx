import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Navbar from '../../components/common/Navbar'
import LoadingScreen from '../../components/common/LoadingScreen'
import EmptyState from '../../components/common/EmptyState'

export default function Home() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [searchKeyword, setSearchKeyword] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchCategoriesWithCount()
  }, [])

  async function fetchCategoriesWithCount() {
    setLoading(true)
    try {
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (catError) throw catError

      const categoriesWithCount = await Promise.all(
        (catData || []).map(async (cat) => {
          const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', cat.id)
            .eq('is_active', true)

          return { ...cat, questionCount: count || 0 }
        })
      )

      setCategories(categoriesWithCount)
    } catch (err) {
      alert('ดึงข้อมูลหมวดหมู่ไม่สำเร็จ: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStartExam = (categoryId, categoryName, questionCount) => {
    if (questionCount === 0) {
      return alert(`หมวดหมู่ "${categoryName}" ยังไม่มีข้อสอบในระบบครับ!`)
    }
    navigate(`/exam/${categoryId}?title=${encodeURIComponent(categoryName)}`)
  }

  const filteredCategories = categories.filter((cat) => {
    const matchCat = selectedCategory === 'ALL' || cat.id === selectedCategory
    const matchKeyword = cat.name.toLowerCase().includes(searchKeyword.toLowerCase())
    return matchCat && matchKeyword
  })

  return (
    <div className="min-h-screen bg-slate-50/70 font-sans text-slate-800 pb-24 overflow-x-hidden">
      
      <Navbar showNavPills={true} />

      {/* Hero Banner (Responsive Padding & Fonts) */}
      <div className="relative bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 py-12 sm:py-20 md:py-24 overflow-hidden shadow-inner border-b-4 border-teal-700/80">
        <div className="absolute top-6 left-6 sm:left-16 grid grid-cols-4 gap-2 opacity-70 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-white rounded-full shadow-2xs" />
          ))}
        </div>
        <div className="absolute bottom-6 left-1/4 w-10 h-10 opacity-60 pointer-events-none hidden sm:block">
          <div className="absolute top-4 left-0 w-10 h-2 bg-white rounded-full" />
          <div className="absolute top-0 left-4 w-2 h-10 bg-white rounded-full" />
        </div>
        <div className="absolute top-6 right-1/4 sm:right-1/3 flex gap-3 text-white/80 font-black text-lg sm:text-2xl tracking-widest pointer-events-none">
          <span>✕</span><span>✕</span><span>✕</span>
        </div>
        <div className="absolute -top-12 -right-12 w-48 h-48 border-2 border-white/10 rounded-full pointer-events-none hidden md:block">
          <div className="absolute top-8 left-8 w-32 h-32 bg-teal-400/20 rounded-full border border-white/20" />
        </div>
        <div className="absolute bottom-6 right-6 sm:right-24 flex gap-2 opacity-80 pointer-events-none">
          <div className="w-3 h-3 border-2 border-white rounded-full" />
          <div className="w-3 h-3 border-2 border-white rounded-full" />
          <div className="w-3 h-3 border-2 border-white rounded-full" />
        </div>

        <div className="relative max-w-lg mx-auto px-4 text-center z-10">
          <div className="absolute -top-2 left-4 sm:left-6 w-12 h-12 sm:w-14 sm:h-14 bg-amber-400 border-2 border-slate-900 -rotate-12 rounded-lg -z-10 shadow-md" />
          <div className="absolute -bottom-2 right-4 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 bg-amber-400 border-2 border-slate-900 rotate-12 rounded-lg -z-10 shadow-md" />
          <div className="bg-white border-4 border-slate-900 py-4 sm:py-6 md:py-7 px-6 sm:px-10 rounded-2xl shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] sm:shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] transform hover:-translate-y-1 transition-transform duration-300">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-900">
              คลัง<span className="text-red-600">ข้อสอบ</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Search Section (Responsive Floating Card) */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 -mt-8 sm:-mt-12 relative z-20 mb-10 sm:mb-14">
        <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-900/5 min-w-0">
          <div className="flex items-center justify-center gap-2 mb-4 sm:mb-6">
            <span className="text-base sm:text-lg">🔍</span>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-800 tracking-tight">ค้นหาและกรองข้อสอบ</h2>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-3 sm:py-3.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white rounded-2xl border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-teal-500/15 focus:border-teal-500 transition-all cursor-pointer appearance-none truncate pr-10"
              >
                <option value="ALL">💡 แสดงทุกสาระการเรียนรู้ ({categories.length} วิชา)</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>📖 {cat.name} ({cat.questionCount} ข้อ)</option>
                ))}
              </select>
              <div className="absolute right-4 top-3.5 sm:top-4 pointer-events-none text-slate-400 font-bold text-xs">▼</div>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="พิมพ์ชื่อวิชา หรือ คำค้นที่ต้องการ..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full px-4 py-3 sm:py-3.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white rounded-2xl border border-slate-200 text-slate-700 text-xs sm:text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-500/15 focus:border-teal-500 transition-all pr-16"
              />
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-3.5 top-3 sm:top-3.5 px-2 py-0.5 bg-slate-200 hover:bg-red-500 text-slate-600 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  ล้าง
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-slate-500 font-medium px-1 text-center sm:text-left">
            <span>สถานะคลังข้อสอบปัจจุบัน</span>
            <span>พบข้อสอบที่ตรงเงื่อนไข: <strong className="text-teal-600 font-mono text-sm">{filteredCategories.length}</strong> หมวดวิชา</span>
          </div>
        </div>
      </div>

      {/* Exam Modules Grid (Responsive 1 -> 2 -> 3 Columns) */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6 pb-3 border-b border-slate-200">
          <h3 className="font-extrabold text-base sm:text-lg text-slate-800 flex items-center gap-2">
            <span className="w-2.5 h-5 sm:h-6 bg-red-600 rounded-full inline-block shrink-0"></span>
            <span className="truncate">รายการวิชาและชุดแบบทดสอบ</span>
          </h3>
          <span className="text-xs font-bold bg-slate-200/80 text-slate-700 px-3 py-1 rounded-full shrink-0">
            ทั้งหมด {filteredCategories.length} วิชา
          </span>
        </div>

        {loading ? (
          <LoadingScreen text="กำลังโหลดรายการวิชาทั้งหมด..." />
        ) : filteredCategories.length === 0 ? (
          <EmptyState 
            title="ไม่พบวิชาที่ค้นหาครับ"
            description="ลองเปลี่ยนคำค้นหาใหม่ หรือกดปุ่มด้านล่างเพื่อแสดงทุกสาระการเรียนรู้"
            actionText="รีเซ็ตการค้นหาทั้งหมด"
            onAction={() => { setSelectedCategory('ALL'); setSearchKeyword(''); }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6 min-w-0">
            {filteredCategories.map((cat) => (
              <div 
                key={cat.id} 
                className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden group min-w-0"
              >
                <div className="h-2 sm:h-2.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 group-hover:h-3 transition-all duration-300" />
                <div className="p-5 sm:p-6 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] sm:text-[11px] font-bold text-teal-700 bg-teal-50/80 border border-teal-200/60 px-2.5 sm:px-3 py-1 rounded-full flex items-center gap-1 shrink-0">
                      <span>📖</span><span>สาระการเรียนรู้</span>
                    </span>
                    <span className={`text-[10px] sm:text-[11px] font-bold px-2.5 sm:px-3 py-1 rounded-full font-mono shrink-0 ${
                      cat.questionCount > 0 ? 'bg-red-50 text-red-600 border border-red-200/60' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {cat.questionCount} ข้อ
                    </span>
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-base sm:text-lg mb-2 group-hover:text-teal-600 transition-colors line-clamp-1 break-words">{cat.name}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 break-words">แบบทดสอบทบทวนความรู้มาตรฐาน พร้อมระบบสุ่มตัวเลือกและเฉลยคำอธิบายอย่างละเอียด</p>
                </div>

                <div className="p-4 sm:p-5 bg-slate-50/60 border-t border-slate-100 mt-2">
                  <button
                    onClick={() => handleStartExam(cat.id, cat.name, cat.questionCount)}
                    disabled={cat.questionCount === 0}
                    className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-sm hover:shadow-md cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2 group/btn"
                  >
                    <span>{cat.questionCount > 0 ? 'เริ่มทำข้อสอบ' : 'ยังไม่มีข้อสอบ'}</span>
                    {cat.questionCount > 0 && <span className="group-hover/btn:translate-x-1 transition-transform duration-200">→</span>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}