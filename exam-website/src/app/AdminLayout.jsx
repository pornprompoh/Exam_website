import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../shared/lib/supabase'
import Navbar from '../shared/components/Navbar'
import { useModal } from '../shared/context/ModalContext'
import CategoryManagerPage from '../features/admin-categories/pages/CategoryManagerPage'
import QuestionManagerPage from '../features/admin-questions/pages/QuestionManagerPage'
import UserManagerPage from '../features/admin-users/pages/UserManagerPage'
import AISettingsPage from '../features/admin-ai/settings/pages/AISettingsPage'

const TAB_TITLES = {
  categories: 'จัดการหมวดหมู่วิชา',
  questions: 'จัดการคลังข้อสอบ',
  users: 'จัดการผู้ใช้งานและสิทธิ์',
  'ai-settings': 'ตั้งค่า AI'
}

export default function AdminLayout({ userRole }) {
  const location = useLocation()
  const activeTab = location.pathname.split('/')[2] || 'categories'
  const isFullAdmin = userRole === 'admin'
  const { showModal } = useModal()

  const handleTriggerLogout = () => {
    showModal({
      type: 'danger',
      title: 'ออกจากระบบใช่หรือไม่',
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
    <div className="min-h-dvh bg-[#f8f8f9] dark:bg-[#000000] text-zinc-900 dark:text-zinc-100 pb-24 overflow-x-hidden transition-colors duration-300 ease-premium">
      <a
        href="#admin-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-90 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-indigo-600 focus:text-white focus:text-sm focus:font-semibold"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>

      <Navbar onLogoutClick={handleTriggerLogout} />

      <header className="bg-white dark:bg-[#181818] border-b border-zinc-200 dark:border-[#272727]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {TAB_TITLES[activeTab]}
          </h1>
        </div>
      </header>

      <main id="admin-main-content" className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        {activeTab === 'categories' && <CategoryManagerPage />}
        {activeTab === 'questions' && <QuestionManagerPage />}
        {activeTab === 'users' && isFullAdmin && <UserManagerPage />}
        {activeTab === 'ai-settings' && <AISettingsPage />}
      </main>
    </div>
  )
}
