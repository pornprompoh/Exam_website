import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  
  // 🌟 ระบบสลับ Tab: 'login', 'register', 'forgot'
  const [activeTab, setActiveTab] = useState('login') 
  
  // States สำหรับฟอร์ม
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  
  // States สำหรับสถานะการทำงาน
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) navigate('/')
    }
    checkUser()
  }, [navigate])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setErrorMsg('')
    setSuccessMsg('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    
    // ตรวจสอบความถูกต้องเบื้องต้น
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
        // 🌟 โหมดลืมรหัสผ่าน (ส่งลิงก์รีเซ็ตไปที่อีเมล)
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          // กำหนดให้กดลิงก์จากอีเมลแล้วเด้งกลับมาที่หน้าโปรไฟล์เพื่อตั้งรหัสใหม่
          redirectTo: `${window.location.origin}/profile`, 
        })
        if (error) {
          throw new Error('ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้ กรุณาตรวจสอบอีเมลอีกครั้ง')
        }
        
        setSuccessMsg('📧 ระบบได้ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว กรุณาตรวจสอบกล่องจดหมายครับ')
        setEmail('')
        
      } else if (activeTab === 'register') {
        // 🌟 โหมดสมัครสมาชิกใหม่
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        
        setSuccessMsg('🎉 สมัครสมาชิกสำเร็จ! ระบบได้ส่งลิงก์ยืนยันไปที่อีเมลของคุณแล้ว กรุณากดลิงก์เพื่อยืนยันตัวตน')
        setEmail('')
        setPassword('')
        setConfirmPassword('')
        setActiveTab('login') 
        
      } else {
        // 🌟 โหมดเข้าสู่ระบบ
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      
      {/* Background Decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[30rem] h-[30rem] bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30rem] h-[30rem] bg-violet-500/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[420px] bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-slate-300/50 border border-white p-6 sm:p-10 relative z-10 animate-fadeIn">
        
        {/* Header Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/30 mx-auto mb-4 hover:scale-105 transition-transform cursor-default">
            {activeTab === 'forgot' ? '🔐' : '💡'}
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
            {activeTab === 'forgot' ? 'กู้คืนรหัสผ่าน' : (
              <>EXAM<span className="text-indigo-600">BANK</span></>
            )}
          </h1>
          <p className="text-xs sm:text-sm font-bold text-slate-500">
            {activeTab === 'forgot' 
              ? 'กรอกอีเมลของคุณเพื่อรับลิงก์ตั้งรหัสผ่านใหม่' 
              : 'แพลตฟอร์มคลังข้อสอบและแบบทดสอบออนไลน์'}
          </p>
        </div>

        {/* Tabs Control (ซ่อนเมื่ออยู่ในโหมดลืมรหัสผ่าน) */}
        {activeTab !== 'forgot' && (
          <div className="flex p-1 bg-slate-100 rounded-2xl mb-8 border border-slate-200/60 shadow-inner">
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

        {/* Alerts Notification */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-xs sm:text-sm font-bold text-red-600 flex items-start gap-2.5 animate-fadeIn">
            <span className="text-base leading-none mt-0.5">⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs sm:text-sm font-bold text-emerald-700 flex items-start gap-2.5 animate-fadeIn">
            <span className="text-base leading-none mt-0.5">✨</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Section */}
        <form onSubmit={handleAuth} className="space-y-4 sm:space-y-5 animate-slideUp">
          
          {/* Email Input (ใช้ในทุกโหมด) */}
          <div>
            <label className="block text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider mb-2 pl-1">
              อีเมล (Email)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 pointer-events-none">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path></svg>
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Password Inputs (ซ่อนเมื่ออยู่ในโหมดลืมรหัสผ่าน) */}
          {activeTab !== 'forgot' && (
            <>
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
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 pointer-events-none">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all shadow-sm tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a10.05 10.05 0 015.188-1.58c4.478 0 8.268 2.943 9.542 7a10.02 10.02 0 01-4.14 5.0m-3.29-3.29l-3.29 3.29"></path></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    )}
                  </button>
                </div>
                {activeTab === 'register' && <p className="text-[10px] text-slate-400 font-bold mt-2 pl-1">* ความยาวอย่างน้อย 6 ตัวอักษร</p>}
              </div>

              {activeTab === 'register' && (
                <div className="animate-slideUp">
                  <label className="block text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider mb-2 pl-1">
                    ยืนยันรหัสผ่าน (Confirm Password)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 pointer-events-none">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      required={activeTab === 'register'}
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-all shadow-sm tracking-widest"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-slate-900 hover:bg-indigo-600 text-white font-black rounded-2xl text-sm transition-all shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <span>กำลังดำเนินการ...</span>
              </>
            ) : activeTab === 'register' ? (
              <><span>✨</span><span>สมัครสมาชิกใหม่</span></>
            ) : activeTab === 'forgot' ? (
              <><span>✉️</span><span>ส่งลิงก์รีเซ็ตรหัสผ่าน</span></>
            ) : (
              <><span>🚀</span><span>เข้าสู่ระบบ</span></>
            )}
          </button>
        </form>

        {/* ปุ่มกลับไปหน้าเข้าสู่ระบบ (แสดงเฉพาะโหมดลืมรหัสผ่าน) */}
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