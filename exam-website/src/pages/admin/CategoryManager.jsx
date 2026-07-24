import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingScreen from '../../components/common/LoadingScreen'
import EmptyState from '../../components/common/EmptyState'
import ConfirmModal from '../../components/common/ConfirmModal'

export default function CategoryManager() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  
  // State สำหรับระบบแก้ไข และระบบลบ
  const [editingId, setEditingId] = useState(null) // เก็บ ID ของหมวดหมู่ที่กำลังแก้ไขอยู่
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  async function fetchCategories() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      
      const categoriesWithCount = await Promise.all(
        (data || []).map(async (cat) => {
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
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // กดเลือกหมวดหมู่เพื่อเข้าสู่โหมดแก้ไข
  const handleEditClick = (cat) => {
    setEditingId(cat.id)
    setName(cat.name)
    setDescription(cat.description || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // กดยกเลิกโหมดแก้ไข กลับเป็นโหมดเพิ่มใหม่
  const handleCancelEdit = () => {
    setEditingId(null)
    setName('')
    setDescription('')
  }

  // บันทึกข้อมูล (แยกระหว่าง สร้างใหม่ vs อัปเดตของเดิม)
  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return alert('กรุณากรอกชื่อหมวดหมู่')

    setSaving(true)
    try {
      if (editingId) {
        // อัปเดตข้อมูลเดิม
        const { error } = await supabase
          .from('categories')
          .update({ name, description })
          .eq('id', editingId)

        if (error) throw error
        alert('✅ แก้ไขหมวดหมู่วิชาเรียบร้อยแล้ว')
      } else {
        // สร้างข้อมูลใหม่
        const { error } = await supabase
          .from('categories')
          .insert([{ name, description, is_active: true }])

        if (error) throw error
        alert('✅ เพิ่มหมวดหมู่วิชาใหม่เรียบร้อยแล้ว')
      }

      handleCancelEdit()
      fetchCategories()
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const { id, name } = deleteTarget

    try {
      const { count } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', id)

      if (count > 0) {
        alert(`❌ ไม่สามารถลบได้ เนื่องจากมีข้อสอบอยู่ในหมวดหมู่ "${name}" จำนวน ${count} ข้อ\nกรุณาลบข้อสอบข้างในออกให้หมดก่อนครับ`)
        setDeleteTarget(null)
        return
      }

      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error

      setCategories((prev) => prev.filter((c) => c.id !== id))
      if (editingId === id) handleCancelEdit()
      setDeleteTarget(null)
    } catch (err) {
      alert('ลบไม่สำเร็จ: ' + err.message)
    }
  }

  async function toggleStatus(id, currentStatus) {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: !currentStatus })
        .eq('id', id)

      if (error) throw error
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_active: !currentStatus } : c))
      )
    } catch (err) {
      alert('อัปเดตสถานะไม่สำเร็จ: ' + err.message)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-slate-200">
      
      <ConfirmModal
        isOpen={!!deleteTarget}
        type="danger"
        title="ยืนยันการลบหมวดหมู่วิชานี้?"
        description={`คุณกำลังจะลบหมวดหมู่ "${deleteTarget?.name}" ออกจากระบบถาวร การกระทำนี้ไม่สามารถกู้คืนได้ครับ`}
        confirmText="🚨 ลบหมวดหมู่ถาวร"
        cancelText="← ยกเลิก"
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* คอลัมน์ซ้าย (4 คอลัมน์): ฟอร์มเพิ่ม/แก้ไขหมวดหมู่ (Responsive Stack) */}
      <div className="lg:col-span-4 order-1">
        <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl sticky top-24 transition-colors ${
          editingId ? 'bg-indigo-950/40 border-indigo-500/50' : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span>{editingId ? '✏️' : '➕'}</span>
              <span>{editingId ? 'แก้ไขข้อมูลหมวดหมู่' : 'เพิ่มหมวดหมู่วิชาใหม่'}</span>
            </h2>
            {editingId && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500 text-white animate-pulse">
                EDIT MODE
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">ชื่อหมวดหมู่ / วิชา *</label>
              <input
                type="text"
                required
                placeholder="เช่น วิทยาศาสตร์ ม.3"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">คำอธิบาย (ถ้ามี)</label>
              <textarea
                rows="3"
                placeholder="อธิบายเนื้อหาโดยย่อ..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs sm:text-sm transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className={`flex-1 py-3.5 disabled:opacity-50 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 ${
                  editingId ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-orange-500/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                }`}
              >
                <span>{saving ? '⏳ กำลังบันทึก...' : (editingId ? '💾 บันทึกการแก้ไข' : '✨ บันทึกหมวดหมู่ใหม่')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* คอลัมน์ขวา (8 คอลัมน์): ตารางแสดงหมวดหมู่ทั้งหมด */}
      <div className="lg:col-span-8 order-2 space-y-4">
        {loading ? (
          <LoadingScreen text="กำลังดึงข้อมูลหมวดหมู่ทั้งหมด..." />
        ) : categories.length === 0 ? (
          <EmptyState 
            icon="📭"
            title="ยังไม่มีหมวดหมู่วิชาในระบบ"
            description="เริ่มต้นสร้างหมวดหมู่วิชาแรกของคุณได้จากฟอร์มด้านซ้ายมือเลยครับ"
          />
        ) : (
          categories.map((cat) => (
            <div
              key={cat.id}
              className={`bg-slate-900 p-5 sm:p-6 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                editingId === cat.id ? 'border-indigo-500 bg-slate-900/90 shadow-md shadow-indigo-500/10' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h3 className="text-base sm:text-lg font-bold text-white">{cat.name}</h3>
                  <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold ${
                    cat.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {cat.is_active ? '● เปิดใช้งาน' : '○ ปิดใช้งาน'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-1">{cat.description || 'ไม่มีคำอธิบาย'}</p>
                <div className="text-xs font-mono text-indigo-400 font-bold pt-1">
                  จำนวนข้อสอบ: {cat.questionCount} ข้อ
                </div>
              </div>

              {/* ปุ่ม Action (Responsive พับแถวเมื่อจอเล็ก) */}
              <div className="flex flex-wrap items-center gap-2 pt-3 sm:pt-0 border-t sm:border-0 border-slate-800 shrink-0">
                <button
                  onClick={() => toggleStatus(cat.id, cat.is_active)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    cat.is_active 
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                      : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {cat.is_active ? '⏸️ ปิด' : '▶️ เปิด'}
                </button>

                <button
                  onClick={() => handleEditClick(cat)}
                  className="px-3.5 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  title="แก้ไขชื่อหรือคำอธิบาย"
                >
                  <span>✏️</span><span className="hidden sm:inline">แก้ไข</span>
                </button>

                <button
                  onClick={() => setDeleteTarget(cat)}
                  className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  title="ลบหมวดหมู่"
                >
                  <span>🗑️</span><span className="hidden sm:inline">ลบ</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  )
}