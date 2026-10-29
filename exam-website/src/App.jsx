import { useState, useEffect, useLayoutEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate, Link } from 'react-router-dom'
import { supabase } from './lib/supabase'

import Login from './pages/auth/Login'
import Home from './pages/user/Home'
import ExamSession from './pages/user/ExamSession'
import MistakeBank from './pages/user/MistakeBank'
import Analytics from './pages/user/Analytics'
import Profile from './pages/user/Profile'
import CategoryManager from './pages/admin/CategoryManager'
import QuestionManager from './pages/admin/QuestionManager'
import UserManager from './pages/admin/UserManager'
import AISettings from './pages/admin/AISettings'

import Navbar from './components/common/Navbar'
// 🌟 1. นำเข้า ModalProvider และ useModal
import { ModalProvider, useModal } from './context/ModalContext'
import { ThemeProvider } from './context/ThemeContext'

const SCROLL_STORAGE_KEY = 'app-scroll-positions'

function getSavedScrollPositions() {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL_STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function ScrollRestoration() {
  const { pathname } = useLocation()

  useLayoutEffect(() => {
    const savedPositions = getSavedScrollPositions()
    const savedPosition = Number(savedPositions[pathname] || 0)
    if (!savedPosition) return undefined

    const restoreScrollPosition = () => window.scrollTo(0, savedPosition)
    restoreScrollPosition()

    const observer = new ResizeObserver(restoreScrollPosition)
    observer.observe(document.body)
    const stopObserving = window.setTimeout(() => observer.disconnect(), 2000)

    return () => {
      window.clearTimeout(stopObserving)
      observer.disconnect()
    }
  }, [pathname])

  useEffect(() => {
    const saveScrollPosition = () => {
      const savedPositions = getSavedScrollPositions()
      savedPositions[pathname] = window.scrollY
      sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(savedPositions))
    }

    window.addEventListener('scroll', saveScrollPosition, { passive: true })
    return () => {
      saveScrollPosition()
      window.removeEventListener('scroll', saveScrollPosition)
    }
  }, [pathname])

  return null
}

function AppRoutes() {
  const { pathname } = useLocation()
  const hasNavbar = pathname !== '/login'
  const navigate = useNavigate()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionEnded = event === 'SIGNED_OUT' ||
        (event === 'TOKEN_REFRESHED' && !session) ||
        (event === 'INITIAL_SESSION' && !session)
      if (sessionEnded && pathname !== '/login') {
        navigate('/login', { replace: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate, pathname])

  return (
    <>
      <ScrollRestoration />
      <div className={hasNavbar ? 'pt-16' : ''}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Home />} />
          <Route path="/exam/:categoryId" element={<ExamSession />} />
          <Route path="/mistakes" element={<MistakeBank />} />
          <Route path="/mistake-bank" element={<MistakeBank />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin/*" element={<ProtectedAdminRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  )
}

function ProtectedAdminRoute() {
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('student')

  useEffect(() => {
    async function checkRole() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setUserRole('student')
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      
      setUserRole(data?.role || 'student')
      setLoading(false)
    }
    checkRole()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-bold text-sm">กำลังตรวจสอบสิทธิ์การเข้าใช้งานศูนย์ควบคุม...</p>
      </div>
    )
  }

  const canAccessAdmin = userRole === 'admin' || userRole === 'creator'
  return canAccessAdmin ? <AdminLayout userRole={userRole} /> : <Navigate to="/" replace />
}

function AdminLayout({ userRole }) {
  const location = useLocation()
  const activeTab = location.pathname.split('/')[2] || 'categories'
  const isFullAdmin = userRole === 'admin'
  
  // 🌟 2. เรียกใช้ useModal แทนการสร้าง useState บวมๆ ใน App.jsx
  const { showModal } = useModal()

  const handleTriggerLogout = () => {
    showModal({
      type: 'danger',
      theme: 'dark', // ธีมมืดเข้ากับหน้าแอดมินเป๊ะ
      title: 'ต้องการออกจากระบบศูนย์ควบคุมใช่หรือไม่?',
      description: 'การทำงานที่คุณยังไม่กดบันทึกอาจสูญหาย ระบบจะพาคุณกลับไปยังหน้าเข้าสู่ระบบครับ',
      confirmText: '🚪 ออกจากระบบทันที',
      cancelText: '← อยู่ในระบบต่อ',
      onConfirm: async () => {
        await supabase.auth.signOut()
        window.location.href = '/login'
      }
    })
  }

  if (location.pathname === '/admin' || !['categories', 'questions', 'users', 'ai-settings'].includes(activeTab)) {
    return <Navigate to="/admin/categories" replace />
  }

  if (activeTab === 'users' && !isFullAdmin) {
    return <Navigate to="/admin/categories" replace />
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      
      {/* 🌟 สั่งเปิด Modal ผ่าน Global State เรียบร้อย ไร้โค้ดรกๆ ใน App.jsx */}
      <Navbar onLogoutClick={handleTriggerLogout} />

      <div className="bg-slate-900/60 border-b border-slate-800/80 py-8 sm:py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {activeTab === 'categories' && 'ศูนย์จัดการหมวดหมู่วิชา (Category Manager)'}
            {activeTab === 'questions' && 'ศูนย์จัดการคลังข้อสอบ (Question Manager)'}
            {activeTab === 'users' && 'ศูนย์จัดการผู้ใช้งานและกำหนดสิทธิ์ (User Manager)'}
            {activeTab === 'ai-settings' && 'ตั้งค่า AI (Gemini API Key)'}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            {activeTab === 'categories' && (isFullAdmin ? 'เพิ่ม ลบ หรือแก้ไขชื่อหมวดหมู่วิชาสอบทั้งหมดในระบบ' : 'สร้างและจัดการชื่อหมวดหมู่วิชาสำหรับเก็บข้อสอบของคุณ')}
            {activeTab === 'questions' && 'สร้างโจทย์คำถามใหม่ เพิ่มรูปประกอบ และนำเข้าข้อสอบชุดใหญ่ด้วย AI'}
            {activeTab === 'users' && 'ดูรายชื่อผู้ใช้งานทั้งหมดในระบบ พร้อมกำหนดสิทธิ์แต่งตั้งผู้ช่วยสร้างข้อสอบหรือแอดมิน'}
            {activeTab === 'ai-settings' && 'จัดการ API Key ที่ใช้สร้างข้อสอบด้วย Gemini บนเบราว์เซอร์นี้'}
          </p>
        </div>
      </div>

      <nav aria-label="เมนูผู้ดูแล" className="mx-auto mt-5 flex max-w-7xl flex-wrap gap-2 px-4 sm:px-6">
        <Link
          to="/admin/categories"
          className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${
            activeTab === 'categories' ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          📁 หมวดหมู่วิชา
        </Link>
        <Link
          to="/admin/questions"
          className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${
            activeTab === 'questions' ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          📚 คลังข้อสอบ
        </Link>
        <Link
          to="/admin/ai-settings"
          className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${
            activeTab === 'ai-settings' ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          ⚙️ ตั้งค่า AI (API Key)
        </Link>
        {isFullAdmin && (
          <Link
            to="/admin/users"
            className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${
              activeTab === 'users' ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            👥 ผู้ใช้งาน
          </Link>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        {activeTab === 'categories' && <CategoryManager />}
        {activeTab === 'questions' && <QuestionManager />}
        {activeTab === 'users' && isFullAdmin && <UserManager />}
        {activeTab === 'ai-settings' && <AISettings />}
      </main>

    </div>
  )
}

export default function App() {
  return (
    <Router>
      {/* 🌟 3. ครอบ Router ทั้งหมดด้วย ModalProvider เป็นอันเสร็จสมบูรณ์ */}
      <ThemeProvider>
        <ModalProvider>
          <AppRoutes />
        </ModalProvider>
      </ThemeProvider>
    </Router>
  )
}