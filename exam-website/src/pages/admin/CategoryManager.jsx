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
  
  const [currentUserId, setCurrentUserId] = useState('')
  const [userRole, setUserRole] = useState('creator')
  
  const [editingId, setEditingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    description: ''
  })

  const showModal = (type, title, description) => {
    setModalConfig({ isOpen: true, type, title, description })
  }

  const closeModal = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }))
  }

  useEffect(() => {
    async function initUserAndCategories() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setCurrentUserId(session.user.id)
        const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
        const role = data?.role || 'creator'
        setUserRole(role)
        
        fetchCategories(role, session.user.id)
      }
    }
    initUserAndCategories()
  }, [])

  async function fetchCategories(role = userRole, userId = currentUserId) {
    setLoading(true)
    try {
      let query = supabase.from('categories').select('*')
      if (role !== 'admin' && userId) {
        query = query.eq('created_by', userId)
      }
      const { data, error } = await query.order('name')
      if (error) throw error
      setCategories(data || [])
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', 'ดึงหมวดหมู่ไม่สำเร็จ: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEditClick = (cat) => {
    setEditingId(cat.id)
    setName(cat.name)
    setDescription(cat.description || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setName('')
    setDescription('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return showModal('warning', 'ข้อมูลไม่ครบ', 'กรุณากรอกชื่อหมวดหมู่วิชาครับ')

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        is_active: true,
        created_by: currentUserId || null
      }

      if (editingId) {
        const { error } = await supabase.from('categories').update(payload).eq('id', editingId)
        if (error) throw error
        showModal('success', 'บันทึกสำเร็จ!', 'แก้ไขหมวดหมู่วิชาเรียบร้อยแล้วครับ')
      } else {
        const { error } = await supabase.from('categories').insert([payload])
        if (error) throw error
        showModal('success', 'สร้างสำเร็จ!', 'เพิ่มหมวดหมู่วิชาใหม่ลงในระบบเรียบร้อยแล้วครับ')
      }

      handleCancelEdit()
      fetchCategories()
    } catch (err) {
      showModal('danger', 'บันทึกไม่สำเร็จ', 'เกิดข้อผิดพลาดในการบันทึก: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(cat) {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: !cat.is_active })
        .eq('id', cat.id)
      if (error) throw error
      setCategories((prev) =>
        prev.map((item) => (item.id === cat.id ? { ...item, is_active: !item.is_active } : item))
      )
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', 'อัปเดตสถานะไม่สำเร็จ: ' + err.message)
    }
  }

  // 🌟 ปิดช่องโหว่รูปขยะระดับหมวดหมู่: ดึงไฟล์รูปทั้งหมดในวิชานี้มาลบทิ้งจาก Storage ก่อนลบวิชา!
  async function handleConfirmDelete() {
    if (!deleteTarget) return
    try {
      const { data: questionsInCat } = await supabase
        .from('questions')
        .select('image_url, explanation_image_url')
        .eq('category_id', deleteTarget.id)

      if (questionsInCat && questionsInCat.length > 0) {
        const filesToRemove = []
        questionsInCat.forEach(q => {
          if (q.image_url) filesToRemove.push(q.image_url.split('/').pop())
          if (q.explanation_image_url) filesToRemove.push(q.explanation_image_url.split('/').pop())
        })
        if (filesToRemove.length > 0) {
          await supabase.storage.from('exam-images').remove(filesToRemove)
        }
      }

      const { error } = await supabase.from('categories').delete().eq('id', deleteTarget.id)
      if (error) throw error
      
      setCategories((prev) => prev.filter((item) => item.id !== deleteTarget.id))
      if (editingId === deleteTarget.id) handleCancelEdit()
      setDeleteTarget(null)
      showModal('success', 'ลบสำเร็จ!', 'ลบหมวดหมู่วิชา ข้อสอบ และไฟล์รูปภาพทั้งหมดภายในออกเรียบร้อยแล้วครับ')
    } catch (err) {
      showModal('danger', 'ลบไม่สำเร็จ', err.message)
    }
  }

  return (
    <div className="space-y-8 text-slate-200 overflow-x-hidden">
      
      <ConfirmModal
        isOpen={!!deleteTarget}
        type="danger"
        title="ยืนยันการลบหมวดหมู่นี้?"
        description="ข้อสอบและสถิติทั้งหมดที่เชื่อมโยงกับหมวดวิชานี้จะถูกลบออกอย่างถาวร ไม่สามารถกู้คืนได้ครับ"
        confirmText="🚨 ยืนยันลบถาวร"
        cancelText="← ยกเลิก"
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmModal
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        title={modalConfig.title}
        description={modalConfig.description}
        confirmText="✨ ตกลง / รับทราบ"
        cancelText=""
        onConfirm={closeModal}
        onClose={closeModal}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 order-1 min-w-0">
          <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl sticky top-24 transition-colors ${
            editingId ? 'bg-indigo-950/40 border-indigo-500/50' : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2 min-w-0">
                <span>{editingId ? '✏️' : '➕'}</span>
                <span className="truncate">{editingId ? 'แก้ไขหมวดหมู่วิชา' : 'เพิ่มหมวดหมู่วิชาใหม่'}</span>
              </h3>
              {editingId && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950 animate-pulse shrink-0">
                  EDIT MODE
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
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
                    editingId ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-orange-500/20' : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-600/20'
                  }`}
                >
                  <span>{saving ? '⏳ กำลังบันทึก...' : (editingId ? '💾 บันทึกการแก้ไข' : '✨ บันทึกหมวดหมู่ใหม่')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7 order-2 space-y-4 min-w-0">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-300">
              {userRole === 'admin' 
                ? `รายการหมวดหมู่วิชาทั้งหมดในระบบ (${categories.length} วิชา)` 
                : `รายการหมวดหมู่วิชาของคุณ (${categories.length} วิชา)`}
            </h3>
          </div>

          {loading ? (
            <LoadingScreen text="กำลังดึงหมวดหมู่วิชา..." />
          ) : categories.length === 0 ? (
            <EmptyState 
              icon="📁"
              title="ยังไม่มีหมวดหมู่วิชา"
              description={userRole === 'admin'
                ? "เริ่มต้นสร้างหมวดหมู่วิชาแรกของคุณได้จากฟอร์มทางซ้ายมือเลยครับ"
                : "คุณยังไม่เคยสร้างหมวดหมู่วิชา พิมพ์ชื่อวิชาที่ต้องการสอนทางด้านซ้ายเพื่อสร้างหมวดแรกของคุณได้เลยครับ!"}
            />
          ) : (
            categories.map((cat) => (
              <div 
                key={cat.id} 
                className={`bg-slate-900 p-5 sm:p-6 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0 ${
                  editingId === cat.id ? 'border-amber-500 bg-slate-900/90 shadow-md shadow-amber-500/10' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base sm:text-lg">📖</span>
                    <h4 className="text-sm sm:text-base font-extrabold text-white truncate">{cat.name}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      cat.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {cat.is_active ? '● เปิดใช้งาน' : '⭕ ปิดใช้งาน'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 pl-6">{cat.description || 'ไม่มีคำอธิบาย'}</p>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-800/80 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => handleToggleStatus(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                      cat.is_active ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    <span>{cat.is_active ? '⏸ ปิด' : '▶ เปิด'}</span>
                  </button>
                  <button
                    onClick={() => handleEditClick(cat)}
                    className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>✏️</span><span>แก้ไข</span>
                  </button>
                  <button
                    onClick={() => setDeleteTarget(cat)}
                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center"
                    title="ลบหมวดหมู่"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}