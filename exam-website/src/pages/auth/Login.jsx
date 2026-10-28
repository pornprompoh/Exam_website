import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  
  const [activeTab, setActiveTab] = useState(() => (
    window.location.hash.includes('type=recovery') ? 'update-password' : 'login'
  ))
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    // 🌟 1. เช็คตั้งแต่ตอนโหลดหน้าเว็บเลยว่า มีการกดลิงก์รีเซ็ตมาหรือไม่ (ดูจาก Hash ใน URL)
    // 🌟 2. ดักฟังสถานะ Auth ทั่วไป
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setActiveTab('update-password')
      } else if (event === 'SIGNED_IN' && activeTab !== 'update-password') {
        navigate('/')
      }
    })

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session && activeTab !== 'update-password' && !window.location.hash.includes('type=recovery')) {
        navigate('/')
      }
    }
    checkUser()

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [navigate, activeTab])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setErrorMsg('')
    setSuccessMsg('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleGoogleSignIn = async () => {
    setErrorMsg('')
    setSuccessMsg('')
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })

      if (error) throw error
    } catch (err) {
      setErrorMsg(err.message || 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้ กรุณาลองใหม่อีกครั้ง')
      setLoading(false)
    }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    
    if (activeTab === 'update-password') {
      if (!password || password.length < 6) {
        return setErrorMsg('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร')
      }
      if (password !== confirmPassword) {
        return setErrorMsg('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน')
      }

      setLoading(true)
      try {
        const { error } = await supabase.auth.updateUser({ password: password })
        if (error) throw error

        setSuccessMsg('🎉 เปลี่ยนรหัสผ่านสำเร็จ! กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่ของคุณ')
        setTimeout(() => {
          setActiveTab('login')
          setPassword('')
          setConfirmPassword('')
          setSuccessMsg('')
          // ล้าง Hash ใน URL ทิ้ง
          window.location.hash = ''
          navigate('/login')
        }, 2500)
      } catch (err) {
        setErrorMsg(err.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง')
      } finally {
        setLoading(false)
      }
      return
    }

    if (!email) {
      return setErrorMsg('กรุณากรอกอีเมลของคุณ')
    }

    if (activeTab !== 'forgot' && !password) {
      return setErrorMsg('กรุณากรอกรหัสผ่านให้ครบถ้วน')
    }

    if (activeTab === 'register') {
      if (password.length < 6) {
        return setErrorMsg('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร')
      }
      if (password !== confirmPassword) {
        return setErrorMsg('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน')
      }
    }

    setLoading(true)

    try {
      if (activeTab === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`, 
        })
        if (error) throw error
        
        setSuccessMsg('📧 ระบบได้ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว กรุณาตรวจสอบกล่องจดหมายครับ')
        setEmail('')
        
      } else if (activeTab === 'register') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        
        setSuccessMsg('🎉 สมัครสมาชิกสำเร็จ! ระบบได้ส่งลิงก์ยืนยันไปที่อีเมลของคุณแล้ว กรุณากดลิงก์เพื่อยืนยันตัวตน')
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setActiveTab('login') 
        
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          if (error.message.includes('Email not confirmed')) {
             throw new Error('กรุณากดยืนยันตัวตนในอีเมลของคุณก่อนเข้าสู่ระบบครับ')
          }
          throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง')
        }
        navigate('/')
      }
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-dvh w-full bg-slate-100 flex items-center justify-center p-3 sm:p-5 selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      
      <div className="absolute top-[-10%] left-[-10%] w-[30rem] h-[30rem] bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30rem] h-[30rem] bg-violet-500/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[420px] max-h-full bg-white/90 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl shadow-slate-300/50 border border-white p-5 sm:p-8 relative z-10 animate-fadeIn">
        
        <div className="text-center mb-5 sm:mb-6">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl flex items-center justify-center text-2xl sm:text-3xl shadow-lg shadow-indigo-500/30 mx-auto mb-3 hover:scale-105 transition-transform cursor-default">
            {activeTab === 'forgot' ? '🔐' : activeTab === 'update-password' ? '🔑' : '💡'}
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-1">
            {activeTab === 'forgot' ? 'กู้คืนรหัสผ่าน' : activeTab === 'update-password' ? 'ตั้งรหัสผ่านใหม่' : (
              <>EXAM<span className="text-indigo-600">BANK</span></>
            )}
          </h1>
          <p className="text-[11px] sm:text-sm font-bold text-slate-500">
            {activeTab === 'forgot' 
              ? 'กรอกอีเมลของคุณเพื่อรับลิงก์ตั้งรหัสผ่านใหม่' 
              : activeTab === 'update-password'
              ? 'กรุณากำหนดรหัสผ่านใหม่ของคุณที่ปลอดภัยยิ่งขึ้น'
              : 'แพลตฟอร์มคลังข้อสอบและแบบทดสอบออนไลน์'}
          </p>
        </div>

        {activeTab !== 'forgot' && activeTab !== 'update-password' && (
          <div className="flex p-1 bg-slate-100 rounded-2xl mb-5 border border-slate-200/60 shadow-inner">
            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-black rounded-xl transition-all cursor-pointer ${
                activeTab === 'login' 
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              เข้าสู่ระบบ
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('register')}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-black rounded-xl transition-all cursor-pointer ${
                activeTab === 'register' 
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              สมัครสมาชิก
            </button>
          </div>
        )}

        {errorMsg && (
          <div           className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-xs sm:text-sm font-bold text-red-600 flex items-start gap-2.5 animate-fadeIn">
            <span className="text-base leading-none mt-0.5">⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs sm:text-sm font-bold text-emerald-700 flex items-start gap-2.5 animate-fadeIn">
            <span className="text-base leading-none mt-0.5">✨</span>
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-3 sm:space-y-4 animate-slideUp">
          
          {activeTab === 'update-password' ? (
            <>
              <div>
                <label className="block text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider mb-2 pl-1">
                  รหัสผ่านใหม่ (New Password)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm tracking-widest"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider mb-2 pl-1">
                  ยืนยันรหัสผ่านใหม่ (Confirm New Password)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm tracking-widest"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-2 pl-1">* ความยาวอย่างน้อย 6 ตัวอักษร</p>
              </div>
            </>
          ) : (
            <>
              {activeTab !== 'update-password' && (
                <div>
                  <label className="block text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider mb-2 pl-1">
                    อีเมล (Email)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@example.com"
                      className="w-full pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
                    />
                  </div>
                </div>
              )}

              {activeTab !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-2 pl-1 pr-1">
                    <label className="block text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">
                      รหัสผ่าน (Password)
                    </label>
                    {activeTab === 'login' && (
                      <button 
                        type="button" 
                        onClick={() => handleTabChange('forgot')}
                        className="text-[11px] sm:text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors cursor-pointer"
                      >
                        ลืมรหัสผ่าน?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm tracking-widest"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'register' && (
                <div>
                  <label className="block text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider mb-2 pl-1">
                    ยืนยันรหัสผ่าน (Confirm Password)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm tracking-widest"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-slate-900 hover:bg-indigo-600 text-white font-black rounded-2xl text-sm transition-all shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-3 cursor-pointer"
          >
            {loading ? (
              <span>กำลังดำเนินการ...</span>
            ) : activeTab === 'register' ? (
              <span>✨ สมัครสมาชิกใหม่</span>
            ) : activeTab === 'forgot' ? (
              <span>✉️ ส่งลิงก์รีเซ็ตรหัสผ่าน</span>
            ) : activeTab === 'update-password' ? (
              <span>🔑 บันท็กรหัสผ่านใหม่</span>
            ) : (
              <span>🚀 เข้าสู่ระบบ</span>
            )}
          </button>
        </form>

        {activeTab === 'login' && (
          <div className="mt-4 animate-fadeIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-bold text-slate-400">หรือ</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 font-black rounded-2xl text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 cursor-pointer"
            >
              {loading ? (
                <span>กำลังเชื่อมต่อกับ Google...</span>
              ) : (
                <>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
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
          <div className="mt-8 text-center animate-fadeIn">
            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className="text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
            >
              <span>←</span><span>กลับไปหน้าเข้าสู่ระบบ</span>
            </button>
          </div>
        )}

      </div>
    </div>
  )
}