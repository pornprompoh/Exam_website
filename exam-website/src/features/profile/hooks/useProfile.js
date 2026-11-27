import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchCurrentUserProfile,
  updateAccountPassword,
  updateProfileDisplayName
} from '../services/profileService'

export default function useProfile() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('student')
  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPass, setSavingPass] = useState(false)

  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    description: ''
  })

  const showModal = useCallback((type, title, description) => {
    setModalConfig({ isOpen: true, type, title, description })
  }, [])

  const closeModal = useCallback(() => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }))
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const profile = await fetchCurrentUserProfile()
        if (!active) return
        if (!profile) {
          navigate('/login')
          return
        }
        setEmail(profile.email)
        setRole(profile.role)
        setDisplayName(profile.displayName)
      } catch (err) {
        if (active) showModal('danger', 'เกิดข้อผิดพลาด', 'ไม่สามารถดึงข้อมูลโปรไฟล์ได้: ' + err.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [navigate, showModal])

  const handleUpdateName = async (e) => {
    e.preventDefault()
    if (!displayName.trim()) {
      return showModal('warning', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อแสดงผลที่ต้องการใช้งานครับ')
    }

    setSavingName(true)
    try {
      await updateProfileDisplayName(displayName)
      showModal('success', 'บันทึกสำเร็จ!', 'อัปเดตชื่อแสดงผลของคุณเรียบร้อยแล้วครับ')
    } catch (err) {
      showModal('danger', 'บันทึกไม่สำเร็จ', 'เกิดข้อผิดพลาดในการบันทึกชื่อ: ' + err.message)
    } finally {
      setSavingName(false)
    }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (!newPassword || !confirmPassword) {
      return showModal('warning', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกรหัสผ่านใหม่ให้ครบทั้ง 2 ช่องครับ')
    }
    if (newPassword !== confirmPassword) {
      return showModal('warning', 'รหัสผ่านไม่ตรงกัน', 'รหัสผ่านใหม่ทั้ง 2 ช่องไม่ตรงกัน กรุณาตรวจสอบอีกครั้งครับ')
    }
    if (newPassword.length < 6) {
      return showModal('warning', 'รหัสผ่านสั้นเกินไป', 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษรขึ้นไปครับ')
    }

    setSavingPass(true)
    try {
      await updateAccountPassword(newPassword)
      showModal('success', '🎉 เปลี่ยนรหัสผ่านสำเร็จ!', 'ระบบได้อัปเดตรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาใช้รหัสผ่านใหม่ในครั้งถัดไปที่เข้าสู่ระบบครับ')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      showModal('danger', 'เปลี่ยนรหัสผ่านไม่สำเร็จ', err.message)
    } finally {
      setSavingPass(false)
    }
  }

  return {
    loading,
    email,
    role,
    displayName,
    setDisplayName,
    savingName,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    savingPass,
    modalConfig,
    closeModal,
    handleUpdateName,
    handleUpdatePassword
  }
}
