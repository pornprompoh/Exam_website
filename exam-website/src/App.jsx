import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
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

import Navbar from './components/common/Navbar'
import ConfirmModal from './components/common/ConfirmModal'

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
  // 🌟 ปรับให้ทั้ง Admin และ Creator เริ่มต้นที่หน้า "จัดการหมวดหมู่" เหมือนกันเลย
  const [activeTab, setActiveTab] = useState('categories')
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const isFullAdmin = userRole === 'admin'

  async function handleConfirmLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      
      <ConfirmModal
        isOpen={showLogoutModal}
        type="danger"
        title="ต้องการออกจากระบบศูนย์ควบคุมใช่หรือไม่?"
        description="การทำงานที่คุณยังไม่กดบันทึกอาจสูญหาย ระบบจะพาคุณกลับไปยังหน้าเข้าสู่ระบบครับ"
        confirmText="🚪 ออกจากระบบทันที"
        cancelText="← อยู่ในระบบต่อ"
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
      />

      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl font-black shadow-lg shrink-0 ${
              isFullAdmin ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/20' : 'bg-gradient-to-br from-teal-500 to-emerald-600 shadow-teal-500/20'
            }`}>
              {isFullAdmin ? '⚡' : '✏️'}
            </div>
            <div className="min-w-0">
              <span className="font-black text-lg sm:text-xl tracking-tight text-white block truncate">
                EXAM<span className={isFullAdmin ? 'text-indigo-400' : 'text-teal-400'}>BANK</span>
              </span>
              <span className="block text-[10px] font-bold text-slate-400 -mt-1 tracking-wider uppercase truncate">
                {isFullAdmin ? 'Admin Control Panel' : 'Creator Workspace'}
              </span>
            </div>
          </div>

          {/* 🌟 เปิดให้เห็นแท็บ "จัดการหมวดหมู่" ทั้ง Admin และ Creator */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-3.5 py-1.5 font-bold text-xs sm:text-sm rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'categories' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>📁</span><span>จัดการหมวดหมู่</span>
            </button>

            <button
              onClick={() => setActiveTab('questions')}
              className={`px-3.5 py-1.5 font-bold text-xs sm:text-sm rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'questions' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>📝</span><span>จัดการข้อสอบ</span>
            </button>

            {/* สงวนแท็บผู้ใช้งานไว้ให้เฉพาะ Admin สูงสุด */}
            {isFullAdmin && (
              <button
                onClick={() => setActiveTab('users')}
                className={`px-3.5 py-1.5 font-bold text-xs sm:text-sm rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span>👥</span><span>จัดการผู้ใช้</span>
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 text-xs font-semibold shrink-0">
            <Link
              to="/"
              className="px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-xl transition-all flex items-center gap-1.5"
            >
              <span>🏠</span>
              <span className="hidden sm:inline">หน้าเว็บนักเรียน</span>
            </Link>
            
            <Link
              to="/profile"
              className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-700 rounded-xl font-bold transition-all flex items-center justify-center"
              title="ตั้งค่าบัญชีและรหัสผ่าน"
            >
              ⚙️
            </Link>

            <button
              onClick={() => setShowLogoutModal(true)}
              className="px-3 sm:px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-bold transition-all cursor-pointer"
            >
              ออกจากระบบ
            </button>
          </div>

        </div>

        {/* เมนูด้านล่างสำหรับจอมือถือ */}
        <div className="md:hidden px-3 pb-3 pt-1 border-t border-slate-800/80 flex gap-1.5">
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              activeTab === 'categories' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-950 text-slate-400 border border-slate-800'
            }`}
          >
            <span>📁</span><span>หมวดหมู่</span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              activeTab === 'questions' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-950 text-slate-400 border border-slate-800'
            }`}
          >
            <span>📝</span><span>ข้อสอบ</span>
          </button>

          {isFullAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                activeTab === 'users' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-950 text-slate-400 border border-slate-800'
              }`}
            >
              <span>👥</span><span>ผู้ใช้</span>
            </button>
          )}
        </div>
      </header>

      {/* แบนเนอร์หัวเรื่องของแต่ละแท็บ */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 py-8 sm:py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold mb-3 border ${
            isFullAdmin ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-teal-500/10 border-teal-500/30 text-teal-400'
          }`}>
            <span>{isFullAdmin ? '⚡ SYSTEM ADMINISTRATION' : '✏️ CREATOR WORKSPACE'}</span>
          </div>
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
    </Router>
  )
}