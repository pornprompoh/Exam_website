import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AdminNavbar({ activeTab, setActiveTab, userRole, onLogoutClick }) {
  const [user, setUser] = useState(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const isFullAdmin = userRole === 'admin'

  useEffect(() => {
    async function initUser() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) setUser(session.user)
    }
    initUser()
  }, [])

  const getDisplayName = () => {
    if (!user) return isFullAdmin ? 'ผู้ดูแลระบบ' : 'ผู้ช่วยสร้าง'
    return user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'
  }

  const roleBadge = isFullAdmin 
    ? { text: 'Admin', style: 'bg-amber-500 text-slate-950 font-black shadow-amber-500/20 shadow-xs' }
    : { text: 'Creator', style: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold' }

  return (
    <nav className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* 1. โลโก้และชื่อศูนย์ควบคุม */}
        <div className="flex items-center gap-3 shrink-0 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg font-black shadow-md shrink-0 ${
            isFullAdmin ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/20' : 'bg-gradient-to-br from-teal-500 to-emerald-600 shadow-teal-500/20'
          }`}>
            {isFullAdmin ? '⚡' : '✏️'}
          </div>
          <div className="min-w-0">
            <span className="font-black text-base sm:text-lg tracking-tight text-white block truncate leading-none">
              EXAM<span className={isFullAdmin ? 'text-indigo-400' : 'text-teal-400'}>BANK</span>
            </span>
            <span className="block text-[9px] font-extrabold text-slate-400 tracking-wider uppercase mt-0.5 truncate">
              {isFullAdmin ? 'Admin Control Panel' : 'Creator Workspace'}
            </span>
          </div>
        </div>

        {/* 🌟 2. Segmented Tabs (เมนูรางเดียว สำหรับจอคอม) */}
        <div className="hidden md:flex items-center bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-1.5 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'categories' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-black' : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <span>📁</span><span>จัดการหมวดหมู่</span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-1.5 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'questions' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-black' : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <span>📝</span><span>จัดการข้อสอบ</span>
          </button>

          {isFullAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-1.5 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-black' : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <span>👥</span><span>จัดการผู้ใช้</span>
            </button>
          )}
        </div>

        {/* 🌟 3. โซนขวามือ: ปุ่มหน้าเว็บนักเรียน + Profile Dropdown */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <Link
            to="/"
            className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
            title="สลับไปหน้าเว็บสำหรับผู้เข้าสอบ"
          >
            <span>🏠</span><span>หน้าเว็บนักเรียน</span>
          </Link>

          {/* Profile Dropdown (ซ่อนปุ่มแดงออกจากระบบ) */}
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-2xl text-xs font-bold text-slate-200 transition-all cursor-pointer shadow-xs"
            >
              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-black flex items-center justify-center text-xs uppercase font-mono">
                {getDisplayName().charAt(0)}
              </span>
              <span className="max-w-[100px] truncate">{getDisplayName()}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md uppercase font-mono ${roleBadge.style}`}>
                {roleBadge.text}
              </span>
              <span className="text-[10px] text-slate-400">▾</span>
            </button>

            {isProfileOpen && (
              <>
                <div onClick={() => setIsProfileOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl p-2 z-50 animate-fadeIn space-y-1">
                  <div className="px-3 py-2 border-b border-slate-800/80">
                    <div className="text-xs font-bold text-white truncate">{getDisplayName()}</div>
                    <div className="text-[11px] text-slate-400 truncate font-mono">{user?.email || 'Admin Workspace'}</div>
                  </div>
                  
                  <Link
                    to="/profile"
                    onClick={() => setIsProfileOpen(false)}
                    className="w-full px-3 py-2 text-left rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-all flex items-center gap-2"
                  >
                    <span>⚙️</span><span>ตั้งค่าบัญชี / รหัสผ่าน</span>
                  </Link>

                  <button
                    onClick={() => {
                      setIsProfileOpen(false)
                      onLogoutClick()
                    }}
                    className="w-full px-3 py-2 text-left rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>→</span><span>ออกจากระบบ</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 4. ปุ่ม Hamburger สำหรับมือถือ */}
        <div className="flex md:hidden items-center gap-2">
          <Link
            to="/"
            className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-bold"
            title="หน้าเว็บนักเรียน"
          >
            🏠
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <span className="text-base font-bold leading-none">{isMobileMenuOpen ? '✕' : '☰'}</span>
          </button>
        </div>

      </div>

      {/* 5. Mobile Slide-down Menu (มือถือ) */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 pt-2 pb-6 space-y-3 animate-fadeIn">
          <div className="space-y-1">
            <button
              onClick={() => { setActiveTab('categories'); setIsMobileMenuOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                activeTab === 'categories' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-black' : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              📁 จัดการหมวดหมู่ (Category Manager)
            </button>
            <button
              onClick={() => { setActiveTab('questions'); setIsMobileMenuOpen(false); }}
              className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                activeTab === 'questions' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-black' : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              📝 จัดการข้อสอบ (Question Manager)
            </button>
            {isFullAdmin && (
              <button
                onClick={() => { setActiveTab('users'); setIsMobileMenuOpen(false); }}
                className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                  activeTab === 'users' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-black' : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                👥 จัดการผู้ใช้ (User Manager)
              </button>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="px-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{getDisplayName()}</div>
                <div className="text-[10px] text-slate-400 font-mono truncate">{user?.email || 'Admin Workspace'}</div>
              </div>
              <span className={`text-[10px] px-2.5 py-1 rounded-lg uppercase font-mono ${roleBadge.style}`}>
                {roleBadge.text}
              </span>
            </div>

            <button
              onClick={() => { setIsMobileMenuOpen(false); onLogoutClick(); }}
              className="w-full px-4 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>→</span><span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}