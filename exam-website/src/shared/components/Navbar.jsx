import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../context/ThemeContext'
import {
  BoltIcon,
  ChevronDownIcon,
  CloseIcon,
  LogOutIcon,
  MenuIcon,
  MoonIcon,
  SunIcon,
  UserIcon
} from './AdminIcons'

const userLinks = [
  { path: '/', label: 'คลังข้อสอบ', mobileLabel: 'คลังข้อสอบ' },
  { path: '/analytics', label: 'สถิติการสอบ', mobileLabel: 'สถิติการสอบ' },
  { path: '/mistake-bank', label: 'คลังข้อผิดพลาด', mobileLabel: 'คลังข้อผิดพลาด' }
]

const adminLinks = [
  { path: '/admin/categories', label: 'หมวดหมู่' },
  { path: '/admin/questions', label: 'คลังข้อสอบ' },
  { path: '/admin/ai-settings', label: 'ตั้งค่า AI' },
  { path: '/admin/users', label: 'ผู้ใช้งาน', adminOnly: true }
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
  const [signOutError, setSignOutError] = useState('')

  useEffect(() => {
    let active = true

    async function loadUser() {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession()
        if (!active) return

        setUser(session?.user || null)
        if (session?.user) {
          const { data, error } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()

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
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => loadUser())

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
    user?.user_metadata?.display_name || user?.email?.split('@')[0] || (isAdminArea ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน')

  const roleInfo =
    role === 'admin'
      ? {
          text: 'Admin',
          style: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 font-semibold'
        }
      : role === 'creator'
        ? {
            text: 'Creator',
            style: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300 font-semibold'
          }
        : {
            text: 'Student',
            style: 'bg-zinc-200 text-zinc-700 dark:bg-[#272727] dark:text-zinc-300 font-semibold'
          }

  const handleSignOut = async () => {
    setSignOutError('')
    if (onLogoutClick) {
      onLogoutClick()
      return
    }

    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      navigate('/login')
    } catch (error) {
      setSignOutError(`ออกจากระบบไม่สำเร็จ: ${error.message}`)
    }
  }

  const linkClass = (path, mobile = false) => {
    if (mobile) {
      return `block px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ease-premium ${
        isActive(path)
          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
          : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-[#272727]'
      }`
    }
    return `px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ease-premium flex items-center gap-1.5 ${
      isActive(path)
        ? 'bg-white text-zinc-900 shadow-xs dark:bg-[#272727] dark:text-zinc-100'
        : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
    }`
  }

  return (
    <nav
      key={location.pathname}
      className="fixed top-0 left-0 right-0 z-40 w-full backdrop-blur-md border-b transition-colors duration-300 ease-premium bg-white/90 dark:bg-[#181818]/90 border-zinc-200 dark:border-[#272727]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {customLeftContent || (
          <Link to={isAdminArea ? '/admin/categories' : '/'} className="flex items-center gap-2.5 shrink-0 group">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-600 text-white transition-transform duration-300 ease-premium group-active:scale-[0.96]">
              <BoltIcon className="w-4 h-4" />
            </span>
            <span className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight leading-none text-zinc-900 dark:text-zinc-100">
                Exam<span className="text-indigo-600 dark:text-indigo-400">Bank</span>
              </span>
              {isAdminArea && (
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 leading-none mt-1">
                  {isFullAdmin ? 'Admin' : 'Creator'}
                </span>
              )}
            </span>
          </Link>
        )}

        {showNavPills && (
          <div className="hidden md:flex items-center p-1 rounded-xl border bg-zinc-100 border-zinc-200 dark:bg-[#1F1F1F] dark:border-[#272727]">
            {links.map((link) => (
              <Link key={link.path} to={link.path} className={linkClass(link.path)}>
                <span>{link.label}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="hidden md:flex items-center gap-2 shrink-0">
          {!customRightContent && (
            <>
              {isAdminArea && (
                <Link
                  to="/"
                  className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-[#1F1F1F] dark:hover:bg-[#272727] dark:text-zinc-200 border border-zinc-200 dark:border-[#272727] rounded-xl text-sm font-semibold transition-all duration-300 ease-premium active:scale-[0.98]"
                >
                  หน้าผู้สอบ
                </Link>
              )}
              {!isAdminArea && (role === 'creator' || role === 'admin') && (
                <Link
                  to="/admin/categories"
                  className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all duration-300 ease-premium active:scale-[0.98]"
                >
                  ระบบหลังบ้าน
                </Link>
              )}
            </>
          )}

          {customRightContent ||
            (!loading && user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  aria-expanded={isProfileOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl text-sm font-semibold transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 dark:bg-[#1F1F1F] dark:hover:bg-[#272727] dark:border-[#272727] dark:text-zinc-200"
                >
                  <span className="w-6 h-6 rounded-lg font-semibold flex items-center justify-center text-xs uppercase bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                    {getDisplayName().charAt(0)}
                  </span>
                  <span className="max-w-28 truncate text-xs">{getDisplayName()}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-md ${roleInfo.style}`}>{roleInfo.text}</span>
                  <ChevronDownIcon
                    className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-300 ease-premium ${
                      isProfileOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isProfileOpen && (
                  <>
                    <div onClick={() => setIsProfileOpen(false)} className="fixed inset-0 z-40" />
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-60 rounded-2xl border shadow-xl p-1.5 z-50 animate-fadeIn space-y-0.5 bg-white border-zinc-200 dark:bg-[#181818] dark:border-[#272727]"
                    >
                      <div className="px-3 py-2 border-b border-zinc-100 dark:border-[#272727]">
                        <div className="text-sm font-semibold truncate text-zinc-900 dark:text-zinc-100">
                          {getDisplayName()}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate font-mono">{user.email}</div>
                      </div>

                      <Link
                        to="/profile"
                        role="menuitem"
                        onClick={() => setIsProfileOpen(false)}
                        className="w-full px-3 py-2 rounded-xl text-xs font-semibold transition-colors duration-300 flex items-center gap-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-[#272727]"
                      >
                        <UserIcon className="w-4 h-4 text-zinc-400" />
                        <span>ตั้งค่าบัญชีและรหัสผ่าน</span>
                      </Link>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={toggleTheme}
                        className="w-full px-3 py-2 text-left rounded-xl text-xs font-semibold transition-colors duration-300 flex items-center justify-between gap-2 cursor-pointer text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-[#272727]"
                        aria-label={isDark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
                      >
                        <span className="flex items-center gap-2">
                          {isDark ? (
                            <SunIcon className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <MoonIcon className="w-4 h-4 text-zinc-400" />
                          )}
                          <span>ธีมหน้าจอ</span>
                        </span>
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          {isDark ? 'มืด' : 'สว่าง'}
                        </span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsProfileOpen(false)
                          handleSignOut()
                        }}
                        className="w-full px-3 py-2 text-left rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors duration-300 flex items-center gap-2 cursor-pointer"
                      >
                        <LogOutIcon className="w-4 h-4" />
                        <span>ออกจากระบบ</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
        </div>

        <div className="flex md:hidden items-center gap-2">
          {isAdminArea && (
            <Link
              to="/"
              className="px-3 py-2 bg-zinc-100 dark:bg-[#1F1F1F] text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-[#272727] rounded-xl text-xs font-semibold"
            >
              หน้าผู้สอบ
            </Link>
          )}
          {!customRightContent && (
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-9 h-9 rounded-xl transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer bg-zinc-100 dark:bg-[#1F1F1F] text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-[#272727] flex items-center justify-center"
              aria-label="เปิดหรือปิดเมนู"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <CloseIcon className="w-4 h-4" /> : <MenuIcon className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {signOutError && (
        <div
          role="alert"
          className="px-4 py-2 text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border-t border-rose-200 dark:border-rose-500/25 text-center"
        >
          {signOutError}
        </div>
      )}

      {customBottomContent}

      {isMobileMenuOpen && showNavPills && (
        <div className="md:hidden backdrop-blur-md border-b px-4 pt-2 pb-6 space-y-3 animate-fadeIn bg-white/95 border-zinc-200 dark:bg-[#181818]/95 dark:border-[#272727]">
          <div className="space-y-1">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={linkClass(link.path, true)}
              >
                {link.mobileLabel || link.label}
              </Link>
            ))}
          </div>

          {user && (
            <div className="pt-3 border-t space-y-2 border-zinc-200 dark:border-[#272727]">
              <div className="px-3 py-1 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate text-zinc-900 dark:text-zinc-100">
                    {getDisplayName()}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">{user.email}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-md ${roleInfo.style}`}>{roleInfo.text}</span>
              </div>

              <Link
                to="/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-semibold bg-zinc-100 text-zinc-700 dark:bg-[#1F1F1F] dark:text-zinc-200"
              >
                <UserIcon className="w-4 h-4 text-zinc-400" />
                <span>ตั้งค่าบัญชีและรหัสผ่าน</span>
              </Link>

              <button
                type="button"
                onClick={toggleTheme}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between bg-zinc-100 text-zinc-700 dark:bg-[#1F1F1F] dark:text-zinc-200 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  {isDark ? <SunIcon className="w-4 h-4 text-zinc-400" /> : <MoonIcon className="w-4 h-4 text-zinc-400" />}
                  <span>ธีมหน้าจอ</span>
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{isDark ? 'มืด' : 'สว่าง'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false)
                  handleSignOut()
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-sm font-semibold border border-rose-200 dark:border-rose-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOutIcon className="w-4 h-4" />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
