import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import ConfirmModal from './ConfirmModal'

export default function Navbar({ 
  customLeftContent = null, 
  customRightContent = null,
  showNavPills = true,
  theme = 'student' // 'student' | 'admin'
}) {
  const [userRole, setUserRole] = useState('student')
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    async function checkUserRole() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
        if (data) setUserRole(data.role)
      }
    }
    checkUserRole()
  }, [])

  async function handleConfirmLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isHome = location.pathname === '/'
  const isMistakes = location.pathname === '/mistakes'
  const isAnalytics = location.pathname === '/analytics'
  const isAdmin = theme === 'admin'

  return (
    <>
      <ConfirmModal
        isOpen={showLogoutModal}
        type="danger"
        title="ต้องการออกจากระบบใช่หรือไม่?"
        description="เซสชันการใช้งานของคุณจะถูกยกเลิก และระบบจะพาคุณกลับไปยังหน้าเข้าสู่ระบบครับ"
        confirmText="🚪 ออกจากระบบทันที"
        cancelText="← อยู่ในระบบต่อ"
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
      />

      <header className={`border-b sticky top-0 z-30 transition-colors overflow-x-hidden ${
        isAdmin ? 'bg-slate-900 border-slate-800 text-white shadow-md' : 'bg-white border-slate-200/80 text-slate-800 shadow-xs'
      }`}>
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          
          {customLeftContent ? (
            <div className="flex-1 min-w-0 mr-2">
              {customLeftContent}
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white text-lg sm:text-xl font-black shadow-md shrink-0 ${
                isAdmin ? 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/20' : 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/20'
              }`}>
                {isAdmin ? '⚡' : '💡'}
              </div>
              <div className="min-w-0">
                <span className={`font-black text-lg sm:text-xl tracking-tight block truncate ${isAdmin ? 'text-white' : 'text-slate-900'}`}>
                  EXAM<span className={isAdmin ? 'text-amber-400' : 'text-red-600'}>BANK</span>
                </span>
                <span className={`block text-[9px] sm:text-[10px] font-bold -mt-1 tracking-wider uppercase truncate ${isAdmin ? 'text-amber-400/80' : 'text-slate-400'}`}>
                  {isAdmin ? 'Admin Panel' : 'Online Assessment'}
                </span>
              </div>
            </div>
          )}

          {/* เมนูตรงกลาง (เพิ่มแท็บ สถิติการสอบ) */}
          {showNavPills && !isAdmin && (
            <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shrink-0">
              <Link 
                to="/" 
                className={`px-3.5 py-1.5 font-bold text-xs sm:text-sm rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  isHome ? 'bg-white text-red-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>📝</span><span>คลังข้อสอบ</span>
              </Link>
              <Link 
                to="/mistakes" 
                className={`px-3.5 py-1.5 font-bold text-xs sm:text-sm rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  isMistakes ? 'bg-white text-red-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>📑</span><span>คลังข้อผิด</span>
              </Link>
              <Link 
                to="/analytics" 
                className={`px-3.5 py-1.5 font-bold text-xs sm:text-sm rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  isAnalytics ? 'bg-white text-red-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <span>📊</span><span>สถิติการสอบ</span>
              </Link>
            </nav>
          )}

          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-semibold shrink-0">
            {customRightContent ? customRightContent : (
              <>
                {!isAdmin && userRole === 'admin' && (
                  <Link
                    to="/admin"
                    className="px-2.5 sm:px-3.5 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1 shrink-0"
                  >
                    <span>⚡</span><span className="hidden sm:inline">แอดมิน</span>
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    to="/"
                    className="px-2.5 sm:px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1 shrink-0"
                  >
                    <span>🏠</span><span className="hidden sm:inline">หน้านักเรียน</span>
                  </Link>
                )}
                <div className={`flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3.5 py-1.5 rounded-xl border text-xs shrink-0 ${
                  isAdmin ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-100/80 border-slate-200/60 text-slate-600'
                }`}>
                  <span className="font-medium flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full inline-block shrink-0 animate-pulse ${isAdmin ? 'bg-amber-400' : 'bg-emerald-500'}`}></span>
                    <span className="hidden sm:inline">{isAdmin ? 'Admin' : 'ผู้เข้าสอบ'}</span>
                  </span>
                  <span className={isAdmin ? 'text-slate-600' : 'text-slate-300'}>|</span>
                  <button
                    onClick={() => setShowLogoutModal(true)}
                    className="text-red-500 hover:text-red-400 font-bold transition-colors cursor-pointer shrink-0"
                  >
                    ออก<span className="hidden sm:inline">จากระบบ</span>
                  </button>
                </div>
              </>
            )}
          </div>

        </div>

        {/* แถบเมนูสำหรับจอมือถือ (เพิ่มปุ่มสถิติการสอบ) */}
        {showNavPills && !isAdmin && (
          <div className="md:hidden px-2 pb-2.5 pt-1 border-t border-slate-100 bg-slate-50/50 flex gap-1">
            <Link
              to="/"
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                isHome ? 'bg-white text-red-600 shadow-2xs border border-slate-200/60' : 'text-slate-600 hover:bg-white/50'
              }`}
            >
              <span>📝</span><span>คลังข้อสอบ</span>
            </Link>
            <Link
              to="/mistakes"
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                isMistakes ? 'bg-white text-red-600 shadow-2xs border border-slate-200/60' : 'text-slate-600 hover:bg-white/50'
              }`}
            >
              <span>📑</span><span>คลังข้อผิด</span>
            </Link>
            <Link
              to="/analytics"
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                isAnalytics ? 'bg-white text-red-600 shadow-2xs border border-slate-200/60' : 'text-slate-600 hover:bg-white/50'
              }`}
            >
              <span>📊</span><span>สถิติ</span>
            </Link>
          </div>
        )}
      </header>
    </>
  )
}