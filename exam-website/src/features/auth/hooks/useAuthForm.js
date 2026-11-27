import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAuthSession,
  sendPasswordResetEmail,
  signInWithEmailPassword,
  signInWithGoogle,
  signUpWithEmailPassword,
  subscribeAuthStateChange,
  updateUserPassword
} from '../services/authService'

export default function useAuthForm() {
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState(() =>
    window.location.hash.includes('type=recovery') ? 'update-password' : 'login'
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    const unsubscribe = subscribeAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setActiveTab('update-password')
      } else if (event === 'SIGNED_IN' && activeTab !== 'update-password') {
        navigate('/')
      }
    })

    const checkUser = async () => {
      const session = await getAuthSession()
      if (session && activeTab !== 'update-password' && !window.location.hash.includes('type=recovery')) {
        navigate('/')
      }
    }
    checkUser()

    return unsubscribe
  }, [navigate, activeTab])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setErrorMsg('')
    setSuccessMsg('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleGoogleSignIn = async () => {
    setErrorMsg('')
    setSuccessMsg('')
    setLoading(true)

    try {
      await signInWithGoogle()
    } catch (err) {
      setErrorMsg(err.message || 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาลองใหม่อีกครั้ง')
      setLoading(false)
    }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (activeTab === 'update-password') {
      if (!password || password.length < 6) {
        return setErrorMsg('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร')
      }
      if (password !== confirmPassword) {
        return setErrorMsg('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน')
      }

      setLoading(true)
      try {
        await updateUserPassword(password)
        setSuccessMsg('🎉 เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่ของคุณ')
        setTimeout(() => {
          setActiveTab('login')
          setPassword('')
          setConfirmPassword('')
          setSuccessMsg('')
          window.location.hash = ''
          navigate('/login')
        }, 2500)
      } catch (err) {
        setErrorMsg(err.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง')
      } finally {
        setLoading(false)
      }
      return
    }

    if (!email) {
      return setErrorMsg('กรุณากรอกอีเมลของคุณ')
    }

    if (activeTab !== 'forgot' && !password) {
      return setErrorMsg('กรุณากรอกรหัสผ่านให้ครบถ้วน')
    }

    if (activeTab === 'register') {
      if (password.length < 6) {
        return setErrorMsg('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร')
      }
      if (password !== confirmPassword) {
        return setErrorMsg('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน')
      }
    }

    setLoading(true)
    try {
      if (activeTab === 'forgot') {
        await sendPasswordResetEmail(email)
        setSuccessMsg('📧 ระบบได้ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว กรุณาตรวจสอบกล่องจดหมายครับ')
        setEmail('')
      } else if (activeTab === 'register') {
        await signUpWithEmailPassword(email, password)
        setSuccessMsg('🎉 สมัครสมาชิกสำเร็จ! ระบบได้ส่งลิงก์ยืนยันไปที่อีเมลของคุณแล้ว กรุณากดลิงก์เพื่อยืนยันตัวตน')
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setActiveTab('login')
      } else {
        await signInWithEmailPassword(email, password)
        navigate('/')
      }
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  return {
    activeTab,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    loading,
    errorMsg,
    successMsg,
    handleTabChange,
    handleGoogleSignIn,
    handleAuth
  }
}
