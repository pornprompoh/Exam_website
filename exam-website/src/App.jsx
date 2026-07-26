import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
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

import AdminNavbar from './components/admin/AdminNavbar'
// 🌟 1. นำเข้า ModalProvider และ useModal
import { ModalProvider, useModal } from './context/ModalContext'

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
  const [activeTab, setActiveTab] = useState('categories')
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      
      {/* 🌟 สั่งเปิด Modal ผ่าน Global State เรียบร้อย ไร้โค้ดรกๆ ใน App.jsx */}
      <AdminNavbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userRole={userRole} 
        onLogoutClick={handleTriggerLogout} 
      />

      <div className="bg-slate-900/60 border-b border-slate-800/80 py-8 sm:py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {activeTab === 'categories' && 'ศูนย์จัดการหมวดหมู่วิชา (Category Manager)'}
            {activeTab === 'questions' && 'ศูนย์จัดการคลังข้อสอบ (Question Manager)'}
            {activeTab === 'users' && 'ศูนย์จัดการผู้ใช้งานและกำหนดสิทธิ์ (User Manager)'}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            {activeTab === 'categories' && (isFullAdmin ? 'เพิ่ม ลบ หรือแก้ไขชื่อหมวดหมู่วิชาสอบทั้งหมดในระบบ' : 'สร้างและจัดการชื่อหมวดหมู่วิชาสำหรับเก็บข้อสอบของคุณ')}
            {activeTab === 'questions' && 'สร้างโจทย์คำถามใหม่ เพิ่มรูปประกอบ และนำเข้าข้อสอบชุดใหญ่ด้วย AI'}
            {activeTab === 'users' && 'ดูรายชื่อผู้ใช้งานทั้งหมดในระบบ พร้อมกำหนดสิทธิ์แต่งตั้งผู้ช่วยสร้างข้อสอบหรือแอดมิน'}
          </p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        {activeTab === 'categories' && <CategoryManager />}
        {activeTab === 'questions' && <QuestionManager />}
        {activeTab === 'users' && isFullAdmin && <UserManager />}
      </main>

    </div>
  )
}

export default function App() {
  return (
    <Router>
      {/* 🌟 3. ครอบ Router ทั้งหมดด้วย ModalProvider เป็นอันเสร็จสมบูรณ์ */}
      <ModalProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Home />} />
          <Route path="/exam/:categoryId" element={<ExamSession />} />
          <Route path="/mistakes" element={<MistakeBank />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<ProtectedAdminRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ModalProvider>
    </Router>
  )
}