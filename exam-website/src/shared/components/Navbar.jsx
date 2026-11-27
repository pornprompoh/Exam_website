import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'

const userLinks = [
  { path: '/', label: 'คลังข้อสอบ', mobileLabel: 'คลังข้อสอบ (หน้าแรก)', icon: '📝' },
  { path: '/analytics', label: 'สถิติการสอบ', mobileLabel: 'สถิติและความคืบหน้าการสอบ', icon: '📊' },
  { path: '/mistake-bank', label: 'คลังข้อผิดพลาด', mobileLabel: 'คลังข้อผิดพลาดและสมุดทบทวน', icon: '💡' }
]

const adminLinks = [
  { path: '/admin/categories', label: 'จัดการหมวดหมู่', icon: '📁' },
  { path: '/admin/questions', label: 'จัดการข้อสอบ', icon: '📝' },
  { path: '/admin/ai-settings', label: 'ตั้งค่า AI', icon: '⚙️' },
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
  const visibleAdminLinks = adminLinks.filter((link) => !link.adminOnly || isFullAdmin)
  const links = isAdminArea ? visibleAdminLinks : userLinks
  const isActive = (path) =>
    location.pathname === path || (path === '/mistake-bank' && location.pathname === '/mistakes')

  const getDisplayName = () =>
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || (isAdminArea ? 'ผู้ดูแลระบบ' : 'ผู้เข้าใช้งาน')

  const roleInfo =
    role === 'admin'
      ? { text: 'Admin', style: 'bg-amber-500 text-slate-950 font-black' }
      : role === 'creator'
        ? { text: 'Creator', style: 'bg-indigo-600 text-white font-bold' }
        : { text: 'Student', style: 'bg-slate-200 text-slate-700 font-bold' }

  const themeToggle = (
    <button
      type="button"
      onClick={toggleTheme}
      className="w-full px-3 py-2 text-left rounded-xl text-xs font-semibold transition-colors flex items-center justify-between gap-2 cursor-pointer text-slate-700 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      aria-label={isDark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
    >
      <span className="flex items-center gap-2">
        <span className="text-sm">{isDark ? '☀️' : '🌙'}</span>
        <span>{isDark ? 'โหมดสว่าง' : 'โหมดมืด'}</span>
      </span>
      <span className="text-[11px] text-slate-400">{isDark ? 'Light' : 'Dark'}</span>
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
    if (mobile) {
      return `block px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
        isActive(path)
          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 font-bold'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`
    }
    return `px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
      isActive(path)
        ? 'bg-white text-indigo-700 shadow-2xs dark:bg-slate-800 dark:text-white font-bold'
        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
    }`
  }

  return (
    <nav key={location.pathname} className="fixed top-0 left-0 right-0 z-50 w-full backdrop-blur-md border-b transition-colors bg-white/92 dark:bg-slate-900/92 border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {customLeftContent || (
          <Link to={isAdminArea ? '/admin/categories' : '/'} className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-indigo-600 text-white font-bold">
              {isAdminArea ? (isFullAdmin ? '⚡' : '✏️') : '💡'}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-extrabold tracking-tight leading-none text-slate-900 dark:text-white">
                EXAM<span className="text-indigo-600 dark:text-indigo-400">BANK</span>
              </span>
              {isAdminArea && (
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  {isFullAdmin ? 'Admin Console' : 'Creator Studio'}
                </span>
              )}
            </div>
          </Link>
        )}

        {showNavPills && (
          <div className="hidden md:flex items-center p-1 rounded-xl border bg-slate-100/90 border-slate-200/80 dark:bg-slate-950/80 dark:border-slate-800">
            {links.map((link) => (
              <Link key={link.path} to={link.path} className={linkClass(link.path)}>
                <span>{link.label}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          {!customRightContent && (
            <>
              {isAdminArea && (
                <Link to="/" className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5">
                  <span>หน้าผู้สอบ</span>
                </Link>
              )}
              {!isAdminArea && (role === 'creator' || role === 'admin') && (
                <Link to="/admin/categories" className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5">
                  <span>ระบบหลังบ้าน</span>
                </Link>
              )}
            </>
          )}
          {customRightContent || (!loading && user && (
            <div className="relative">
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
                <span className="w-6 h-6 rounded-lg font-bold flex items-center justify-center text-xs uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">{getDisplayName().charAt(0)}</span>
                <span className="max-w-[100px] truncate">{getDisplayName()}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md uppercase ${roleInfo.style}`}>{roleInfo.text}</span>
                <span className="text-[10px] text-slate-400">▾</span>
              </button>
              {isProfileOpen && (
                <>
                  <div onClick={() => setIsProfileOpen(false)} className="fixed inset-0 z-40" />
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border shadow-lg p-1.5 z-50 animate-fadeIn space-y-0.5 bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="text-xs font-bold truncate text-slate-900 dark:text-white">{getDisplayName()}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">{user.email}</div>
                    </div>
                    <Link to="/profile" onClick={() => setIsProfileOpen(false)} className="w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 text-slate-700 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
                      <span>ตั้งค่าบัญชี / รหัสผ่าน</span>
                    </Link>
                    {themeToggle}
                    <button onClick={() => { setIsProfileOpen(false); handleSignOut() }} className="w-full px-3 py-2 text-left rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2 cursor-pointer">
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex md:hidden items-center gap-2">
          {isAdminArea && <Link to="/" className="px-2.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold">หน้าผู้สอบ</Link>}
          {!customRightContent && <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="w-9 h-9 rounded-xl transition-colors cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-center" aria-label="Toggle Menu"><span className="text-sm font-bold leading-none">{isMobileMenuOpen ? '✕' : '☰'}</span></button>}
        </div>
      </div>

      {customBottomContent}

      {isMobileMenuOpen && showNavPills && (
        <div className="md:hidden backdrop-blur-md border-b px-4 pt-2 pb-5 space-y-3 animate-fadeIn bg-white/95 border-slate-200 dark:bg-slate-900/95 dark:border-slate-800">
          <div className="space-y-1">
            {links.map((link) => (
              <Link key={link.path} to={link.path} onClick={() => setIsMobileMenuOpen(false)} className={linkClass(link.path, true)}>
                {link.mobileLabel || link.label}
              </Link>
            ))}
          </div>
          {user && (
            <div className="pt-3 border-t space-y-1.5 border-slate-200 dark:border-slate-800">
              <div className="px-3 py-1 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate text-slate-900 dark:text-white">{getDisplayName()}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">{user.email}</div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-md uppercase ${roleInfo.style}`}>{roleInfo.text}</span>
              </div>
              <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)} className="block w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">ตั้งค่าบัญชี / รหัสผ่าน</Link>
              <button type="button" onClick={toggleTheme} className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><span>{isDark ? '☀️ โหมดสว่าง' : '🌙 โหมดมืด'}</span><span className="text-[11px] text-slate-400">{isDark ? 'Light' : 'Dark'}</span></button>
              <button onClick={() => { setIsMobileMenuOpen(false); handleSignOut() }} className="w-full px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold border border-red-200 dark:border-red-500/20 flex items-center justify-center cursor-pointer">ออกจากระบบ</button>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
