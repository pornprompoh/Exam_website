import { useState } from 'react'
import { useTheme } from '../../../shared/context/ThemeContext'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeOffIcon,
  KeyIcon,
  MoonIcon,
  ShieldCheckIcon,
  SunIcon
} from '../../../shared/components/AdminIcons'
import useAuthForm from '../hooks/useAuthForm'

function MailIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

function LockIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

function ArrowLeftIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  )
}

function BookMarkIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  )
}

export default function LoginPage() {
  const { isDark, toggleTheme } = useTheme()
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const {
    activeTab,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    loading,
    errorMsg,
    successMsg,
    handleTabChange,
    handleGoogleSignIn,
    handleAuth
  } = useAuthForm()

  const passwordInputType = showPassword || isPasswordVisible ? 'text' : 'password'

  const inputBaseClass =
    'w-full pl-10 pr-10 py-2.5 bg-zinc-50 dark:bg-[#1F1F1F] hover:bg-zinc-100/70 dark:hover:bg-[#272727] focus:bg-white dark:focus:bg-[#272727] border border-zinc-200 dark:border-[#313131] rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300 ease-premium'

  return (
    <div className="min-h-dvh w-full bg-[#f8f8f9] dark:bg-[#000000] text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-4 sm:p-6 relative transition-colors duration-300">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
        title={isDark ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
        className="fixed top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-xl bg-white dark:bg-[#181818] border border-zinc-200 dark:border-[#272727] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#272727] flex items-center justify-center transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
      >
        {isDark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
      </button>

      <div className="w-full max-w-[420px] bg-white dark:bg-[#181818] rounded-2xl border border-zinc-200 dark:border-[#272727] shadow-sm dark:shadow-none p-6 sm:p-8 animate-fadeIn">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center mx-auto mb-3.5">
            {activeTab === 'forgot' ? (
              <ShieldCheckIcon className="w-6 h-6" />
            ) : activeTab === 'update-password' ? (
              <KeyIcon className="w-6 h-6" />
            ) : (
              <BookMarkIcon className="w-6 h-6" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {activeTab === 'forgot' ? (
              'กู้คืนรหัสผ่าน'
            ) : activeTab === 'update-password' ? (
              'ตั้งรหัสผ่านใหม่'
            ) : (
              <>
                EXAM<span className="text-indigo-600 dark:text-indigo-400">BANK</span>
              </>
            )}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
            {activeTab === 'forgot'
              ? 'กรอกอีเมลของคุณเพื่อรับลิงก์ตั้งรหัสผ่านใหม่'
              : activeTab === 'update-password'
                ? 'กำหนดรหัสผ่านใหม่ที่ปลอดภัยสำหรับบัญชีของคุณ'
                : 'แพลตฟอร์มคลังข้อสอบและแบบทดสอบออนไลน์'}
          </p>
        </div>

        {activeTab !== 'forgot' && activeTab !== 'update-password' && (
          <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-[#1F1F1F] rounded-xl mb-6 border border-zinc-200 dark:border-[#272727]">
            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className={`py-2 text-sm font-semibold rounded-lg transition-all duration-300 ease-premium cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-white dark:bg-[#272727] text-zinc-900 dark:text-zinc-100 shadow-2xs border border-zinc-200/80 dark:border-[#313131]'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              เข้าสู่ระบบ
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('register')}
              className={`py-2 text-sm font-semibold rounded-lg transition-all duration-300 ease-premium cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-white dark:bg-[#272727] text-zinc-900 dark:text-zinc-100 shadow-2xs border border-zinc-200/80 dark:border-[#313131]'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              สมัครสมาชิก
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 rounded-xl text-sm font-medium text-rose-700 dark:text-rose-300 flex items-start gap-2.5 animate-fadeIn"
          >
            <AlertTriangleIcon className="w-4 h-4 mt-0.5 text-rose-600 dark:text-rose-400" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="mb-4 p-3.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 rounded-xl text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5 animate-fadeIn"
          >
            <CheckCircleIcon className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {activeTab === 'update-password' ? (
            <>
              <div>
                <label htmlFor="new-password" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  รหัสผ่านใหม่
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none">
                    <LockIcon className="w-4 h-4" />
                  </span>
                  <input
                    id="new-password"
                    type={passwordInputType}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่"
                    className={inputBaseClass}
                  />
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible((prev) => !prev)}
                    aria-label={isPasswordVisible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    {isPasswordVisible ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-new-password" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  ยืนยันรหัสผ่านใหม่
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none">
                    <LockIcon className="w-4 h-4" />
                  </span>
                  <input
                    id="confirm-new-password"
                    type={passwordInputType}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                    className={inputBaseClass}
                  />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">ความยาวอย่างน้อย 6 ตัวอักษร</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="auth-email" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  อีเมล
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none">
                    <MailIcon className="w-4 h-4" />
                  </span>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-[#1F1F1F] hover:bg-zinc-100/70 dark:hover:bg-[#272727] focus:bg-white dark:focus:bg-[#272727] border border-zinc-200 dark:border-[#313131] rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300 ease-premium"
                  />
                </div>
              </div>

              {activeTab !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="auth-password" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      รหัสผ่าน
                    </label>
                    {activeTab === 'login' && (
                      <button
                        type="button"
                        onClick={() => handleTabChange('forgot')}
                        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                      >
                        ลืมรหัสผ่าน?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none">
                      <LockIcon className="w-4 h-4" />
                    </span>
                    <input
                      id="auth-password"
                      type={passwordInputType}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่าน"
                      className={inputBaseClass}
                    />
                    <button
                      type="button"
                      onClick={() => setIsPasswordVisible((prev) => !prev)}
                      aria-label={isPasswordVisible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      {isPasswordVisible ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'register' && (
                <div>
                  <label htmlFor="auth-confirm-password" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    ยืนยันรหัสผ่าน
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none">
                      <LockIcon className="w-4 h-4" />
                    </span>
                    <input
                      id="auth-confirm-password"
                      type={passwordInputType}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านอีกครั้ง"
                      className={inputBaseClass}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-premium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            {loading
              ? 'กำลังดำเนินการ...'
              : activeTab === 'register'
                ? 'สมัครสมาชิก'
                : activeTab === 'forgot'
                  ? 'ส่งลิงก์รีเซ็ตรหัสผ่าน'
                  : activeTab === 'update-password'
                    ? 'บันทึกรหัสผ่านใหม่'
                    : 'เข้าสู่ระบบ'}
          </button>
        </form>

        {activeTab === 'login' && (
          <div className="mt-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-zinc-200 dark:bg-[#272727]" />
              <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">หรือ</span>
              <div className="h-px flex-1 bg-zinc-200 dark:bg-[#272727]" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 bg-white dark:bg-[#1F1F1F] border border-zinc-200 dark:border-[#313131] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-[#272727] active:scale-[0.98] font-semibold rounded-xl text-sm transition-all duration-300 ease-premium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 cursor-pointer"
            >
              {loading ? (
                <span>กำลังเชื่อมต่อกับ Google...</span>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M21.35 12.27c0-.73-.07-1.43-.21-2.1H12v3.98h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.27Z" />
                    <path fill="#34A853" d="M12 21.67c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.67Z" />
                    <path fill="#FBBC05" d="M6.54 13.75a5.85 5.85 0 0 1 0-3.5V7.72H3.3a9.74 9.74 0 0 0 0 8.56l3.24-2.53Z" />
                    <path fill="#EA4335" d="M12 6.22c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.3 14.63 2.33 12 2.33a9.74 9.74 0 0 0-8.7 5.39l3.24 2.53C7.31 7.94 9.46 6.22 12 6.22Z" />
                  </svg>
                  <span>เข้าสู่ระบบด้วย Google</span>
                </>
              )}
            </button>
          </div>
        )}

        {activeTab === 'forgot' && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span>กลับไปหน้าเข้าสู่ระบบ</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
