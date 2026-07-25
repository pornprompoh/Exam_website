import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingScreen from '../../components/common/LoadingScreen'
import EmptyState from '../../components/common/EmptyState'
import ConfirmModal from '../../components/common/ConfirmModal'

export default function UserManager() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [currentUserId, setCurrentUserId] = useState('')

  // State สำหรับ Modal ยืนยันการเปลี่ยนสิทธิ์
  const [roleModalTarget, setRoleModalTarget] = useState(null) // เก็บ { user, newRole }
  
  // State สำหรับ Modal แจ้งเตือนทั่วไป
  const [alertModal, setAlertModal] = useState({ isOpen: false, type: 'info', title: '', desc: '' })

  const showAlert = (type, title, desc) => setAlertModal({ isOpen: true, type, title, desc })
  const closeAlert = () => setAlertModal(prev => ({ ...prev, isOpen: false }))

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setCurrentUserId(session.user.id)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      showAlert('danger', 'เกิดข้อผิดพลาด', 'ไม่สามารถดึงรายชื่อผู้ใช้งานได้: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // 1. เมื่อกดเลือก Dropdown จะยังไม่เปลี่ยนทันที แต่เปิด Modal ถามก่อน!
  const handleRoleDropdownChange = (user, newRole) => {
    if (user.role === newRole) return
    if (user.id === currentUserId) {
      return showAlert('warning', 'ไม่สามารถเปลี่ยนสิทธิ์ตัวเองได้', 'คุณไม่สามารถลดหรือเปลี่ยนสิทธิ์ของบัญชีที่คุณกำลังล็อกอินอยู่ได้ครับ เพื่อป้องกันการสูญเสียสิทธิ์ผู้ดูแลระบบสูงสุด')
    }
    setRoleModalTarget({ user, newRole })
  }

// 2. ฟังก์ชันกดยืนยันใน Modal เพื่อบันทึกสิทธิ์ลง Supabase
  async function handleConfirmRoleChange() {
    if (!roleModalTarget) return
    const { user, newRole } = roleModalTarget

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', user.id)
        .select() // 🌟 เพิ่ม .select() ตรงนี้! เพื่อเช็คว่ามีบรรทัดถูกอัปเดตจริงไหม

      if (error) throw error
      
      // 🌟 ถ้าไม่ได้แถวกลับมาเลย แปลว่าโดน RLS ของ Supabase บล็อกไว้!
      if (!data || data.length === 0) {
        throw new Error('ถูกบล็อกโดยระบบความปลอดภัย RLS ของ Supabase กรุณารันคำสั่ง SQL เพื่อเปิดสิทธิ์การอัปเดตตาราง profiles ครับ')
      }

      // อัปเดต State หน้าเว็บทันที
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u))
      
      const roleNames = {
        'admin': '⚡ แอดมินสูงสุด (Admin)',
        'creator': '✏️ ผู้ช่วยสร้างข้อสอบ (Creator)',
        'student': '🎓 นักเรียนทั่วไป (Student)'
      }
      
      showAlert('success', '✅ เปลี่ยนสิทธิ์สำเร็จ!', `อัปเดตสิทธิ์ของ "${user.display_name || 'ผู้ใช้'}" เป็น "${roleNames[newRole]}" เรียบร้อยแล้วครับ`)
      setRoleModalTarget(null)
    } catch (err) {
      showAlert('danger', 'เปลี่ยนสิทธิ์ไม่สำเร็จ', err.message)
    }
  }

  // กรองรายชื่อตามแถบค้นหาและตัวกรองสิทธิ์
  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.id || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const getRoleBadge = (role) => {
    switch(role) {
      case 'admin': return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs font-black shrink-0">⚡ แอดมิน</span>
      case 'creator': return <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2.5 py-0.5 rounded-full text-xs font-black shrink-0">✏️ ผู้ช่วยสร้างข้อสอบ</span>
      default: return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0">🎓 นักเรียน</span>
    }
  }

  return (
    <div className="space-y-6 text-slate-200 overflow-x-hidden relative">
      
      {/* 🌟 Modal ยืนยันการเปลี่ยนสิทธิ์ (Safety Guard) */}
      <ConfirmModal
        isOpen={!!roleModalTarget}
        type="warning"
        title="ยืนยันการเปลี่ยนแปลงสิทธิ์?"
        description={
          roleModalTarget && (
            <>
              คุณกำลังจะเปลี่ยนสิทธิ์ของ <strong className="text-white font-mono">{roleModalTarget.user.display_name || 'ผู้ใช้งาน'}</strong><br/>
              จากสิทธิ์เดิม ไปเป็น <strong className="text-amber-400 underline decoration-2">{
                roleModalTarget.newRole === 'admin' ? '⚡ ผู้ดูแลระบบสูงสุด (Admin)' :
                roleModalTarget.newRole === 'creator' ? '✏️ ผู้ช่วยสร้างข้อสอบ (Creator)' : '🎓 นักเรียนทั่วไป (Student)'
              }</strong> ยืนยันใช่หรือไม่?
            </>
          )
        }
        confirmText="✨ ยืนยันเปลี่ยนสิทธิ์ทันที"
        cancelText="← ยกเลิก"
        onClose={() => setRoleModalTarget(null)}
        onConfirm={handleConfirmRoleChange}
      />

      {/* 🌟 Modal แจ้งเตือนทั่วไป */}
      <ConfirmModal
        isOpen={alertModal.isOpen}
        type={alertModal.type}
        title={alertModal.title}
        description={alertModal.desc}
        confirmText="✨ ตกลง / รับทราบ"
        cancelText=""
        onConfirm={closeAlert}
        onClose={closeAlert}
      />

      {/* แผงเครื่องมือค้นหาและกรอง (Filter Bar) */}
      <div className="bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 min-w-0">
        <div className="relative w-full sm:w-80 min-w-0">
          <span className="absolute left-4 top-3.5 text-slate-500 text-sm">🔍</span>
          <input
            type="text"
            placeholder="ค้นหาชื่อ, อีเมล หรือ ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs sm:text-sm font-semibold text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 shrink-0">
          <span className="text-xs font-bold text-slate-400 shrink-0">กรองสิทธิ์:</span>
          {['ALL', 'admin', 'creator', 'student'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shrink-0 ${
                roleFilter === r
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              {r === 'ALL' ? '👥 ทั้งหมด' : r === 'admin' ? '⚡ แอดมิน' : r === 'creator' ? '✏️ ผู้ช่วยสร้าง' : '🎓 นักเรียน'}
            </button>
          ))}
        </div>
      </div>

      {/* ตารางแสดงรายชื่อผู้ใช้งาน */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden min-w-0">
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between text-xs font-bold text-slate-400">
          <span>รายชื่อผู้ใช้งานระบบ ({filteredUsers.length} บัญชี)</span>
          <span className="hidden sm:inline text-[11px] text-slate-500">* กำหนดสิทธิ์ให้ผู้ใช้โดยเลือกดรอปดาวน์ด้านขวามือ</span>
        </div>

        {loading ? (
          <LoadingScreen text="กำลังดึงรายชื่อผู้ใช้งานทั้งหมด..." />
        ) : filteredUsers.length === 0 ? (
          <EmptyState 
            icon="👥"
            title="ไม่พบผู้ใช้งานตามที่ค้นหา"
            description="ลองเปลี่ยนคำค้นหา หรือกดล้างตัวกรองสิทธิ์ด้านบนดูครับ"
          />
        ) : (
          <div className="divide-y divide-slate-800/80 min-w-0">
            {filteredUsers.map((u) => {
              const isSelf = u.id === currentUserId
              const initial = (u.display_name || u.email || 'U').charAt(0).toUpperCase()

              return (
                <div key={u.id} className="p-4 sm:p-6 hover:bg-slate-800/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
                  
                  {/* ข้อมูลซ้ายมือ: รูป + ชื่อ + อีเมล */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/80 text-white font-black text-lg flex items-center justify-center shrink-0 shadow-inner">
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0 mb-0.5">
                        <h4 className="font-extrabold text-white text-sm sm:text-base truncate">
                          {u.display_name || 'ผู้ใช้ไม่ระบุชื่อ'}
                        </h4>
                        {isSelf && (
                          <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-black px-2 py-0.5 rounded-md shrink-0">
                            (คุณ)
                          </span>
                        )}
                        <div className="sm:hidden ml-auto">{getRoleBadge(u.role || 'student')}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 font-mono">
                        <span className="truncate">{u.email || `ID: ${u.id.substring(0, 12)}...`}</span>
                        <span className="text-slate-600 hidden sm:inline">•</span>
                        <span className="text-[11px] text-slate-500">สมัครเมื่อ: {new Date(u.created_at || Date.now()).toLocaleDateString('th-TH')}</span>
                      </div>
                    </div>
                  </div>

                  {/* ข้อมูลขวามือ: สิทธิ์ปัจจุบัน + ดรอปดาวน์เปลี่ยนสิทธิ์ */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto pt-3 sm:pt-0 border-t sm:border-0 border-slate-800 shrink-0">
                    <div className="hidden sm:block">{getRoleBadge(u.role || 'student')}</div>
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-xs text-slate-400 font-bold sm:hidden">เปลี่ยนสิทธิ์เป็น:</span>
                      <select
                        value={u.role || 'student'}
                        disabled={isSelf} // 🛡️ ล็อคไม่ให้คลิกเปลี่ยนสิทธิ์ตัวเอง!
                        onChange={(e) => handleRoleDropdownChange(u, e.target.value)}
                        className={`w-full sm:w-44 px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                          isSelf
                            ? 'bg-slate-950/50 border-slate-800 text-slate-600 cursor-not-allowed'
                            : 'bg-slate-950 border-slate-700 text-white hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                        }`}
                        title={isSelf ? "ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้" : "คลิกเพื่อแต่งตั้งหรือเปลี่ยนสิทธิ์"}
                      >
                        <option value="student">🎓 นักเรียน (Student)</option>
                        <option value="creator">✏️ ผู้ช่วยสร้าง (Creator)</option>
                        <option value="admin">⚡ แอดมิน (Admin)</option>
                      </select>
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}