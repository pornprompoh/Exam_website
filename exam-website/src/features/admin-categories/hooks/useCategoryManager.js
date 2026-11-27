/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import {
  batchUpdateCategoryStatus,
  deleteCategoriesWithImages,
  fetchManagedCategories,
  getAdminUserSession,
  saveCategory,
  updateCategoryActiveStatus
} from '../services/categoryService'

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

  const sortedCategories = [...categories].sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime()
    const dateB = new Date(b.created_at || 0).getTime()
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
  })

  const totalPages = Math.ceil(sortedCategories.length / itemsPerPage) || 1
  const paginatedCategories = sortedCategories.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

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
      showModal('success', editingCat ? 'บันทึกสำเร็จ' : 'สร้างหมวดหมู่สำเร็จ', editingCat ? 'แก้ไขหมวดหมู่วิชาเรียบร้อยแล้ว' : 'เพิ่มหมวดหมู่วิชาใหม่ลงในระบบเรียบร้อยแล้ว')
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
      await updateCategoryActiveStatus(cat.id, !cat.is_active)
      setCategories((prev) => prev.map((item) => (item.id === cat.id ? { ...item, is_active: !item.is_active } : item)))
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', 'อัปเดตสถานะไม่สำเร็จ: ' + err.message)
    }
  }

  async function handleBatchToggleStatus(isActive) {
    try {
      await batchUpdateCategoryStatus(selectedItems, isActive)
      setCategories((prev) => prev.map((item) => (selectedItems.includes(item.id) ? { ...item, is_active: isActive } : item)))
      showModal('success', 'อัปเดตสำเร็จ', `ปรับสถานะเป็น "${isActive ? 'เปิดใช้งาน' : 'ซ่อนฉบับร่าง'}" จำนวน ${selectedItems.length} รายการเรียบร้อยแล้ว`)
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', err.message)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleteTarget.length === 0) return
    try {
      await deleteCategoriesWithImages(deleteTarget)
      setCategories((prev) => prev.filter((item) => !deleteTarget.includes(item.id)))
      setSelectedItems((prev) => prev.filter((id) => !deleteTarget.includes(id)))
      if (editingCat && deleteTarget.includes(editingCat.id)) handleCloseForm()

      const deletedCount = deleteTarget.length
      setDeleteTarget(null)
      showModal('success', 'ลบหมวดหมู่สำเร็จ', `ลบหมวดหมู่วิชาจำนวน ${deletedCount} หมวด ข้อสอบ และไฟล์รูปภาพทั้งหมดภายในออกเรียบร้อยแล้ว`)

      if (paginatedCategories.length === deletedCount && currentPage > 1) {
        setCurrentPage((prev) => prev - 1)
      }
    } catch (err) {
      showModal('danger', 'ลบไม่สำเร็จ', err.message)
    }
  }

  return {
    categories,
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
    currentPage,
    setCurrentPage,
    totalPages,
    sortOrder,
    toggleSortOrder,
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
