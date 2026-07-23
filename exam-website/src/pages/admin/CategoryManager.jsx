import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function CategoryManager() {
  const [categories, setCategories] = useState([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // 1. ฟังก์ชันดึงข้อมูลหมวดหมู่ทั้งหมดจาก Supabase
  async function fetchCategories() {
    setLoading(true)
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: true })
    
    if (!error) {
      setCategories(data || [])
    }
    setLoading(false)
  }

  // เรียกใช้ฟังก์ชันดึงข้อมูลทันทีที่เปิดหน้านี้
  useEffect(() => {
    fetchCategories()
  }, [])

  // 2. ฟังก์ชันเพิ่มหมวดหมู่ใหม่ลงฐานข้อมูล
  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCategoryName.trim()) return

    setSubmitting(true)
    const { error } = await supabase
      .from('categories')
      .insert([{ name: newCategoryName.trim(), is_active: true }])

    if (error) {
      alert('เกิดข้อผิดพลาดในการเพิ่มหมวดหมู่: ' + error.message)
    } else {
      setNewCategoryName('') // ล้างช่องพิมพ์
      fetchCategories() // ดึงข้อมูลใหม่มาโชว์ทันที
    }
    setSubmitting(false)
  }

  // 3. ฟังก์ชันลบหมวดหมู่
  async function handleDeleteCategory(id, name) {
    const confirmDelete = window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบหมวดหมู่ "${name}" ?`)
    if (!confirmDelete) return

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (error) {
      alert('ไม่สามารถลบได้ (อาจมีข้อสอบผูกอยู่กับหมวดหมู่นี้): ' + error.message)
    } else {
      fetchCategories() // อัปเดตรายการหน้าเว็บ
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">📁 จัดการหมวดหมู่วิชา (Admin)</h1>
        <p className="text-sm text-slate-500 mb-6">เพิ่มและจัดการหมวดหมู่สำหรับใช้จัดเก็บข้อสอบในระบบ</p>

        {/* ฟอร์มเพิ่มหมวดหมู่ */}
        <form onSubmit={handleAddCategory} className="flex gap-3 mb-8">
          <input
            type="text"
            placeholder="พิมพ์ชื่อหมวดหมู่ใหม่ เช่น วิชาการศึกษา, กฎหมายครู..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting || !newCategoryName.trim()}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium rounded-xl text-sm transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? '⏳ กำลังบันทึก...' : ' + เพิ่มหมวดหมู่'}
          </button>
        </form>

        {/* ตารางแสดงรายการหมวดหมู่ */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-semibold text-xs text-slate-500 uppercase tracking-wider flex justify-between">
            <span>ชื่อหมวดหมู่</span>
            <span>จัดการ</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm animate-pulse">
              ⏳ กำลังโหลดข้อมูล...
            </div>
          ) : categories.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              📭 ยังไม่มีหมวดหมู่ในระบบ ลองพิมพ์ชื่อด้านบนแล้วกดเพิ่มดูสิครับ!
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {categories.map((cat) => (
                <div key={cat.id} className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <span className="font-medium text-slate-700 text-sm">{cat.name}</span>
                  <button
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    🗑️ ลบ
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}