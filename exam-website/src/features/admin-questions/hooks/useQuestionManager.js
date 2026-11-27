/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getGeminiApiKey } from '../../../shared/lib/geminiApiKey'
import useCategories from '../../../shared/hooks/useCategories'
import { clearCategoryStagingItems, fetchCategoryStagingCount } from '../../admin-ai/extractor/services/stagingQuestionService'
import { fetchFlaggedBadgeCounts } from '../../admin-ai/auditor/services/auditorDbService'
import {
  QUESTIONS_PER_PAGE,
  bulkDeleteQuestionsWithImages,
  bulkMoveQuestionCategory,
  bulkUpdateQuestionStatus,
  deleteQuestionWithImages,
  fetchCategoryQuestionsPage,
  getQuestionManagerSession,
  toggleQuestionActiveStatus
} from '../services/questionService'

export function useQuestionManager() {
  const navigate = useNavigate()
  const { categories, refetch: refetchCategories } = useCategories({
    activeOnly: true,
    includeQuestionCounts: true,
    enabled: false
  })

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
  const [showAIGeneratorModal, setShowAIGeneratorModal] = useState(false)
  const [showAIExtractorModal, setShowAIExtractorModal] = useState(false)
  const [extractorInitialTab, setExtractorInitialTab] = useState('extract')
  const [stagingCount, setStagingCount] = useState(0)
  const [showClearStagingConfirm, setShowClearStagingConfirm] = useState(false)
  const [showAIAuditorModal, setShowAIAuditorModal] = useState(false)
  const [auditorInitialTab, setAuditorInitialTab] = useState('scan')
  const [flaggedCounts, setFlaggedCounts] = useState({ categoryFlagged: 0, totalFlagged: 0 })
  const [showAIKeyRequired, setShowAIKeyRequired] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [showToolsMenu, setShowToolsMenu] = useState(false)
  const toolsMenuRef = useRef(null)

  const [selectedIds, setSelectedIds] = useState([])
  const [questionSearch, setQuestionSearch] = useState('')
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)

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
    if (!showToolsMenu) return undefined
    const handleOutsideClick = (event) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target)) {
        setShowToolsMenu(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setShowToolsMenu(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showToolsMenu])

  const handleGoToAISettings = () => {
    setShowAIKeyRequired(false)
    setShowAIGeneratorModal(false)
    setShowAIExtractorModal(false)
    setShowAIAuditorModal(false)
    navigate('/admin/ai-settings')
  }

  const refreshFlaggedCounts = async (catId) => {
    const counts = await fetchFlaggedBadgeCounts(catId)
    setFlaggedCounts(counts)
  }

  const refreshStagingCount = async (catId, role = userRole) => {
    if (!catId || role !== 'admin') {
      setStagingCount(0)
      return
    }
    try {
      const count = await fetchCategoryStagingCount(catId)
      setStagingCount(count)
    } catch (error) {
      console.error('ไม่สามารถนับข้อสอบ Draft ใน Staging ได้:', error)
    }
  }

  const handleOpenAIGenerator = () => {
    setShowToolsMenu(false)
    try {
      if (!getGeminiApiKey()) {
        setShowAIKeyRequired(true)
        return
      }
      setShowAIGeneratorModal(true)
    } catch (error) {
      showModal('warning', 'ไม่สามารถตรวจสอบ API Key ได้', error.message)
    }
  }

  const handleOpenAIAuditor = (initialTab = 'scan') => {
    setShowToolsMenu(false)
    if (initialTab === 'scan') {
      try {
        if (!getGeminiApiKey()) {
          setShowAIKeyRequired(true)
          return
        }
      } catch (error) {
        showModal('warning', 'ไม่สามารถตรวจสอบ API Key ได้', error.message)
        return
      }
    }
    setAuditorInitialTab(initialTab)
    setShowAIAuditorModal(true)
  }

  const handleOpenAIExtractor = (initialTab = 'extract') => {
    setShowToolsMenu(false)
    if (userRole !== 'admin') {
      return showModal(
        'warning',
        'เฉพาะผู้ดูแลระบบ (Admin)',
        'ฟีเจอร์สกัดข้อสอบเข้าตาราง Staging จำกัดสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) ตามนโยบายความปลอดภัย RLS ครับ'
      )
    }
    if (initialTab === 'extract') {
      try {
        if (!getGeminiApiKey()) {
          setShowAIKeyRequired(true)
          return
        }
      } catch (error) {
        showModal('warning', 'ไม่สามารถตรวจสอบ API Key ได้', error.message)
        return
      }
    }
    setExtractorInitialTab(initialTab)
    setShowAIExtractorModal(true)
  }

  const handleConfirmClearCategoryDrafts = async () => {
    if (!selectedCat) return
    try {
      await clearCategoryStagingItems(selectedCat, { clearCheckpoints: true })
      setShowClearStagingConfirm(false)
      setStagingCount(0)
      showModal(
        'success',
        'ล้าง Draft ทั้งหมดสำเร็จ',
        'ลบข้อสอบ Draft ที่ค้างอยู่ในตาราง Staging และ Checkpoint ของหมวดหมู่นี้เรียบร้อยแล้ว'
      )
    } catch (error) {
      setShowClearStagingConfirm(false)
      showModal('danger', 'ล้าง Draft ไม่สำเร็จ', error.message)
    }
  }

  async function fetchQuestions(catId, page = currentPage, order = sortOrder, role = userRole, userId = currentUserId) {
    if (!catId) return
    setLoading(true)
    try {
      const { questions: data, totalCount: count } = await fetchCategoryQuestionsPage({
        categoryId: catId,
        page,
        sortOrder: order,
        role,
        userId
      })

      if (data.length === 0 && page > 1) {
        const prevPage = page - 1
        setCurrentPage(prevPage)
        return fetchQuestions(catId, prevPage, order, role, userId)
      }

      setQuestions(data)
      setTotalCount(count)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    async function initUserAndCategories() {
      const sessionInfo = await getQuestionManagerSession()
      if (sessionInfo) {
        setCurrentUserId(sessionInfo.userId)
        setUserRole(sessionInfo.role)
        try {
          const validCats = await refetchCategories({
            createdBy: sessionInfo.role === 'admin' ? null : sessionInfo.userId
          })
          if (validCats.length > 0) {
            setSelectedCat(validCats[0].id)
            setCurrentPage(1)
            fetchQuestions(validCats[0].id, 1, 'asc', sessionInfo.role, sessionInfo.userId)
            refreshStagingCount(validCats[0].id, sessionInfo.role)
            refreshFlaggedCounts(validCats[0].id)
          } else {
            setQuestions([])
            setLoading(false)
          }
        } catch (error) {
          console.error('ไม่สามารถโหลดหมวดหมู่ได้:', error)
          setLoading(false)
        }
      }
    }
    initUserAndCategories()
  }, [refetchCategories])

  useEffect(() => {
    if (highlightedNum !== null && questions.length > 0) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`question-card-${highlightedNum}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => setHighlightedNum(null), 3000)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [questions, highlightedNum])

  const handleCategoryChange = (newCatId) => {
    setSelectedCat(newCatId)
    setCurrentPage(1)
    setPageJumpInput('')
    setQuestionJumpInput('')
    setHighlightedNum(null)
    setEditingQuestion(null)
    setIsFormOpen(false)
    setSelectedIds([])
    fetchQuestions(newCatId, 1, sortOrder)
    refreshStagingCount(newCatId, userRole)
    refreshFlaggedCounts(newCatId)
  }

  const handleToggleSortOrder = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc'
    setSortOrder(newOrder)
    setCurrentPage(1)
    setSelectedIds([])
    fetchQuestions(selectedCat, 1, newOrder)
  }

  const handlePageChange = (newPage) => {
    const maxPage = Math.ceil(totalCount / QUESTIONS_PER_PAGE) || 1
    if (newPage < 1 || newPage > maxPage) return
    setCurrentPage(newPage)
    setSelectedIds([])
    fetchQuestions(selectedCat, newPage, sortOrder)
    window.scrollTo({ top: 200, behavior: 'smooth' })
  }

  const handlePageJumpSubmit = (e) => {
    e.preventDefault()
    const targetPage = parseInt(pageJumpInput, 10)
    const maxPage = Math.ceil(totalCount / QUESTIONS_PER_PAGE) || 1
    if (isNaN(targetPage) || targetPage < 1 || targetPage > maxPage) {
      return showModal('warning', 'เลขหน้าไม่ถูกต้อง', `กรุณาระบุเลขหน้าระหว่าง 1 ถึง ${maxPage}`)
    }
    handlePageChange(targetPage)
  }

  const handleQuestionJumpSubmit = (e) => {
    e.preventDefault()
    const targetNum = parseInt(questionJumpInput, 10)
    if (isNaN(targetNum) || targetNum < 1 || targetNum > totalCount) {
      return showModal('warning', 'เลขข้อไม่ถูกต้อง', `กรุณาระบุเลขข้อสอบระหว่าง 1 ถึง ${totalCount}`)
    }

    const targetPage =
      sortOrder === 'asc'
        ? Math.ceil(targetNum / QUESTIONS_PER_PAGE)
        : Math.ceil((totalCount - targetNum + 1) / QUESTIONS_PER_PAGE)
    setHighlightedNum(targetNum)
    setQuestionJumpInput('')

    if (targetPage !== currentPage) {
      setCurrentPage(targetPage)
      fetchQuestions(selectedCat, targetPage, sortOrder)
    } else {
      const el = document.getElementById(`question-card-${targetNum}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => setHighlightedNum(null), 3000)
    }
  }

  const handleToggleQuestionStatus = async (q) => {
    try {
      await toggleQuestionActiveStatus(q.id, !q.is_active)
      setQuestions((prev) => prev.map((item) => (item.id === q.id ? { ...item, is_active: !item.is_active } : item)))
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', 'เปลี่ยนสถานะไม่สำเร็จ: ' + err.message)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteQuestionWithImages(deleteTarget)
      if (editingQuestion?.id === deleteTarget.id) {
        setEditingQuestion(null)
        setIsFormOpen(false)
      }
      setDeleteTarget(null)
      setSelectedIds((prev) => prev.filter((item) => item !== deleteTarget.id))
      showModal('success', 'ลบข้อสอบสำเร็จ', 'ลบข้อสอบและไฟล์รูปภาพประกอบออกจากระบบถาวรแล้ว')
      fetchQuestions(selectedCat, currentPage, sortOrder)
    } catch (err) {
      showModal('danger', 'ลบไม่สำเร็จ', err.message)
    }
  }

  const handleSelectItem = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const handleSelectAll = (isChecked, allCurrentPageIds) => {
    if (isChecked) {
      setSelectedIds((prev) => [...new Set([...prev, ...allCurrentPageIds])])
    } else {
      setSelectedIds([])
    }
  }

  const handleBulkStatus = async (targetStatus) => {
    if (selectedIds.length === 0) return
    try {
      await bulkUpdateQuestionStatus(selectedIds, targetStatus)
      const statusText = targetStatus ? 'เปิดใช้งาน' : 'ซ่อนฉบับร่าง'
      showModal('success', 'อัปเดตสำเร็จ', `ปรับสถานะข้อสอบจำนวน ${selectedIds.length} ข้อเป็น "${statusText}" เรียบร้อยแล้ว`)
      setSelectedIds([])
      fetchQuestions(selectedCat, currentPage, sortOrder)
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', 'ปรับสถานะกลุ่มไม่สำเร็จ: ' + err.message)
    }
  }

  const handleBulkMove = async (newCatId) => {
    if (selectedIds.length === 0 || !newCatId) return
    try {
      await bulkMoveQuestionCategory(selectedIds, newCatId)
      const targetCat = categories.find((c) => c.id === newCatId)
      showModal('success', 'ย้ายสำเร็จ', `ย้ายข้อสอบจำนวน ${selectedIds.length} ข้อไปยังวิชา "${targetCat?.name || ''}" เรียบร้อยแล้ว`)
      setSelectedIds([])
      fetchQuestions(selectedCat, currentPage, sortOrder)
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', 'ย้ายหมวดหมู่ไม่สำเร็จ: ' + err.message)
    }
  }

  const handleConfirmBulkDelete = async () => {
    if (selectedIds.length === 0) return
    try {
      await bulkDeleteQuestionsWithImages(selectedIds, questions)
      setShowBulkDeleteConfirm(false)
      showModal('success', 'ลบกลุ่มสำเร็จ', `ลบข้อสอบจำนวน ${selectedIds.length} ข้อพร้อมไฟล์รูปภาพประกอบออกจากระบบถาวรแล้ว`)
      setSelectedIds([])
      fetchQuestions(selectedCat, currentPage, sortOrder)
    } catch (err) {
      setShowBulkDeleteConfirm(false)
      showModal('danger', 'ลบไม่สำเร็จ', err.message)
    }
  }

  const handleOpenCreateForm = () => {
    if (!selectedCat) return showModal('warning', 'ยังไม่ได้เลือกวิชา', 'กรุณาเลือกหมวดหมู่วิชาก่อนสร้างโจทย์')
    setEditingQuestion(null)
    setIsFormOpen(true)
  }

  const handleOpenEditForm = (q) => {
    setEditingQuestion(q)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setEditingQuestion(null)
    setIsFormOpen(false)
  }

  const totalPages = Math.ceil(totalCount / QUESTIONS_PER_PAGE) || 1
  const startItemNumber = totalCount === 0 ? 0 : (currentPage - 1) * QUESTIONS_PER_PAGE + 1
  const endItemNumber = Math.min(currentPage * QUESTIONS_PER_PAGE, totalCount)

  const hasFlagged = flaggedCounts.categoryFlagged > 0 || flaggedCounts.totalFlagged > 0
  const hasDrafts = userRole === 'admin' && Boolean(selectedCat) && stagingCount > 0
  const alertBadgeCount = (flaggedCounts.categoryFlagged || flaggedCounts.totalFlagged) + (hasDrafts ? stagingCount : 0)

  return {
    navigate,
    categories,
    questions,
    selectedCat,
    loading,
    currentUserId,
    userRole,
    currentPage,
    setCurrentPage,
    totalCount,
    totalPages,
    startItemNumber,
    endItemNumber,
    sortOrder,
    pageJumpInput,
    setPageJumpInput,
    questionJumpInput,
    setQuestionJumpInput,
    highlightedNum,
    editingQuestion,
    deleteTarget,
    setDeleteTarget,
    showBulkModal,
    setShowBulkModal,
    showAIGeneratorModal,
    setShowAIGeneratorModal,
    showAIExtractorModal,
    setShowAIExtractorModal,
    extractorInitialTab,
    stagingCount,
    setStagingCount,
    showClearStagingConfirm,
    setShowClearStagingConfirm,
    showAIAuditorModal,
    setShowAIAuditorModal,
    auditorInitialTab,
    flaggedCounts,
    showAIKeyRequired,
    setShowAIKeyRequired,
    isFormOpen,
    showToolsMenu,
    setShowToolsMenu,
    toolsMenuRef,
    selectedIds,
    setSelectedIds,
    questionSearch,
    setQuestionSearch,
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    modalConfig,
    showModal,
    closeModal,
    hasFlagged,
    hasDrafts,
    alertBadgeCount,
    fetchQuestions,
    refreshStagingCount,
    refreshFlaggedCounts,
    handleGoToAISettings,
    handleOpenAIGenerator,
    handleOpenAIAuditor,
    handleOpenAIExtractor,
    handleConfirmClearCategoryDrafts,
    handleCategoryChange,
    handleToggleSortOrder,
    handlePageChange,
    handlePageJumpSubmit,
    handleQuestionJumpSubmit,
    handleToggleQuestionStatus,
    handleConfirmDelete,
    handleSelectItem,
    handleSelectAll,
    handleBulkStatus,
    handleBulkMove,
    handleConfirmBulkDelete,
    handleOpenCreateForm,
    handleOpenEditForm,
    handleCloseForm
  }
}
