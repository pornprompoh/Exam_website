import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom'
import { supabase } from './lib/supabase'

import Login from './pages/auth/Login'
import Home from './pages/user/Home'
import ExamSession from './pages/user/ExamSession'
import MistakeBank from './pages/user/MistakeBank'
import Analytics from './pages/user/Analytics' // <-- เพิ่ม Import หน้าสถิติใหม่ตรงนี้
import CategoryManager from './pages/admin/CategoryManager'
import QuestionManager from './pages/admin/QuestionManager'

import Navbar from './components/common/Navbar'
import ConfirmModal from './components/common/ConfirmModal'

function ProtectedAdminRoute({ children }) {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function checkRole() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setIsAdmin(false)
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()
      
      setIsAdmin(data?.role === 'admin')
      setLoading(false)
    }
    checkRole()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-bold text-sm">กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ...</p>
      </div>
    )
  }

  return isAdmin ? children : <Navigate to="/" replace />
}

function AdminLayout() {
  const [activeTab, setActiveTab] = useState('categories')
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  async function handleConfirmLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      
      <ConfirmModal
        isOpen={showLogoutModal}
        type="danger"
        title="ต้องการออกจากศูนย์ควบคุมแอดมินใช่หรือไม่?"
        description="การทำงานที่คุณยังไม่กดบันทึกอาจสูญหาย ระบบจะพาคุณกลับไปยังหน้าเข้าสู่ระบบครับ"
        confirmText="🚪 ออกจากระบบทันที"
        cancelText="← อยู่ในระบบต่อ"
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
      />

      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-indigo-500/20 shrink-0">
              ⚡
            </div>
            <div className="min-w-0">
              <span className="font-black text-lg sm:text-xl tracking-tight text-white block truncate">
                EXAM<span className="text-indigo-400">BANK</span>
              </span>
              <span className="block text-[10px] font-bold text-indigo-300 -mt-1 tracking-wider uppercase truncate">
                Admin Control Panel
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-4 py-1.5 font-bold text-xs sm:text-sm rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'categories' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>📁</span><span>จัดการหมวดหมู่</span>
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              className={`px-4 py-1.5 font-bold text-xs sm:text-sm rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'questions' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>📝</span><span>จัดการข้อสอบ</span>
            </button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 text-xs font-semibold shrink-0">
            <Link
              to="/"
              className="px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold rounded-xl transition-all flex items-center gap-1.5"
            >
              <span>🏠</span>
              <span className="hidden sm:inline">หน้าเว็บนักเรียน</span>
            </Link>
            <button
              onClick={() => setShowLogoutModal(true)}
              className="px-3 sm:px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-bold transition-all cursor-pointer"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>

        <div className="md:hidden px-4 pb-3 pt-1 border-t border-slate-800/80 flex gap-2">
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'categories' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-950 text-slate-400 border border-slate-800'
            }`}
          >
            <span>📁</span><span>จัดการหมวดหมู่</span>
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'questions' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-950 text-slate-400 border border-slate-800'
            }`}
          >
            <span>📝</span><span>จัดการข้อสอบ</span>
          </button>
        </div>
      </header>

      <div className="bg-slate-900/60 border-b border-slate-800/80 py-8 sm:py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-3 py-1 rounded-full text-xs font-mono font-bold mb-3">
            <span>⚡</span><span>SYSTEM ADMINISTRATION</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {activeTab === 'categories' ? 'ศูนย์จัดการหมวดหมู่วิชา (Category Manager)' : 'ศูนย์จัดการคลังข้อสอบ (Question Manager)'}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            {activeTab === 'categories' 
              ? 'เพิ่ม ลบ หรือแก้ไขชื่อหมวดหมู่วิชาสอบทั้งหมดในระบบ' 
              : 'สร้างโจทย์คำถามใหม่ เพิ่มรูปประกอบ และจัดการเฉลยข้อสอบอย่างละเอียด'}
          </p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
        {activeTab === 'categories' ? <CategoryManager /> : <QuestionManager />}
      </main>

    </div>
  )
}

// Router หลักของแอปพลิเคชัน (เพิ่ม Route /analytics เรียบร้อยแล้ว)
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />
        <Route path="/exam/:categoryId" element={<ExamSession />} />
        <Route path="/mistakes" element={<MistakeBank />} />
        <Route path="/analytics" element={<Analytics />} /> {/* <-- เพิ่มเส้นทางหน้าสถิติตรงนี้ */}
        <Route 
          path="/admin" 
          element={
            <ProtectedAdminRoute>
              <AdminLayout />
            </ProtectedAdminRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}