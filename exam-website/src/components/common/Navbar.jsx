import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  
  const [user, setUser] = useState(null)
  const [role, setRole] = useState('student')
  const [loading, setLoading] = useState(true)
  
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    async function initUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUser(session.user)
          
          const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single()
            
          if (data?.role) setRole(data.role)
        }
      } catch (err) {
        console.error('Error fetching user for navbar:', err)
      } finally {
        setLoading(false)
      }
    }
    initUser()
  }, [])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      navigate('/login')
    } catch (err) {
      alert('ออกจากระบบไม่สำเร็จ: ' + err.message)
    }
  }

  useEffect(() => {
    setIsProfileOpen(false)
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  const isActive = (path) => location.pathname === path

  const getDisplayName = () => {
    if (!user) return 'ผู้เข้าใช้งาน'
    return user.user_metadata?.display_name || user.email?.split('@')[0] || 'Member'
  }

  const getRoleBadge = () => {
    if (role === 'admin') return { text: 'Admin', style: 'bg-amber-500 text-slate-950 font-black' }
    if (role === 'creator') return { text: 'Creator', style: 'bg-indigo-600 text-white font-bold' }
    return { text: 'Student', style: 'bg-slate-200 text-slate-700 font-bold' }
  }

  const roleInfo = getRoleBadge()

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center text-lg shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              💡
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black tracking-tight text-slate-900 leading-none">
                EXAM<span className="text-indigo-600">BANK</span>
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/60 shadow-2xs">
            <Link
              to="/"
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                isActive('/') 
                  ? 'bg-white text-indigo-600 shadow-xs font-black' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span>📝</span><span>คลังข้อสอบ</span>
            </Link>

            <Link
              to="/mistakes"
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                isActive('/mistakes') 
                  ? 'bg-white text-red-600 shadow-xs font-black' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span>💡</span><span>คลังข้อผิดพลาด</span>
            </Link>

            <Link
              to="/analytics"
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                isActive('/analytics') 
                  ? 'bg-white text-indigo-600 shadow-xs font-black' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span>📊</span><span>สถิติการสอบ</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-3 shrink-0">
            
            {(role === 'creator' || role === 'admin') && (
              <Link
                to="/admin"
                className="px-4 py-2 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 border border-slate-700"
                title="จัดการข้อสอบและระบบหลังบ้าน"
              >
                <span>⚙️</span><span>ระบบหลังบ้าน</span>
              </Link>
            )}

            {!loading && user && (
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 pl-2 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-700 transition-all shadow-2xs cursor-pointer"
                >
                  <span className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 font-black flex items-center justify-center text-xs uppercase font-mono">
                    {getDisplayName().charAt(0)}
                  </span>
                  <span className="max-w-[100px] truncate">{getDisplayName()}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md uppercase font-mono ${roleInfo.style}`}>
                    {roleInfo.text}
                  </span>
                  <span className="text-[10px] text-slate-400">▾</span>
                </button>

                {isProfileOpen && (
                  <>
                    <div 
                      onClick={() => setIsProfileOpen(false)} 
                      className="fixed inset-0 z-40 cursor-default"
                    />

                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200/80 shadow-xl p-2 z-50 animate-fadeIn space-y-1">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <div className="text-xs font-bold text-slate-900 truncate">{getDisplayName()}</div>
                        <div className="text-[11px] text-slate-400 truncate font-mono">{user.email}</div>
                      </div>

                      {/* 🌟 เพิ่มปุ่มตั้งค่าบัญชีตรงนี้ สำหรับจอคอมพิวเตอร์ */}
                      <Link
                        to="/profile"
                        onClick={() => setIsProfileOpen(false)}
                        className="w-full px-3 py-2 text-left rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-all flex items-center gap-2"
                      >
                        <span>⚙️</span><span>ตั้งค่าบัญชี / รหัสผ่าน</span>
                      </Link>

                      <button
                        onClick={handleSignOut}
                        className="w-full px-3 py-2 text-left rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <span>→</span><span>ออกจากระบบ</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex md:hidden items-center gap-2">
            {(role === 'creator' || role === 'admin') && (
              <Link
                to="/admin"
                className="p-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs"
                title="หลังบ้าน"
              >
                ⚙️
              </Link>
            )}

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
              aria-label="Toggle Menu"
            >
              <span className="text-base font-bold leading-none">{isMobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>

        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 pt-2 pb-6 space-y-3 animate-fadeIn">
            <div className="space-y-1">
              <Link
                to="/"
                className={`block px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                  isActive('/') ? 'bg-indigo-50 text-indigo-600 font-black' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                📝 คลังข้อสอบ (หน้าแรก)
              </Link>
              <Link
                to="/mistakes"
                className={`block px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                  isActive('/mistakes') ? 'bg-red-50 text-red-600 font-black' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                💡 คลังข้อผิดพลาดและสมุดทบทวน
              </Link>
              <Link
                to="/analytics"
                className={`block px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                  isActive('/analytics') ? 'bg-indigo-50 text-indigo-600 font-black' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                📊 สถิติและความคืบหน้าการสอบ
              </Link>
            </div>

            {user && (
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="px-4 py-1 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">{getDisplayName()}</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">{user.email}</div>
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-lg uppercase font-mono ${roleInfo.style}`}>
                    {roleInfo.text}
                  </span>
                </div>

                {/* 🌟 เพิ่มปุ่มตั้งค่าบัญชีตรงนี้ สำหรับหน้าจอมือถือ */}
                <Link
                  to="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full px-4 py-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-2"
                >
                  <span>⚙️</span><span>ตั้งค่าบัญชี / รหัสผ่าน</span>
                </Link>

                <button
                  onClick={handleSignOut}
                  className="w-full px-4 py-3 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>→</span><span>ออกจากระบบ</span>
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </>
  )
}