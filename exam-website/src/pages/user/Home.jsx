import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Home() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchCategoriesWithCount()
  }, [])

  // ดึงหมวดหมู่ พร้อมนับว่าแต่ละหมวดมีข้อสอบกี่ข้อ
  async function fetchCategoriesWithCount() {
    setLoading(true)
    try {
      // 1. ดึงหมวดหมู่ทั้งหมดที่เปิดใช้งาน
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (catError) throw catError

      // 2. ดึงจำนวนข้อสอบในแต่ละวิชา (เพื่อเอาตัวเลขมาโชว์บนการ์ด)
      const categoriesWithCount = await Promise.all(
        (catData || []).map(async (cat) => {
          const { count, error: countError } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', cat.id)
            .eq('is_active', true)

          return {
            ...cat,
            questionCount: count || 0
          }
        })
      )

      setCategories(categoriesWithCount)
    } catch (err) {
      alert('ดึงข้อมูลหมวดหมู่ไม่สำเร็จ: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ฟังก์ชันกดเริ่มสอบ (ส่งไปยังหน้าทำข้อสอบพร้อม ID หมวดหมู่)
  const handleStartExam = (categoryId, categoryName, questionCount) => {
    if (questionCount === 0) {
      return alert(`หมวดหมู่ "${categoryName}" ยังไม่มีข้อสอบในระบบครับ!`)
    }
    // ส่งผู้ใช้ไปที่หน้าทำข้อสอบ (เราจะสร้างหน้านี้ในสเต็ปถัดไปครับ)
    navigate(`/exam/${categoryId}?title=${encodeURIComponent(categoryName)}`)
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      {/* Header แถบนำทางสำหรับผู้เข้าสอบ */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-xs">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-xl text-indigo-600">
            <span>📚 Exam practice</span>
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">Student Portal</span>
          </div>
          
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link to="/" className="text-indigo-600 font-bold">🏠 เลือกวิชาสอบ</Link>
            <Link to="/mistakes" className="text-slate-600 hover:text-indigo-600 transition-colors">📑 คลังข้อผิดของฉัน</Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-5xl mx-auto px-6 py-10 text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-3">
          คลังข้อสอบออนไลน์ พร้อมเฉลยละเอียด 💡
        </h1>
        <p className="text-slate-500 max-w-2xl mx-auto text-sm md:text-base">
          เลือกระดับหรือหมวดหมู่วิชาที่คุณต้องการฝึกฝนด้านล่าง ระบบจะทำการสลับโจทย์และตัวเลือกแบบสุ่ม เพื่อให้การเตรียมสอบของคุณมีประสิทธิภาพสูงสุด
        </p>
      </div>

      {/* Grid แสดงการ์ดวิชาสอบ */}
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          🎯 เลือกหมวดหมู่วิชา ({categories.length} วิชา)
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl p-6 border border-slate-200 h-44 animate-pulse bg-slate-100/50" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400">
            📭 ยังไม่มีหมวดหมู่วิชาที่เปิดใช้งานในขณะนี้ครับ
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <div 
                key={cat.id} 
                className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 text-xl font-bold mb-4 group-hover:scale-110 transition-transform">
                    📖
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1 group-hover:text-indigo-600 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                    <span>จำนวนข้อสอบในคลัง:</span>
                    <span className={`font-mono font-bold ${cat.questionCount > 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                      {cat.questionCount} ข้อ
                    </span>
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleStartExam(cat.id, cat.name, cat.questionCount)}
                    disabled={cat.questionCount === 0}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer disabled:cursor-not-allowed shadow-xs"
                  >
                    {cat.questionCount > 0 ? '🚀 เริ่มทำข้อสอบ' : '⏸️ ยังไม่มีข้อสอบ'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}