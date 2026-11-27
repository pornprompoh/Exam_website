import { useState, useEffect, useCallback } from 'react'
import { fetchAllUserProfiles, updateUserRole } from '../services/userService'

const ROLE_NAMES = {
  admin: 'แอดมินสูงสุด (Admin)',
  creator: 'ผู้ช่วยสร้างข้อสอบ (Creator)',
  student: 'นักเรียน (Student)'
}

export default function useUserManager() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [currentUserId, setCurrentUserId] = useState('')
  const [roleModalTarget, setRoleModalTarget] = useState(null)
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'info', title: '', desc: '' })

  const showAlert = useCallback((type, title, desc) => {
    setAlertModal({ isOpen: true, type, title, desc })
  }, [])

  const closeAlert = useCallback(() => {
    setAlertModal((prev) => ({ ...prev, isOpen: false }))
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const res = await fetchAllUserProfiles()
        if (!active) return
        setCurrentUserId(res.currentUserId)
        setUsers(res.users)
      } catch (err) {
        if (active) showAlert('danger', 'เกิดข้อผิดพลาด', 'ไม่สามารถดึงรายชื่อผู้ใช้งานได้: ' + err.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [showAlert])

  const handleRoleDropdownChange = (user, newRole) => {
    if (user.role === newRole) return
    if (user.id === currentUserId) {
      return showAlert('warning', 'ไม่สามารถเปลี่ยนสิทธิ์ตัวเองได้', 'ไม่สามารถลดหรือเปลี่ยนสิทธิ์ของบัญชีที่กำลังล็อกอินอยู่เพื่อป้องกันการสูญเสียสิทธิ์ผู้ดูแลระบบ')
    }
    setRoleModalTarget({ user, newRole })
  }

  async function handleConfirmRoleChange() {
    if (!roleModalTarget) return
    const { user, newRole } = roleModalTarget

    try {
      await updateUserRole(user.id, newRole)
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)))
      showAlert('success', 'เปลี่ยนสิทธิ์สำเร็จ', `อัปเดตสิทธิ์ของ "${user.display_name || 'ผู้ใช้'}" เป็น "${ROLE_NAMES[newRole]}" เรียบร้อยแล้ว`)
      setRoleModalTarget(null)
    } catch (err) {
      showAlert('danger', 'เปลี่ยนสิทธิ์ไม่สำเร็จ', err.message)
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      (u.display_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.id || '').toLowerCase().includes(q)
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  return {
    filteredUsers,
    loading,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    currentUserId,
    roleModalTarget,
    setRoleModalTarget,
    alertModal,
    closeAlert,
    handleRoleDropdownChange,
    handleConfirmRoleChange
  }
}
