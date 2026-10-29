import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context/ThemeContext'

const userLinks = [
  { path: '/', label: 'คลังข้อสอบ', mobileLabel: 'คลังข้อสอบ (หน้าแรก)', icon: '📝' },
  { path: '/analytics', label: 'สถิติการสอบ', mobileLabel: 'สถิติและความคืบหน้าการสอบ', icon: '📊' },
  { path: '/mistake-bank', label: 'คลังข้อผิดพลาด', mobileLabel: 'คลังข้อผิดพลาดและสมุดทบทวน', icon: '💡' }
]

const adminLinks = [
  { path: '/admin/categories', label: 'จัดการหมวดหมู่', icon: '📁' },
  { path: '/admin/questions', label: 'จัดการข้อสอบ', icon: '📝' },
  { path: '/admin/users', label: 'จัดการผู้ใช้', icon: '👥', adminOnly: true }
]

export default function Navbar({
  showNavPills = true,
  customLeftContent,
  customRightContent,
  customBottomContent,
  onLogoutClick
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isDark, toggleTheme } = useTheme()
  const isAdminArea = location.pathname.startsWith('/admin')
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('student')
  const [loading, setLoading] = useState(true)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    let active = true

    async function loadUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!active) return

        setUser(session?.user || null)
        if (session?.user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single()

          if (error && error.code !== 'PGRST116') throw error
          if (active) setRole(data?.role || 'student')
        } else {
          setRole('student')
        }
      } catch (error) {
        console.error('Error fetching user for navbar:', error)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadUser()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => loadUser())

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const isFullAdmin = role === 'admin'
  const visibleAdminLinks = adminLinks.filter(link => !link.adminOnly || isFullAdmin)
  const links = isAdminArea ? visibleAdminLinks : userLinks
  const isActive = (path) => location.pathname === path || (
    path === '/mistake-bank' && location.pathname === '/mistakes'
  )

  const getDisplayName = () => (
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || (isAdminArea ? 'ผู้ดูแลระบบ' : 'ผู้เข้าใช้งาน')
  )

  const roleInfo = role === 'admin'
    ? { text: 'Admin', style: 'bg-amber-500 text-slate-950 font-black' }
    : role === 'creator'
      ? { text: 'Creator', style: 'bg-indigo-600 text-white font-bold' }
      : { text: 'Student', style: 'bg-slate-200 text-slate-700 font-bold' }

  const themeToggle = (
    <button
      type="button"
      onClick={toggleTheme}
      className={`w-full px-3 py-2 text-left rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer ${isAdminArea ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-700 hover:bg-slate-50 hover:text-indigo-600'}`}
      aria-label={isDark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
    >
      <span className="flex items-center gap-2">
        <span className="text-base transition-transform duration-300">{isDark ? '☀️' : '🌙'}</span>
        <span>{isDark ? 'โหมดสว่าง' : 'โหมดมืด'}</span>
      </span>
      <span className="text-[10px] text-slate-400">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  )

  const handleSignOut = async () => {
    if (onLogoutClick) {
      onLogoutClick()
      return
    }

    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      navigate('/login')
    } catch (error) {
      alert('ออกจากระบบไม่สำเร็จ: ' + error.message)
    }
  }

  const linkClass = (path, mobile = false) => {
    if (isAdminArea) {
      return mobile
        ? `block px-4 py-3 rounded-2xl text-xs font-bold transition-all ${isActive(path) ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-black' : 'text-slate-300 hover:bg-slate-800/60'}`
        : `px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isActive(path) ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-black' : 'text-slate-400 hover:text-white hover:bg-slate-900/60'}`
    }
    return mobile
      ? `block px-4 py-3 rounded-2xl text-xs font-bold transition-all ${isActive(path) ? 'bg-indigo-50 text-indigo-600 font-black' : 'text-slate-600 hover:bg-slate-50'}`
      : `px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isActive(path) ? 'bg-white text-indigo-600 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}`
  }

  return (
    <nav key={location.pathname} className={`fixed top-0 left-0 right-0 z-50 w-full backdrop-blur-md border-b transition-all ${isAdminArea ? 'bg-slate-900/90 dark:bg-slate-900/90 border-slate-800 dark:border-slate-800' : 'bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {customLeftContent || (
          <Link to={isAdminArea ? '/admin/categories' : '/'} className="flex items-center gap-2.5 shrink-0 group">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-md ${isAdminArea ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/20' : 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-indigo-500/20'}`}>
              {isAdminArea ? (isFullAdmin ? '⚡' : '✏️') : '💡'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className={`text-base font-black tracking-tight leading-none ${isAdminArea ? 'text-white' : 'text-slate-900'}`}>
                EXAM<span className={isAdminArea ? (isFullAdmin ? 'text-indigo-400' : 'text-teal-400') : 'text-indigo-600'}>BANK</span>
              </span>
              {isAdminArea && <span className="text-[9px] font-extrabold text-slate-400 tracking-wider uppercase mt-0.5">{isFullAdmin ? 'Admin Control Panel' : 'Creator Workspace'}</span>}
            </div>
          </Link>
        )}

        {showNavPills && (
          <div className={`hidden md:flex items-center p-1.5 rounded-2xl border shadow-inner ${isAdminArea ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-100/80 border-slate-200/60'}`}>
            {links.map(link => (
              <Link key={link.path} to={link.path} className={linkClass(link.path)}>
                <span>{link.icon}</span><span>{link.label}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="hidden md:flex items-center gap-3 shrink-0">
          {!customRightContent && (
            <>
              {isAdminArea && (
                <Link to="/" className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                  <span>🏠</span><span>หน้าเว็บผู้สอบ</span>
                </Link>
              )}
              {!isAdminArea && (role === 'creator' || role === 'admin') && (
                <Link to="/admin/categories" className="px-4 py-2 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 border border-slate-700">
                  <span>⚙️</span><span>ระบบหลังบ้าน</span>
                </Link>
              )}
            </>
          )}
          {customRightContent || (!loading && user && (
            <div className="relative">
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${isAdminArea ? 'bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200' : 'bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700'}`}>
                <span className={`w-6 h-6 rounded-lg font-black flex items-center justify-center text-xs uppercase font-mono ${isAdminArea ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-indigo-500/10 text-indigo-600'}`}>{getDisplayName().charAt(0)}</span>
                <span className="max-w-[100px] truncate">{getDisplayName()}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md uppercase font-mono ${roleInfo.style}`}>{roleInfo.text}</span>
                <span className="text-[10px] text-slate-400">▾</span>
              </button>
              {isProfileOpen && (
                <>
                  <div onClick={() => setIsProfileOpen(false)} className="fixed inset-0 z-40" />
                  <div className={`absolute right-0 mt-2 w-56 rounded-2xl border shadow-xl p-2 z-50 animate-fadeIn space-y-1 ${isAdminArea ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'}`}>
                    <div className={`px-3 py-2 border-b ${isAdminArea ? 'border-slate-800/80' : 'border-slate-100'}`}>
                      <div className={`text-xs font-bold truncate ${isAdminArea ? 'text-white' : 'text-slate-900'}`}>{getDisplayName()}</div>
                      <div className="text-[11px] text-slate-400 truncate font-mono">{user.email}</div>
                    </div>
                    <Link to="/profile" onClick={() => setIsProfileOpen(false)} className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${isAdminArea ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-700 hover:bg-slate-50 hover:text-indigo-600'}`}>
                      <span>⚙️</span><span>ตั้งค่าบัญชี / รหัสผ่าน</span>
                    </Link>
                    {themeToggle}
                    <button onClick={() => { setIsProfileOpen(false); handleSignOut() }} className="w-full px-3 py-2 text-left rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-all flex items-center gap-2 cursor-pointer">
                      <span>→</span><span>ออกจากระบบ</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex md:hidden items-center gap-2">
          {isAdminArea && <Link to="/" className="p-2 bg-slate-950 text-slate-300 border border-slate-800 rounded-xl text-xs" title="หน้าเว็บผู้สอบ">🏠</Link>}
          {!customRightContent && <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className={`p-2 rounded-xl transition-all cursor-pointer ${isAdminArea ? 'bg-slate-950 text-slate-300 border border-slate-800' : 'bg-slate-100 text-slate-700'}`} aria-label="Toggle Menu"><span className="text-base font-bold leading-none">{isMobileMenuOpen ? '✕' : '☰'}</span></button>}
        </div>
      </div>

      {customBottomContent}

      {isMobileMenuOpen && showNavPills && (
        <div className={`md:hidden backdrop-blur-md border-b px-4 pt-2 pb-6 space-y-3 animate-fadeIn ${isAdminArea ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200/80'}`}>
          <div className="space-y-1">
            {links.map(link => (
              <Link key={link.path} to={link.path} onClick={() => setIsMobileMenuOpen(false)} className={linkClass(link.path, true)}>
                {link.icon} {link.mobileLabel || link.label}
              </Link>
            ))}
          </div>
          {user && (
            <div className={`pt-3 border-t space-y-2 ${isAdminArea ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="px-4 py-1 flex items-center justify-between">
                <div className="min-w-0"><div className={`text-xs font-bold truncate ${isAdminArea ? 'text-white' : 'text-slate-900'}`}>{getDisplayName()}</div><div className="text-[10px] text-slate-400 font-mono truncate">{user.email}</div></div>
                <span className={`text-[10px] px-2.5 py-1 rounded-lg uppercase font-mono ${roleInfo.style}`}>{roleInfo.text}</span>
              </div>
              <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)} className={`block w-full px-4 py-3 rounded-2xl text-xs font-bold transition-all ${isAdminArea ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-700'}`}>⚙️ ตั้งค่าบัญชี / รหัสผ่าน</Link>
              <button type="button" onClick={toggleTheme} className={`w-full px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between ${isAdminArea ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-700'}`}><span>{isDark ? '☀️ โหมดสว่าง' : '🌙 โหมดมืด'}</span><span className="text-[10px] text-slate-400">{isDark ? 'Light' : 'Dark'}</span></button>
              <button onClick={() => { setIsMobileMenuOpen(false); handleSignOut() }} className="w-full px-4 py-3 rounded-2xl bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer">→ ออกจากระบบ</button>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
