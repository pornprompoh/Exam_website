import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import ConfirmModal from '../../components/common/ConfirmModal'

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // 🌟 State สำหรับ Modal แจ้งเตือนสไตล์ Modern Card (แทน alert เดิม)
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    description: '',
    onConfirmAction: null
  })

  const showModal = (type, title, description, onConfirmAction = null) => {
    setModalConfig({ isOpen: true, type, title, description, onConfirmAction })
  }

  const closeModal = () => {
    if (modalConfig.onConfirmAction) {
      modalConfig.onConfirmAction()
    }
    setModalConfig((prev) => ({ ...prev, isOpen: false }))
  }

  async function handleAuth(e) {
    e.preventDefault()
    if (!email || !password) {
      return showModal('warning', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วนก่อนเข้าสู่ระบบครับ')
    }

    setLoading(true)
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error

        // 🌟 เซฟตี้การ์ดฝั่งเว็บ: ตรวจสอบและสร้างโปรไฟล์เฉพาะคนสมัครใหม่ โดยไม่ทับสิทธิ์เดิม
        if (data.user) {
          const { data: existing } = await supabase.from('profiles').select('id').eq('id', data.user.id).single()
          if (!existing) {
            await supabase.from('profiles').insert([{
              id: data.user.id,
              email: email,
              role: 'student',
              display_name: email.split('@')[0]
            }])
          }
        }

        showModal('success', '🎉 สมัครสมาชิกสำเร็จ!', 'ระบบได้สร้างบัญชีและพาคุณเข้าสู่ระบบเรียบร้อยแล้วครับ', () => {
          navigate('/')
        })
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        
        // 🌟 ปลอดภัย 100%: ตอนล็อกอินระบบจะไม่ไปแตะต้องหรือเขียนทับตาราง profiles เด็ดขาด!
        navigate('/')
      }
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      
      {/* 🌟 เรียกใช้ ConfirmModal แทนหน้าต่างแจ้งเตือนสีดำของเบราว์เซอร์ */}
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        title={modalConfig.title}
        description={modalConfig.description}
        confirmText="✨ ตกลง / รับทราบ"
        cancelText=""
        onConfirm={closeModal}
        onClose={closeModal}
      />

      {/* ลายกราฟิกพื้นหลังสไตล์องค์กร */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-red-500/20">
            💡
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl sm:text-3xl font-black tracking-tight text-white">
          EXAM<span className="text-red-500">BANK</span> PORTAL
        </h2>
        <p className="mt-2 text-center text-xs sm:text-sm font-medium text-slate-400">
          {isSignUp ? 'สร้างบัญชีผู้ใช้ใหม่ของคุณ' : 'เข้าสู่ระบบเพื่อจัดการข้อสอบหรือเริ่มทำแบบทดสอบ'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-3xl sm:px-10 border border-slate-100">
          
          <form className="space-y-5" onSubmit={handleAuth}>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                อีเมล หรือ ชื่อผู้ใช้ (Email / Username)
              </label>
              <input
                type="text"
                required
                placeholder="ชื่อผู้ใช้หรืออีเมลของคุณ"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none block w-full px-4 py-3.5 border border-slate-200 rounded-2xl bg-slate-50 text-slate-900 text-sm font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                รหัสผ่าน (Password)
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none block w-full px-4 py-3.5 border border-slate-200 rounded-2xl bg-slate-50 text-slate-900 text-sm font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-2xl shadow-sm text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 transition-all cursor-pointer"
              >
                {loading ? '⏳ กำลังประมวลผล...' : (isSignUp ? '✨ สมัครสมาชิกใหม่' : '🚀 เข้าสู่ระบบทันที')}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs sm:text-sm font-bold text-indigo-600 hover:text-indigo-500 transition-colors cursor-pointer"
            >
              {isSignUp ? 'มีบัญชีอยู่แล้ว? คลิกเพื่อเข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สมัครสมาชิกใหม่ที่นี่'}
            </button>
          </div>

        </div>
        
        <p className="mt-6 text-center text-[11px] text-slate-500 font-mono">
          SECURE ASSESSMENT PLATFORM &bull; ENTERPRISE EDITION
        </p>
      </div>

    </div>
  )
}