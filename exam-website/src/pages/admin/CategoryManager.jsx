import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingScreen from '../../components/common/LoadingScreen'
import EmptyState from '../../components/common/EmptyState'
import ConfirmModal from '../../components/common/ConfirmModal'
import ShareCategoryModal from '../../components/admin/ShareCategoryModal'
import BatchActionBar from '../../components/admin/BatchActionBar' // 🌟 นำเข้า Component ใหม่

export default function CategoryManager() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  
  const [currentUserId, setCurrentUserId] = useState('')
  const [userRole, setUserRole] = useState('creator')
  
  const [editingCat, setEditingCat] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  
  const [deleteTarget, setDeleteTarget] = useState(null) 
  const [shareTargetCat, setShareTargetCat] = useState(null)

  // State สำหรับระบบ Pagination, Sorting และ การเลือกหลายรายการ
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [sortOrder, setSortOrder] = useState('asc')
  const [selectedItems, setSelectedItems] = useState([])

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
        query = query.or(`created_by.eq.${userId},co_owners.cs.{${userId}}`)
      }

      const { data, error } = await query.order('created_at', { ascending: true })
      if (error) throw error
      setCategories(data || [])
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', 'ดึงหมวดหมู่ไม่สำเร็จ: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ==========================================
  // Logic การเรียงลำดับและแบ่งหน้า (Sorting & Pagination)
  // ==========================================
  const sortedCategories = [...categories].sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime()
    const dateB = new Date(b.created_at || 0).getTime()
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
  })

  const totalPages = Math.ceil(sortedCategories.length / itemsPerPage) || 1
  const paginatedCategories = sortedCategories.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    setCurrentPage(1)
  }

  // ==========================================
  // Logic การเลือก Checkbox (Selection)
  // ==========================================
  const handleSelectAllInPage = (e) => {
    const pageIds = paginatedCategories.map(c => c.id)
    if (e.target.checked) {
      const newSelected = [...new Set([...selectedItems, ...pageIds])]
      setSelectedItems(newSelected)
    } else {
      setSelectedItems(selectedItems.filter(id => !pageIds.includes(id)))
    }
  }

  const handleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(itemId => itemId !== id) : [...prev, id]
    )
  }

  const isAllCurrentPageSelected = paginatedCategories.length > 0 && paginatedCategories.every(c => selectedItems.includes(c.id))
  const selectedCountInPage = paginatedCategories.filter(c => selectedItems.includes(c.id)).length

  // ==========================================
  // Logic Form เพิ่ม / แก้ไข
  // ==========================================
  const handleOpenCreateForm = () => {
    setEditingCat(null)
    setName('')
    setDescription('')
    setIsFormOpen(true)
  }

  const handleOpenEditForm = (cat) => {
    setEditingCat(cat)
    setName(cat.name)
    setDescription(cat.description || '')
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setEditingCat(null)
    setName('')
    setDescription('')
    setIsFormOpen(false)
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
        created_by: editingCat ? editingCat.created_by : (currentUserId || null)
      }

      if (editingCat) {
        const { error } = await supabase.from('categories').update(payload).eq('id', editingCat.id)
        if (error) throw error
        showModal('success', 'บันทึกสำเร็จ!', 'แก้ไขหมวดหมู่วิชาเรียบร้อยแล้วครับ')
      } else {
        const { error } = await supabase.from('categories').insert([payload])
        if (error) throw error
        showModal('success', 'สร้างสำเร็จ!', 'เพิ่มหมวดหมู่วิชาใหม่ลงในระบบเรียบร้อยแล้วครับ')
      }

      handleCloseForm()
      fetchCategories()
    } catch (err) {
      showModal('danger', 'บันทึกไม่สำเร็จ', 'เกิดข้อผิดพลาดในการบันทึก: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(cat) {
    try {
      const { error } = await supabase.from('categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
      if (error) throw error
      setCategories((prev) => prev.map((item) => (item.id === cat.id ? { ...item, is_active: !item.is_active } : item)))
    } catch (err) { showModal('danger', 'เกิดข้อผิดพลาด', 'อัปเดตสถานะไม่สำเร็จ: ' + err.message) }
  }

  // 🌟 Logic การเปิด/ปิด สถานะแบบกลุ่ม (Batch Status Update)
  async function handleBatchToggleStatus(isActive) {
    try {
      const { error } = await supabase.from('categories').update({ is_active: isActive }).in('id', selectedItems)
      if (error) throw error
      
      setCategories(prev => prev.map(item => selectedItems.includes(item.id) ? { ...item, is_active: isActive } : item))
      showModal('success', 'อัปเดตสำเร็จ', `ปรับสถานะเป็น "${isActive ? 'เปิดใช้งาน' : 'ซ่อนฉบับร่าง'}" จำนวน ${selectedItems.length} รายการเรียบร้อยแล้ว`)
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', err.message)
    }
  }

  // 🌟 Logic การลบทีละรายการ หรือ การลบแบบกลุ่ม (Batch Delete)
  async function handleConfirmDelete() {
    if (!deleteTarget || deleteTarget.length === 0) return
    
    try {
      const { data: questionsInCat } = await supabase.from('questions').select('image_url, explanation_image_url').in('category_id', deleteTarget)
      
      if (questionsInCat && questionsInCat.length > 0) {
        const filesToRemove = []
        questionsInCat.forEach(q => {
          if (q.image_url) filesToRemove.push(q.image_url.split('/').pop())
          if (q.explanation_image_url) filesToRemove.push(q.explanation_image_url.split('/').pop())
        })
        if (filesToRemove.length > 0) await supabase.storage.from('exam-images').remove(filesToRemove)
      }

      const { error } = await supabase.from('categories').delete().in('id', deleteTarget)
      if (error) throw error
      
      setCategories((prev) => prev.filter((item) => !deleteTarget.includes(item.id)))
      setSelectedItems((prev) => prev.filter(id => !deleteTarget.includes(id)))
      
      if (editingCat && deleteTarget.includes(editingCat.id)) handleCloseForm()
      
      const deletedCount = deleteTarget.length
      setDeleteTarget(null)
      showModal('success', 'ลบสำเร็จ!', `ลบหมวดหมู่วิชาจำนวน ${deletedCount} หมวด ข้อสอบ และไฟล์รูปภาพทั้งหมดภายในออกเรียบร้อยแล้วครับ`)
      
      if (paginatedCategories.length === deletedCount && currentPage > 1) {
        setCurrentPage(prev => prev - 1)
      }
    } catch (err) { 
      showModal('danger', 'ลบไม่สำเร็จ', err.message) 
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 text-slate-200 overflow-x-hidden relative pb-32">
      
      <ConfirmModal
        isOpen={!!deleteTarget}
        type="danger"
        title={deleteTarget?.length > 1 ? `ยืนยันการลบ ${deleteTarget.length} หมวดหมู่นี้?` : "ยืนยันการลบหมวดหมู่นี้?"}
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

      <ShareCategoryModal
        isOpen={!!shareTargetCat}
        onClose={() => setShareTargetCat(null)}
        category={shareTargetCat}
        currentUserId={currentUserId}
        onSuccess={() => fetchCategories()}
        showModal={showModal}
      />

      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div onClick={handleCloseForm} className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity animate-fadeIn cursor-pointer" />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl overflow-y-auto flex flex-col relative z-10 animate-slideLeft">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-20 backdrop-blur-md">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-lg shrink-0">
                    {editingCat ? '✏️' : '📁'}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-white uppercase tracking-wider truncate">
                      {editingCat ? 'แก้ไขหมวดหมู่วิชา' : 'เพิ่มหมวดหมู่วิชาใหม่'}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      {editingCat ? `กำลังแก้ไขวิชา: ${editingCat.name}` : 'สร้างวิชาใหม่สำหรับจัดเก็บข้อสอบของคุณ'}
                    </p>
                  </div>
                </div>
                <button onClick={handleCloseForm} className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 font-bold flex items-center justify-center transition-all cursor-pointer shrink-0">✕</button>
              </div>

              <div className="p-6 flex-1">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">ชื่อหมวดหมู่ / วิชา *</label>
                    <input type="text" required placeholder="เช่น วิทยาศาสตร์ ม.3" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">คำอธิบาย (ถ้ามี)</label>
                    <textarea rows="4" placeholder="อธิบายเนื้อหาโดยย่อ..." value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none" />
                  </div>
                  <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row gap-2">
                    {editingCat && <button type="button" onClick={handleCloseForm} className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs sm:text-sm transition-all cursor-pointer">ยกเลิก</button>}
                    <button type="submit" disabled={saving} className={`flex-1 py-3.5 disabled:opacity-50 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 ${editingCat ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-orange-500/20' : 'bg-gradient-to-r from-indigo-600 to-violet-600 shadow-indigo-600/20'}`}>
                      <span>{saving ? '⏳ กำลังบันทึก...' : (editingCat ? '💾 บันทึกการแก้ไข' : '✨ บันทึกหมวดหมู่ใหม่')}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl shrink-0">📁</span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white truncate">
              {userRole === 'admin' ? 'รายการหมวดหมู่วิชาทั้งหมดในระบบ' : 'รายการหมวดหมู่วิชาของคุณและที่ดูแลร่วมกัน'}
            </h2>
            <p className="text-xs text-slate-400 truncate">มีวิชาเปิดใช้งานอยู่ทั้งหมด {categories.length} วิชา</p>
          </div>
        </div>
        
        <button onClick={handleOpenCreateForm} className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 cursor-pointer flex items-center justify-center gap-2 shrink-0">
          <span>➕</span><span>เพิ่มหมวดหมู่วิชาใหม่</span>
        </button>
      </div>

      {/* แถบ Control Bar (Pagination & Sorting UI) */}
      {categories.length > 0 && (
        <div className="bg-[#0A0F1C]/80 border border-slate-800 p-3 sm:p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <label className="flex items-center gap-2 cursor-pointer bg-[#0A0F1C] px-3 py-2 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors">
              <input 
                type="checkbox" 
                checked={isAllCurrentPageSelected}
                onChange={handleSelectAllInPage}
                className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-[#0A0F1C] cursor-pointer" 
              />
              <span className="text-xs sm:text-sm font-bold text-slate-300 select-none">เลือกหน้านี้ ({selectedCountInPage})</span>
            </label>
            <span className="text-xs sm:text-sm font-bold text-slate-300">
              วิชาทั้งหมด ({categories.length} หมวด)
            </span>
            <span className="text-[11px] sm:text-xs font-bold bg-indigo-500/10 text-indigo-400 px-3 py-1.5 rounded-full border border-indigo-500/20 tracking-wide">
              หน้า {currentPage}/{totalPages}
            </span>
          </div>
          <button 
            onClick={toggleSortOrder}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#0A0F1C] hover:bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-700 text-xs sm:text-sm font-bold transition-all text-slate-300 cursor-pointer"
          >
            <span className="text-indigo-400 text-base leading-none">🔀</span>
            <span>เรียงลำดับ: <strong className="text-amber-500 font-black">{sortOrder === 'asc' ? 'วิชาแรก ➔ ล่าสุด' : 'ล่าสุด ➔ วิชาแรก'}</strong></span>
          </button>
        </div>
      )}

      {/* ส่วนแสดงรายการหมวดหมู่ */}
      <div className="w-full space-y-4">
        {loading ? (
          <LoadingScreen text="กำลังดึงหมวดหมู่วิชาทั้งหมด..." />
        ) : categories.length === 0 ? (
          <EmptyState 
            icon="📁"
            title="ยังไม่มีหมวดหมู่วิชา"
            description="คุณยังไม่เคยสร้างหมวดหมู่วิชา และยังไม่มีใครแชร์วิชามาให้คุณดูแล กดปุ่ม '➕ เพิ่มหมวดหมู่วิชาใหม่' ด้านบนเพื่อสร้างวิชาแรกของคุณได้เลยครับ!"
            theme="dark"
          />
        ) : (
          paginatedCategories.map((cat) => {
            const isOwner = cat.created_by === currentUserId || userRole === 'admin'
            const isCoOwner = (cat.co_owners || []).includes(currentUserId) && !isOwner
            const coOwnersCount = (cat.co_owners || []).length
            const isSelected = selectedItems.includes(cat.id)

            return (
              <div 
                key={cat.id} 
                className={`p-4 sm:p-6 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0 ${
                  isSelected ? 'border-indigo-500 bg-slate-900 shadow-md ring-1 ring-indigo-500' : 
                  editingCat?.id === cat.id ? 'border-amber-500 bg-slate-900/90 shadow-md' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="min-w-0 flex-1 flex items-start sm:items-center gap-4">
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={() => handleSelectItem(cat.id)}
                    className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-indigo-500 mt-1 sm:mt-0 cursor-pointer shrink-0" 
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-base sm:text-lg">📖</span>
                      <h4 className="text-base font-extrabold text-white truncate max-w-md">{cat.name}</h4>
                      
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        cat.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {cat.is_active ? '● เปิดใช้งาน' : '⭕ ปิดใช้งาน'}
                      </span>

                      {isOwner ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">👑 เจ้าของหลัก</span>
                      ) : isCoOwner ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 shrink-0">🤝 เจ้าของร่วม</span>
                      ) : null}

                      {coOwnersCount > 0 && (
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                          👥 ดูแลร่วม {coOwnersCount} คน
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 pl-7 leading-relaxed">{cat.description || 'ไม่มีคำอธิบาย'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto shrink-0 pt-3 sm:pt-0 border-t sm:border-0 border-slate-800/80 w-full sm:w-auto justify-end">
                  
                  <button
                    onClick={() => setShareTargetCat(cat)}
                    className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="แชร์สิทธิ์การจัดการวิชานี้ให้ Creator คนอื่น"
                  >
                    <span>👥</span><span>แชร์สิทธิ์</span>
                  </button>

                  <button
                    onClick={() => handleToggleStatus(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                      cat.is_active ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    <span>{cat.is_active ? '⏸ ปิด' : '▶ เปิด'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenEditForm(cat)}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>✏️</span><span>แก้ไข</span>
                  </button>

                  {isOwner && (
                    <button
                      onClick={() => setDeleteTarget([cat.id])}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center"
                      title="ลบหมวดหมู่"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ปุ่มเปลี่ยนหน้า (Pagination Controls) ด้านล่าง */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2 pb-8">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            ← ก่อนหน้า
          </button>
          <div className="flex items-center gap-1.5 mx-1 sm:mx-2 overflow-x-auto">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-8 h-8 shrink-0 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  currentPage === i + 1 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            ถัดไป →
          </button>
        </div>
      )}

      {/* 🌟 เรียกใช้งาน Component แถบเครื่องมือลอย (BatchActionBar) ตรงนี้ */}
      <BatchActionBar 
        selectedCount={selectedItems.length}
        itemName="หมวด"
        onClearSelection={() => setSelectedItems([])}
        onToggleStatus={handleBatchToggleStatus}
        onDelete={() => setDeleteTarget(selectedItems)}
      />

    </div>
  )
}