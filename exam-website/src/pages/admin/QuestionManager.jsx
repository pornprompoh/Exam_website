import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../../components/common/ConfirmModal'
import BulkImportModal from '../../components/admin/BulkImportModal'
import QuestionForm from '../../components/admin/QuestionForm'
import QuestionList from '../../components/admin/QuestionList'
import PaginationBar from '../../components/admin/PaginationBar'

const ITEMS_PER_PAGE = 10

export default function QuestionManager() {
  const [categories, setCategories] = useState([])
  const [questions, setQuestions] = useState([])
  const [selectedCat, setSelectedCat] = useState('')
  const [loading, setLoading] = useState(true)

  const [currentUserId, setCurrentUserId] = useState('')
  const [userRole, setUserRole] = useState('creator')

  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [sortOrder, setSortOrder] = useState('asc')
  const [pageJumpInput, setPageJumpInput] = useState('')
  const [questionJumpInput, setQuestionJumpInput] = useState('')
  const [highlightedNum, setHighlightedNum] = useState(null)

  const [editingQuestion, setEditingQuestion] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showBulkModal, setShowBulkModal] = useState(false)

  // 🌟 State ใหม่สำหรับควบคุมการเปิด/ปิดแผงสไลด์ Drawer ด้านขวามือ
  const [isFormOpen, setIsFormOpen] = useState(false)

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

  useEffect(() => {
    if (highlightedNum !== null && questions.length > 0) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`question-card-${highlightedNum}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        setTimeout(() => setHighlightedNum(null), 3000)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [questions, highlightedNum])

  async function fetchCategories(role = userRole, userId = currentUserId) {
    try {
      let query = supabase.from('categories').select('*').eq('is_active', true)
      if (role !== 'admin' && userId) {
        query = query.eq('created_by', userId)
      }
      const { data, error } = await query.order('name')
      if (error) throw error
      
      const validCats = data || []
      setCategories(validCats)
      if (validCats.length > 0) {
        setSelectedCat(validCats[0].id)
        setCurrentPage(1)
        fetchQuestions(validCats[0].id, 1, 'asc', role, userId)
      } else {
        setQuestions([])
        setLoading(false)
      }
    } catch (err) { console.error(err) }
  }

  async function fetchQuestions(catId, page = currentPage, order = sortOrder, role = userRole, userId = currentUserId) {
    if (!catId) return
    setLoading(true)
    try {
      const fromIndex = (page - 1) * ITEMS_PER_PAGE
      const toIndex = fromIndex + ITEMS_PER_PAGE - 1

      let query = supabase
        .from('questions')
        .select('*', { count: 'exact' })
        .eq('category_id', catId)

      if (role !== 'admin' && userId) {
        query = query.eq('created_by', userId)
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: order === 'asc' })
        .range(fromIndex, toIndex)

      if (error) throw error

      if (data && data.length === 0 && page > 1) {
        const prevPage = page - 1
        setCurrentPage(prevPage)
        return fetchQuestions(catId, prevPage, order, role, userId)
      }

      setQuestions(data || [])
      setTotalCount(count || 0)
    } catch (err) { 
      console.error(err) 
    } finally { 
      setLoading(false) 
    }
  }

  const handleCategoryChange = (newCatId) => {
    setSelectedCat(newCatId)
    setCurrentPage(1)
    setPageJumpInput('')
    setQuestionJumpInput('')
    setHighlightedNum(null)
    setEditingQuestion(null)
    setIsFormOpen(false)
    fetchQuestions(newCatId, 1, sortOrder)
  }

  const handleToggleSortOrder = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc'
    setSortOrder(newOrder)
    setCurrentPage(1)
    setPageJumpInput('')
    setQuestionJumpInput('')
    setHighlightedNum(null)
    fetchQuestions(selectedCat, 1, newOrder)
  }

  const handlePageChange = (newPage) => {
    const maxPage = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1
    if (newPage < 1 || newPage > maxPage) return
    setCurrentPage(newPage)
    setPageJumpInput('')
    setQuestionJumpInput('')
    setHighlightedNum(null)
    fetchQuestions(selectedCat, newPage, sortOrder)
    window.scrollTo({ top: 300, behavior: 'smooth' })
  }

  const handlePageJumpSubmit = (e) => {
    e.preventDefault()
    const targetPage = parseInt(pageJumpInput, 10)
    const maxPage = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1
    
    if (isNaN(targetPage) || targetPage < 1 || targetPage > maxPage) {
      return showModal('warning', 'เลขหน้าไม่ถูกต้อง', `กรุณาระบุเลขหน้าระหว่าง 1 ถึง ${maxPage} ครับ`)
    }
    handlePageChange(targetPage)
  }

  const handleQuestionJumpSubmit = (e) => {
    e.preventDefault()
    const targetNum = parseInt(questionJumpInput, 10)
    
    if (isNaN(targetNum) || targetNum < 1 || targetNum > totalCount) {
      return showModal('warning', 'เลขข้อไม่ถูกต้อง', `กรุณาระบุเลขข้อสอบระหว่าง 1 ถึง ${totalCount} ครับ`)
    }

    let targetPage = 1
    if (sortOrder === 'asc') {
      targetPage = Math.ceil(targetNum / ITEMS_PER_PAGE)
    } else {
      targetPage = Math.ceil((totalCount - targetNum + 1) / ITEMS_PER_PAGE)
    }

    setHighlightedNum(targetNum)
    setQuestionJumpInput('')

    if (targetPage !== currentPage) {
      setCurrentPage(targetPage)
      fetchQuestions(selectedCat, targetPage, sortOrder)
    } else {
      const el = document.getElementById(`question-card-${targetNum}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      setTimeout(() => setHighlightedNum(null), 3000)
    }
  }

  const deleteStorageFile = async (url) => {
    if (!url) return
    try {
      const fileName = url.split('/').pop()
      if (fileName) {
        await supabase.storage.from('exam-images').remove([fileName])
      }
    } catch (err) {
      console.error('ไม่สามารถลบไฟล์รูปเก่าจาก Storage ได้:', err)
    }
  }

  async function handleToggleQuestionStatus(q) {
    try {
      const { error } = await supabase
        .from('questions')
        .update({ is_active: !q.is_active })
        .eq('id', q.id)
      if (error) throw error
      
      setQuestions((prev) =>
        prev.map((item) => (item.id === q.id ? { ...item, is_active: !item.is_active } : item))
      )
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', 'เปลี่ยนสถานะข้อสอบไม่สำเร็จ: ' + err.message)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const { id, image_url, explanation_image_url } = deleteTarget

    try {
      if (image_url) await deleteStorageFile(image_url)
      if (explanation_image_url) await deleteStorageFile(explanation_image_url)

      const { error } = await supabase.from('questions').delete().eq('id', id)
      if (error) throw error

      if (editingQuestion?.id === id) {
        setEditingQuestion(null)
        setIsFormOpen(false)
      }
      setDeleteTarget(null)
      showModal('success', 'ลบข้อสอบสำเร็จ!', 'ลบข้อสอบและไฟล์รูปภาพประกอบออกจากระบบถาวรแล้วครับ')
      
      fetchQuestions(selectedCat, currentPage, sortOrder)
    } catch (err) {
      showModal('danger', 'ลบไม่สำเร็จ', err.message)
    }
  }

  // 🌟 ฟังก์ชันเปิด Drawer สร้างข้อสอบใหม่
  const handleOpenCreateForm = () => {
    if (!selectedCat) return showModal('warning', 'ยังไม่ได้เลือกวิชา', 'กรุณาเลือกหมวดหมู่วิชาก่อนสร้างโจทย์ครับ')
    setEditingQuestion(null)
    setIsFormOpen(true)
  }

  // 🌟 ฟังก์ชันเปิด Drawer แก้ไขข้อสอบเดิม
  const handleOpenEditForm = (q) => {
    setEditingQuestion(q)
    setIsFormOpen(true)
  }

  // 🌟 ฟังก์ชันปิด Drawer
  const handleCloseForm = () => {
    setEditingQuestion(null)
    setIsFormOpen(false)
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1
  const startItemNumber = totalCount === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1
  const endItemNumber = Math.min(currentPage * ITEMS_PER_PAGE, totalCount)

  return (
    <div className="space-y-8 text-slate-200 overflow-x-hidden relative">
      
      <ConfirmModal
        isOpen={!!deleteTarget}
        type="danger"
        title="ยืนยันการลบข้อสอบนี้?"
        description="ข้อสอบและไฟล์รูปภาพประกอบจะถูกลบออกจากระบบและคลังข้อผิดพลาดถาวรครับ"
        confirmText="🚨 ลบข้อสอบถาวร"
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

      <BulkImportModal 
        isOpen={showBulkModal} 
        onClose={() => setShowBulkModal(false)} 
        categoryId={selectedCat}
        currentUserId={currentUserId}
        onSuccess={() => {
          setCurrentPage(1)
          fetchQuestions(selectedCat, 1, sortOrder)
        }} 
      />

      {/* 🌟 แผงสไลด์ Drawer จากขวามือสำหรับสร้างและแก้ไขข้อสอบ (Off-Canvas Form) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop พื้นหลังมืด */}
          <div 
            onClick={handleCloseForm} 
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity animate-fadeIn cursor-pointer"
          />
          
          {/* Slide-over Panel */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl overflow-y-auto flex flex-col relative z-10 animate-slideLeft">
              
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-20 backdrop-blur-md">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-lg shrink-0">
                    {editingQuestion ? '✏️' : '➕'}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-white uppercase tracking-wider truncate">
                      {editingQuestion ? 'แก้ไขโจทย์ข้อสอบ' : 'สร้างโจทย์ข้อสอบใหม่'}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      {editingQuestion ? `กำลังแก้ไขข้อสอบ ID: ${editingQuestion.id.substring(0, 8)}...` : 'เพิ่มโจทย์และเฉลยทีละข้อลงในคลัง (Manual)'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleCloseForm}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 font-bold flex items-center justify-center transition-all cursor-pointer shrink-0"
                  title="ปิดหน้าต่าง"
                >
                  ✕
                </button>
              </div>

              {/* Drawer Body - เรนเดอร์ QuestionForm ที่เราแยกไฟล์ไว้ */}
              <div className="p-4 sm:p-6 flex-1">
                <QuestionForm
                  selectedCat={selectedCat}
                  currentUserId={currentUserId}
                  editingQuestion={editingQuestion}
                  onCancelEdit={handleCloseForm}
                  onSaveSuccess={() => {
                    handleCloseForm()
                    fetchQuestions(selectedCat, currentPage, sortOrder)
                  }}
                  showModal={showModal}
                  deleteStorageFile={deleteStorageFile}
                />
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 🌟 แผงคุมเครื่องมือด้านบน: เพิ่มปุ่ม "➕ สร้างโจทย์ข้อใหม่" เข้ามาโดดเด่น */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl shrink-0">📚</span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white truncate">เลือกหมวดหมู่วิชาเพื่อจัดการโจทย์</h2>
            <p className="text-xs text-slate-400 truncate">
              {userRole === 'admin' ? 'แสดงโจทย์คำถามทั้งหมดในระบบ' : 'แสดงเฉพาะหมวดวิชาและโจทย์คำถามที่คุณเป็นคนสร้าง'}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto shrink-0">
          {categories.length > 0 ? (
            <select
              value={selectedCat}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="flex-1 sm:w-56 px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>📖 {cat.name}</option>
              ))}
            </select>
          ) : (
            <div className="px-4 py-3 bg-slate-950 border border-red-500/30 text-red-400 rounded-2xl text-xs font-bold">
              ⚠️ ยังไม่มีหมวดหมู่วิชาของตนเอง
            </div>
          )}

          <button
            onClick={handleOpenCreateForm}
            disabled={categories.length === 0}
            className="flex-1 sm:flex-initial px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 cursor-pointer flex items-center justify-center gap-2 shrink-0 h-full"
            title="สร้างโจทย์ทีละข้อแบบ Manual"
          >
            <span>➕</span><span>สร้างโจทย์ใหม่</span>
          </button>

          <button
            onClick={() => setShowBulkModal(true)}
            disabled={categories.length === 0}
            className="flex-1 sm:flex-initial px-4 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-30 disabled:cursor-not-allowed border border-indigo-500/30 text-indigo-400 rounded-2xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 h-full"
            title="นำเข้าข้อสอบชุดใหญ่ด้วย AI"
          >
            <span className="hidden sm:inline">⚡ นำเข้าชุดใหญ่</span>
            <span className="sm:hidden">⚡ AI Bulk</span>
          </button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center max-w-2xl mx-auto my-8 space-y-4">
          <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center text-3xl mx-auto border border-indigo-500/20">
            📁
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white">คุณยังไม่ได้สร้างหรือเป็นเจ้าของหมวดหมู่วิชาใดในระบบ</h3>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            ในฐานะผู้ช่วยสร้างข้อสอบ (Creator) คุณสามารถเพิ่มข้อสอบได้เฉพาะในหมวดหมู่วิชาที่เป็นของคุณเท่านั้น<br/>
            กรุณาไปที่เมนู <strong>"📁 จัดการหมวดหมู่"</strong> เพื่อสร้างวิชาของคุณก่อนเริ่มลงข้อสอบครับ
          </p>
        </div>
      ) : (
        /* 🌟 ตารางข้อสอบขยายกว้างเต็มจอ 100% (Full-Width Display) */
        <div className="w-full space-y-6">
          
          <QuestionList
            questions={questions}
            loading={loading}
            userRole={userRole}
            totalCount={totalCount}
            currentPage={currentPage}
            sortOrder={sortOrder}
            highlightedNum={highlightedNum}
            editingId={editingQuestion?.id}
            onEditClick={handleOpenEditForm}
            onDeleteClick={(q) => setDeleteTarget(q)}
            onToggleStatus={handleToggleQuestionStatus}
            onToggleSortOrder={handleToggleSortOrder}
            ITEMS_PER_PAGE={ITEMS_PER_PAGE}
          />

          <PaginationBar
            totalCount={totalCount}
            currentPage={currentPage}
            totalPages={totalPages}
            startItemNumber={startItemNumber}
            endItemNumber={endItemNumber}
            pageJumpInput={pageJumpInput}
            setPageJumpInput={setPageJumpInput}
            questionJumpInput={questionJumpInput}
            setQuestionJumpInput={setQuestionJumpInput}
            onPageChange={handlePageChange}
            onPageJumpSubmit={handlePageJumpSubmit}
            onQuestionJumpSubmit={handleQuestionJumpSubmit}
          />

        </div>
      )}

    </div>
  )
}