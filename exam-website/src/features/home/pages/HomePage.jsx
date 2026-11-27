import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../shared/lib/supabase'
import Navbar from '../../../shared/components/Navbar'
import LoadingScreen from '../../../shared/components/LoadingScreen'
import EmptyState from '../../../shared/components/EmptyState'
import { AlertTriangleIcon, FolderIcon, SearchIcon } from '../../../shared/components/AdminIcons'
import useCategories from '../../../shared/hooks/useCategories'
import SubjectCard from '../components/SubjectCard'
import HomeSearchFilter from '../components/HomeSearchFilter'

function LibraryIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M8 7h8M8 11h5" />
    </svg>
  )
}

export default function HomePage() {
  const { categories, loading, error: categoriesError } = useCategories({ includeQuestionCounts: true })
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('ALL')

  const handleStartExam = (category) => {
    navigate(`/exam/${category.id}`)
  }

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login', { replace: true })
      }
    }
    checkAuth()
  }, [navigate])

  const filteredCategories = categories.filter((cat) => {
    const cleanSearch = searchQuery.toLowerCase().replace('#', '').trim()
    const matchesText =
      cat.name.toLowerCase().includes(cleanSearch) ||
      (cat.description && cat.description.toLowerCase().includes(cleanSearch))
    const subjectCode = cat.id ? cat.id.toString().slice(0, 6).toLowerCase() : ''
    const matchesCode = subjectCode.includes(cleanSearch)
    const matchesFilter = selectedFilter === 'ALL' || cat.id === selectedFilter

    return (matchesText || matchesCode) && matchesFilter
  })

  return (
    <div className="min-h-dvh bg-[#f8f8f9] dark:bg-[#000000] text-zinc-900 dark:text-zinc-100 font-sans pb-24 transition-colors duration-300">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-7 space-y-5">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/70 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <LibraryIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
                คลังข้อสอบและชุดแบบทดสอบ
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                เลือกหมวดวิชาที่ต้องการฝึกทำหรือจำลองสนามสอบ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-[#181818] px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-[#272727] flex items-center gap-1.5">
              <span>เปิดใช้งาน</span>
              <strong className="text-indigo-600 dark:text-indigo-400 font-mono tabular-nums text-sm font-semibold">
                {categories.length.toLocaleString()}
              </strong>
              <span>หมวดวิชา</span>
            </div>
          </div>
        </header>

        {categories.length > 0 && (
          <HomeSearchFilter
            categories={categories}
            searchQuery={searchQuery}
            selectedFilter={selectedFilter}
            onSearchChange={setSearchQuery}
            onFilterChange={setSelectedFilter}
            onClear={() => {
              setSearchQuery('')
              setSelectedFilter('ALL')
            }}
          />
        )}

        {loading ? (
          <LoadingScreen text="กำลังเปิดคลังข้อสอบและเตรียมแบบทดสอบ..." />
        ) : categoriesError ? (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 dark:border-rose-500/25 bg-rose-50 dark:bg-rose-500/10 p-5 text-sm font-medium text-rose-700 dark:text-rose-300 flex items-start gap-2.5"
          >
            <AlertTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
            <span>ไม่สามารถดึงข้อมูลหมวดหมู่ได้: {categoriesError.message}</span>
          </div>
        ) : filteredCategories.length === 0 ? (
          <EmptyState
            icon={categories.length === 0 ? <FolderIcon className="w-5 h-5" /> : <SearchIcon className="w-5 h-5" />}
            title={categories.length === 0 ? 'ยังไม่มีหมวดหมู่วิชาที่เปิดสอบ' : 'ไม่พบวิชาที่ตรงกับการค้นหา'}
            description={
              categories.length === 0
                ? 'ขณะนี้ยังไม่มีหมวดหมู่วิชาใดเปิดใช้งานในระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มแบบทดสอบ'
                : `ไม่พบหมวดหมู่วิชาที่ตรงกับคำว่า "${searchQuery}" ลองเปลี่ยนคำค้นหาหรือล้างตัวกรองเพื่อดูวิชาทั้งหมด`
            }
            actionText={categories.length > 0 ? 'แสดงหมวดวิชาทั้งหมด' : ''}
            onAction={
              categories.length > 0
                ? () => {
                    setSearchQuery('')
                    setSelectedFilter('ALL')
                  }
                : null
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {filteredCategories.map((category) => (
              <SubjectCard key={category.id} category={category} onStartExam={handleStartExam} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
