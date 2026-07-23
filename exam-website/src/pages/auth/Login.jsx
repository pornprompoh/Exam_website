import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false) // สลับไประหว่าง เข้าสู่ระบบ / สมัครสมาชิก
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleAuth(e) {
    e.preventDefault()
    if (!email || !password) return alert('กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน')

    setLoading(true)
    try {
      if (isSignUp) {
        // สมัครสมาชิกใหม่
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('🎉 สมัครสมาชิกสำเร็จ! ระบบได้เข้าสู่ระบบให้คุณเรียบร้อยแล้ว')
      } else {
        // เข้าสู่ระบบ
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
      navigate('/') // เข้าสู่ระบบสำเร็จ ดีดไปหน้าแรก
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-lg border border-slate-200 p-8">
        
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl font-bold mx-auto mb-3 shadow-inner">
            ⚡
          </div>
          <h1 className="text-2xl font-black text-slate-800">
            {isSignUp ? 'สร้างบัญชีผู้ใช้ใหม่' : 'ยินดีต้อนรับกลับมา'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isSignUp ? 'สมัครสมาชิกเพื่อเริ่มทำข้อสอบและเก็บคลังข้อผิด' : 'เข้าสู่ระบบเพื่อเข้าสู่คลังข้อสอบออนไลน์'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">อีเมล (Email)</label>
            <input
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">รหัสผ่าน (Password)</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm transition-colors shadow-md cursor-pointer mt-2"
          >
            {loading ? '⏳ กำลังประมวลผล...' : (isSignUp ? '✨ สมัครสมาชิก' : '🚀 เข้าสู่ระบบ')}
          </button>
        </form>

        <div className="mt-6 text-center text-xs">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-indigo-600 font-semibold hover:underline cursor-pointer"
          >
            {isSignUp ? 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบที่นี่' : 'ยังไม่มีบัญชี? สมัครสมาชิกใหม่'}
          </button>
        </div>

      </div>
    </div>
  )
}