import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../shared/lib/supabase'
import Navbar from '../shared/components/Navbar'
import { useModal } from '../shared/context/ModalContext'
import CategoryManagerPage from '../features/admin-categories/pages/CategoryManagerPage'
import QuestionManagerPage from '../features/admin-questions/pages/QuestionManagerPage'
import UserManagerPage from '../features/admin-users/pages/UserManagerPage'
import AISettingsPage from '../features/admin-ai/settings/pages/AISettingsPage'

export default function AdminLayout({ userRole }) {
  const location = useLocation()
  const activeTab = location.pathname.split('/')[2] || 'categories'
  const isFullAdmin = userRole === 'admin'
  const { showModal } = useModal()

  const handleTriggerLogout = () => {
    showModal({
      type: 'danger',
      title: 'ออกจากระบบใช่หรือไม่?',
      description: 'งานที่ยังไม่ได้บันทึกอาจสูญหาย ระบบจะพากลับไปยังหน้าเข้าสู่ระบบ',
      confirmText: 'ออกจากระบบ',
      cancelText: 'ยกเลิก',
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-24 overflow-x-hidden transition-colors">
      <Navbar onLogoutClick={handleTriggerLogout} />

      <div className="bg-white dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800/80 py-5 sm:py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {activeTab === 'categories' && 'จัดการหมวดหมู่วิชา'}
            {activeTab === 'questions' && 'จัดการคลังข้อสอบ'}
            {activeTab === 'users' && 'จัดการผู้ใช้งานและสิทธิ์'}
            {activeTab === 'ai-settings' && 'ตั้งค่า AI (Gemini)'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            {activeTab === 'categories' && (isFullAdmin ? 'เพิ่ม แก้ไข และจัดการสิทธิ์หมวดหมู่วิชาทั้งหมดในระบบ' : 'จัดการหมวดหมู่วิชาที่คุณดูแล')}
            {activeTab === 'questions' && 'จัดการโจทย์ นำเข้าข้อสอบ สกัดจากไฟล์ และตรวจทานเฉลย'}
            {activeTab === 'users' && 'ตรวจสอบรายชื่อและกำหนดบทบาทผู้ใช้งาน'}
            {activeTab === 'ai-settings' && 'ตั้งค่า Gemini API Key และโมเดลเริ่มต้นบนเบราว์เซอร์นี้'}
          </p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        {activeTab === 'categories' && <CategoryManagerPage />}
        {activeTab === 'questions' && <QuestionManagerPage />}
        {activeTab === 'users' && isFullAdmin && <UserManagerPage />}
        {activeTab === 'ai-settings' && <AISettingsPage />}
      </main>
    </div>
  )
}
