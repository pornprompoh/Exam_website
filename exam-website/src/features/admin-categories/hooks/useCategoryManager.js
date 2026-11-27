/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo } from 'react'
import {
  batchUpdateCategoryStatus,
  deleteCategoriesWithImages,
  fetchManagedCategories,
  getAdminUserSession,
  saveCategory,
  updateCategoryActiveStatus
} from '../services/categoryService'

function matchesStatusFilter(category, filter) {
  if (filter === 'active') return Boolean(category.is_active)
  if (filter === 'inactive') return !category.is_active
  return true
}

export default function useCategoryManager() {
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

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [sortOrder, setSortOrder] = useState('asc')
  const [statusFilter, setStatusFilter] = useState('all')
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
    async function init() {
      const info = await getAdminUserSession()
      if (info) {
        setCurrentUserId(info.userId)
        setUserRole(info.role)
        fetchCategories(info.role, info.userId)
      }
    }
    init()
  }, [])

  async function fetchCategories(role = userRole, userId = currentUserId) {
    setLoading(true)
    try {
      const data = await fetchManagedCategories(role, userId)
      setCategories(data || [])
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', 'ดึงหมวดหมู่ไม่สำเร็จ: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const statusCounts = useMemo(() => {
    let active = 0
    let inactive = 0
    for (const cat of categories) {
      if (cat.is_active) active += 1
      else inactive += 1
    }
    return {
      all: categories.length,
      active,
      inactive
    }
  }, [categories])

  const filteredCategories = useMemo(() => {
    return categories
      .filter((cat) => matchesStatusFilter(cat, statusFilter))
      .sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      })
  }, [categories, statusFilter, sortOrder])

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / itemsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedCategories = filteredCategories.slice(
    (safeCurrentPage - 1) * itemsPerPage,
    safeCurrentPage * itemsPerPage
  )

  const handleStatusFilterChange = (nextFilter) => {
    if (nextFilter === statusFilter) return
    setStatusFilter(nextFilter)
    setCurrentPage(1)
    setSelectedItems([])
  }

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    setCurrentPage(1)
  }

  const handleSelectAllInPage = (e) => {
    const pageIds = paginatedCategories.map((c) => c.id)
    if (e.target.checked) {
      setSelectedItems([...new Set([...selectedItems, ...pageIds])])
    } else {
      setSelectedItems(selectedItems.filter((id) => !pageIds.includes(id)))
    }
  }

  const handleSelectItem = (id) => {
    setSelectedItems((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]))
  }

  const isAllCurrentPageSelected =
    paginatedCategories.length > 0 && paginatedCategories.every((c) => selectedItems.includes(c.id))
  const selectedCountInPage = paginatedCategories.filter((c) => selectedItems.includes(c.id)).length

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
    if (!name.trim()) return showModal('warning', 'ข้อมูลไม่ครบ', 'กรุณากรอกชื่อหมวดหมู่วิชา')

    setSaving(true)
    try {
      await saveCategory({ editingCat, name, description, currentUserId })
      showModal(
        'success',
        editingCat ? 'บันทึกสำเร็จ' : 'สร้างหมวดหมู่สำเร็จ',
        editingCat ? 'แก้ไขหมวดหมู่วิชาเรียบร้อยแล้ว' : 'เพิ่มหมวดหมู่วิชาใหม่ลงในระบบเรียบร้อยแล้ว'
      )
      handleCloseForm()
      fetchCategories()
    } catch (err) {
      showModal('danger', 'บันทึกไม่สำเร็จ', 'เกิดข้อผิดพลาดในการบันทึก: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(cat) {
    const nextIsActive = !cat.is_active
    try {
      await updateCategoryActiveStatus(cat.id, nextIsActive)
      const nextCategories = categories.map((item) =>
        item.id === cat.id ? { ...item, is_active: nextIsActive } : item
      )
      setCategories(nextCategories)

      const remainsVisible = matchesStatusFilter({ ...cat, is_active: nextIsActive }, statusFilter)
      if (!remainsVisible) {
        setSelectedItems((prev) => prev.filter((id) => id !== cat.id))
        const nextFilteredCount = nextCategories.filter((item) => matchesStatusFilter(item, statusFilter)).length
        const nextTotalPages = Math.max(1, Math.ceil(nextFilteredCount / itemsPerPage))
        if (safeCurrentPage > nextTotalPages) {
          setCurrentPage(nextTotalPages)
        }
      }
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', 'อัปเดตสถานะไม่สำเร็จ: ' + err.message)
    }
  }

  async function handleBatchToggleStatus(isActive) {
    if (selectedItems.length === 0) return
    try {
      await batchUpdateCategoryStatus(selectedItems, isActive)
      const updatedCount = selectedItems.length
      const nextCategories = categories.map((item) =>
        selectedItems.includes(item.id) ? { ...item, is_active: isActive } : item
      )
      setCategories(nextCategories)

      const willLeaveCurrentFilter =
        (statusFilter === 'active' && !isActive) || (statusFilter === 'inactive' && isActive)
      if (willLeaveCurrentFilter) {
        setSelectedItems([])
        const nextFilteredCount = nextCategories.filter((item) => matchesStatusFilter(item, statusFilter)).length
        const nextTotalPages = Math.max(1, Math.ceil(nextFilteredCount / itemsPerPage))
        if (safeCurrentPage > nextTotalPages) {
          setCurrentPage(nextTotalPages)
        }
      }

      showModal(
        'success',
        'อัปเดตสำเร็จ',
        `ปรับสถานะเป็น "${isActive ? 'เปิดใช้งาน' : 'ซ่อนฉบับร่าง'}" จำนวน ${updatedCount} รายการเรียบร้อยแล้ว`
      )
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', err.message)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleteTarget.length === 0) return
    try {
      await deleteCategoriesWithImages(deleteTarget)
      const nextCategories = categories.filter((item) => !deleteTarget.includes(item.id))
      setCategories(nextCategories)
      setSelectedItems((prev) => prev.filter((id) => !deleteTarget.includes(id)))
      if (editingCat && deleteTarget.includes(editingCat.id)) handleCloseForm()

      const deletedCount = deleteTarget.length
      setDeleteTarget(null)
      showModal(
        'success',
        'ลบหมวดหมู่สำเร็จ',
        `ลบหมวดหมู่วิชาจำนวน ${deletedCount} หมวด ข้อสอบ และไฟล์รูปภาพทั้งหมดภายในออกเรียบร้อยแล้ว`
      )

      const nextFilteredCount = nextCategories.filter((item) => matchesStatusFilter(item, statusFilter)).length
      const nextTotalPages = Math.max(1, Math.ceil(nextFilteredCount / itemsPerPage))
      if (safeCurrentPage > nextTotalPages) {
        setCurrentPage(nextTotalPages)
      }
    } catch (err) {
      showModal('danger', 'ลบไม่สำเร็จ', err.message)
    }
  }

  return {
    categories,
    filteredCategories,
    paginatedCategories,
    loading,
    name,
    setName,
    description,
    setDescription,
    saving,
    currentUserId,
    userRole,
    editingCat,
    isFormOpen,
    deleteTarget,
    setDeleteTarget,
    shareTargetCat,
    setShareTargetCat,
    currentPage: safeCurrentPage,
    setCurrentPage,
    totalPages,
    sortOrder,
    toggleSortOrder,
    statusFilter,
    statusCounts,
    handleStatusFilterChange,
    selectedItems,
    setSelectedItems,
    isAllCurrentPageSelected,
    selectedCountInPage,
    modalConfig,
    showModal,
    closeModal,
    fetchCategories,
    handleSelectAllInPage,
    handleSelectItem,
    handleOpenCreateForm,
    handleOpenEditForm,
    handleCloseForm,
    handleSubmit,
    handleToggleStatus,
    handleBatchToggleStatus,
    handleConfirmDelete
  }
}
