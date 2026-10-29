import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Navbar from '../../components/common/Navbar'
import LoadingScreen from '../../components/common/LoadingScreen'
import EmptyState from '../../components/common/EmptyState'
import SubjectCard from '../../components/home/SubjectCard'
import HomeSearchFilter from '../../components/home/HomeSearchFilter'
import useCategories from '../../hooks/useCategories'

export default function Home() {
  const { categories, loading, error: categoriesError } = useCategories({ includeQuestionCounts: true })
  const navigate = useNavigate()
  
  // State สำหรับการค้นหาและกรองวิชา
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('ALL')

  const handleStartExam = (category) => {
    navigate(`/exam/${category.id}`)
  }

  useEffect(() => {
    // 🛡️ AUTH GUARD: ตรวจสอบการเข้าสู่ระบบ
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login', { replace: true })
      }
    }
    checkAuth()

  }, [navigate])

  // ระบบกรองและค้นหา (รองรับชื่อวิชาและรหัส Subject Code)
  const filteredCategories = categories.filter(cat => {
    const cleanSearch = searchQuery.toLowerCase().replace('#', '').trim()
    const matchesText = cat.name.toLowerCase().includes(cleanSearch) || (cat.description && cat.description.toLowerCase().includes(cleanSearch))
    const subjectCode = cat.id ? cat.id.toString().slice(0, 6).toLowerCase() : ''
    const matchesCode = subjectCode.includes(cleanSearch)
    const matchesFilter = selectedFilter === 'ALL' || cat.id === selectedFilter

    return (matchesText || matchesCode) && matchesFilter
  })

  return (
    <div className="min-h-screen bg-slate-100/60 text-slate-800 font-sans pb-24 selection:bg-indigo-500 selection:text-white">
      <Navbar />

      <div className="bg-slate-50 border-b border-slate-200/80 py-6 sm:py-8 px-4 sm:px-6 transition-all">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center text-2xl sm:text-3xl shadow-lg shadow-indigo-500/15 shrink-0">
              📚
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                คลังข้อสอบและชุดแบบทดสอบ
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="text-xs font-bold text-slate-500 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-2xs">
              เปิดใช้งานอยู่ <strong className="text-indigo-600 font-mono text-sm">{categories.length}</strong> หมวดวิชา
            </span>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 space-y-6">
        {categories.length > 0 && (
          <HomeSearchFilter
            categories={categories}
            searchQuery={searchQuery}
            selectedFilter={selectedFilter}
            onSearchChange={setSearchQuery}
            onFilterChange={setSelectedFilter}
            onClear={() => { setSearchQuery(''); setSelectedFilter('ALL') }}
          />
        )}

        {loading ? (
          <LoadingScreen text="กำลังเปิดคลังข้อสอบและเตรียมแบบทดสอบ..." />
        ) : categoriesError ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
            ไม่สามารถดึงข้อมูลหมวดหมู่ได้: {categoriesError.message}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-14 shadow-xs text-center max-w-xl mx-auto my-12">
            <EmptyState
              icon={categories.length === 0 ? "📁" : "🔍"}
              title={categories.length === 0 ? "ยังไม่มีหมวดหมู่วิชาที่เปิดสอบ" : "ไม่พบวิชาที่ตรงกับการค้นหา"}
              description={
                categories.length === 0 
                  ? "ขณะนี้ยังไม่มีหมวดหมู่วิชาใดถูกเปิดใช้งานในระบบ กรุณาติดต่อคุณครูหรือผู้ดูแลระบบเพื่อเพิ่มแบบทดสอบครับ"
                  : `ไม่พบหมวดหมู่วิชาที่ตรงกับคำว่า "${searchQuery}" ลองเปลี่ยนคำค้นหา หรือกดล้างตัวกรองดูอีกครั้งครับ`
              }
            />
            {categories.length > 0 && (
              <div className="mt-6">
                <button
                  onClick={() => { setSearchQuery(''); setSelectedFilter('ALL'); }}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-all cursor-pointer"
                >
                  ↩ แสดงหมวดวิชาทั้งหมด
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredCategories.map((category) => (
              <SubjectCard key={category.id} category={category} onStartExam={handleStartExam} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}