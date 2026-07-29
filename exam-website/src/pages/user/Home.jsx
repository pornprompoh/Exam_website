import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Navbar from '../../components/common/Navbar'
import LoadingScreen from '../../components/common/LoadingScreen'
import EmptyState from '../../components/common/EmptyState'
import ConfirmModal from '../../components/common/ConfirmModal'

export default function Home() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  
  // State สำหรับการค้นหาและกรองวิชา
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('ALL')

  // State สำหรับแจ้งเตือน
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    description: ''
  })

  const showModal = (title, description) => {
    setModalConfig({ isOpen: true, title, description })
  }

  const closeModal = () => {
    setModalConfig({ isOpen: false, title: '', description: '' })
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

    // ดักจับการเปลี่ยนแปลงสถานะ (เช่น กด Logout จาก Navbar ให้เด้งออกทันที)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/login', { replace: true })
      }
    })

    fetchCategoriesAndCounts()

    return () => {
      subscription.unsubscribe()
    }
  }, [navigate])

  // ดึงข้อมูลวิชาแบบ Safe Mapping
  async function fetchCategoriesAndCounts() {
    setLoading(true)
    try {
      const { data: catsData, error: catErr } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (catErr) throw catErr

      const { data: questionsData, error: qErr } = await supabase
        .from('questions')
        .select('id, category_id')
        .eq('is_active', true)

      if (qErr) throw qErr

      const countMap = new Map()
      if (questionsData) {
        questionsData.forEach(q => {
          countMap.set(q.category_id, (countMap.get(q.category_id) || 0) + 1)
        })
      }

      const mergedCategories = (catsData || []).map(cat => ({
        ...cat,
        questionCount: countMap.get(cat.id) || 0
      }))

      setCategories(mergedCategories)
    } catch (err) {
      console.error('Error fetching categories:', err)
      showModal('ไม่สามารถดึงข้อมูลหมวดหมู่ได้', 'เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

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

      <ConfirmModal
        isOpen={modalConfig.isOpen}
        type="warning"
        title={modalConfig.title}
        description={modalConfig.description}
        confirmText="✓ รับทราบ"
        cancelText=""
        onConfirm={closeModal}
        onClose={closeModal}
      />

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
              <p className="text-xs sm:text-sm text-slate-500 truncate mt-0.5">
                เลือกหมวดหมู่วิชาที่ต้องการฝึกฝน ระบบจะทำการสุ่มโจทย์และสลับตัวเลือกเพื่อท้าทายความรู้ของคุณ!
              </p>
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
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                placeholder="พิมพ์ชื่อวิชา หรือรหัส Subject Code (เช่น #486002)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="w-full sm:w-56 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
              >
                <option value="ALL">💡 แสดงทุกสาระการเรียนรู้ </option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    📖 {cat.name}
                  </option>
                ))}
              </select>

              {(searchQuery || selectedFilter !== 'ALL') && (
                <button
                  onClick={() => { setSearchQuery(''); setSelectedFilter('ALL'); }}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                  title="ล้างการค้นหา"
                >
                  ล้าง
                </button>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <LoadingScreen text="กำลังเปิดคลังข้อสอบและเตรียมแบบทดสอบ..." />
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
            {filteredCategories.map((cat) => {
              const hasQuestions = cat.questionCount > 0
              const subjectCode = cat.id ? cat.id.substring(0, 6).toUpperCase() : '000000'

              return (
                <div
                  key={cat.id}
                  className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col justify-between space-y-6 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0 font-bold border border-indigo-100 group-hover:scale-105 transition-transform">
                          📖
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-black text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                            {cat.name}
                          </h3>
                          <span className="text-[11px] font-bold text-slate-400 block mt-0.5">
                            SUBJECT CODE: <span className="text-indigo-600 font-mono">#{subjectCode}</span>
                          </span>
                        </div>
                      </div>

                      {hasQuestions ? (
                        <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 shadow-2xs">
                          ● พร้อมสอบ
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                          ⏳ รอเพิ่มโจทย์
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed pl-14 break-words [word-break:break-word]">
                      {cat.description || 'ไม่มีคำอธิบายสำหรับหมวดหมู่วิชานี้'}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4 pl-14">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                      <span>📝 มีข้อสอบ</span>
                      <strong className="text-slate-900 font-mono text-sm bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                        {cat.questionCount}
                      </strong>
                      <span>ข้อ</span>
                    </div>

                    {hasQuestions ? (
                      <Link
                        to={`/exam/${cat.id}`}
                        className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-indigo-500/20 flex items-center gap-1.5 shrink-0"
                      >
                        <span>🚀</span><span>เริ่มทำข้อสอบ</span>
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="px-4 py-2.5 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs cursor-not-allowed border border-slate-200 shrink-0"
                      >
                        ยังไม่มีข้อสอบ
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}