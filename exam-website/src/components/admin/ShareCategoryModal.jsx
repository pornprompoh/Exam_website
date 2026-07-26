import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function ShareCategoryModal({ isOpen, onClose, category, currentUserId, onSuccess, showModal }) {
  const [emailInput, setEmailInput] = useState('')
  const [coOwnersList, setCoOwnersList] = useState([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (isOpen && category) {
      fetchCoOwnersDetails()
    } else {
      setEmailInput('')
      setCoOwnersList([])
    }
  }, [isOpen, category])

  // ดึงข้อมูลอีเมลและชื่อของผู้ร่วมสร้างจากตาราง profiles
  async function fetchCoOwnersDetails() {
    if (!category?.co_owners || category.co_owners.length === 0) {
      setCoOwnersList([])
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, display_name, role')
        .in('id', category.co_owners)

      if (error) throw error
      setCoOwnersList(data || [])
    } catch (err) {
      console.error('Error fetching co-owners:', err)
    } finally {
      setLoading(false)
    }
  }

  // ค้นหาผู้ใช้จากอีเมล และเพิ่มเข้า array co_owners
  async function handleAddCoOwner(e) {
    e.preventDefault()
    if (!emailInput.trim()) return

    setSearching(true)
    try {
      // 1. ค้นหาผู้ใช้จากอีเมลในตาราง profiles
      const { data: userFound, error: searchErr } = await supabase
        .from('profiles')
        .select('id, email, display_name, role')
        .eq('email', emailInput.trim())
        .single()

      if (searchErr || !userFound) {
        return showModal('warning', 'ไม่พบผู้ใช้งาน', 'ไม่พบบัญชีผู้ใช้งานที่ใช้อีเมลนี้ในระบบ กรุณาตรวจสอบอีเมลอีกครั้งครับ')
      }

      if (userFound.id === currentUserId || userFound.id === category.created_by) {
        return showModal('warning', 'เพิ่มไม่ได้', 'คุณหรือผู้ใช้นี้เป็นเจ้าของหลักของหมวดหมู่วิชานี้อยู่แล้วครับ')
      }

      const currentCoOwners = category.co_owners || []
      if (currentCoOwners.includes(userFound.id)) {
        return showModal('warning', 'มีสิทธิ์อยู่แล้ว', 'ผู้ใช้งานนี้เป็นเจ้าของร่วมในวิชานี้อยู่แล้วครับ')
      }

      // 2. อัปเดต array co_owners ลงฐานข้อมูล
      const updatedCoOwners = [...currentCoOwners, userFound.id]
      const { error: updateErr } = await supabase
        .from('categories')
        .update({ co_owners: updatedCoOwners })
        .eq('id', category.id)

      if (updateErr) throw updateErr

      setCoOwnersList(prev => [...prev, userFound])
      setEmailInput('')
      showModal('success', 'เพิ่มเจ้าของร่วมสำเร็จ!', `เพิ่มคุณ ${userFound.display_name || userFound.email} เข้าเป็นผู้ร่วมดูแลวิชานี้เรียบร้อยแล้วครับ`)
      if (onSuccess) onSuccess()
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', 'ไม่สามารถเพิ่มเจ้าของร่วมได้: ' + err.message)
    } finally {
      setSearching(false)
    }
  }

  // ลบเจ้าของร่วมออกจากวิชานี้
  async function handleRemoveCoOwner(removeUserId) {
    try {
      const updatedCoOwners = (category.co_owners || []).filter(id => id !== removeUserId)
      const { error } = await supabase
        .from('categories')
        .update({ co_owners: updatedCoOwners })
        .eq('id', category.id)

      if (error) throw error

      setCoOwnersList(prev => prev.filter(u => u.id !== removeUserId))
      showModal('success', 'ลบสิทธิ์สำเร็จ', 'นำผู้ร่วมสร้างออกจากหมวดหมู่วิชานี้เรียบร้อยแล้วครับ')
      if (onSuccess) onSuccess()
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', err.message)
    }
  }

  if (!isOpen || !category) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity animate-fadeIn cursor-pointer" />
      
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 z-10 animate-scaleUp space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-lg shrink-0">👥</span>
            <div className="min-w-0">
              <h3 className="text-base font-black text-white truncate">แชร์และจัดการเจ้าของร่วม</h3>
              <p className="text-xs text-slate-400 truncate">วิชา: {category.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 font-bold flex items-center justify-center transition-all cursor-pointer">✕</button>
        </div>

        {/* ฟอร์มเพิ่มเจ้าของร่วมใหม่ด้วยอีเมล */}
        <form onSubmit={handleAddCoOwner} className="space-y-2">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">เชิญผู้ร่วมสร้างด้วยอีเมล (Creator / Admin)</label>
          <div className="flex gap-2">
            <input
              type="email"
              required
              placeholder="เช่น creator@gmail.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <button
              type="submit"
              disabled={searching || !emailInput.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <span>{searching ? '⏳ กำลังค้นหา...' : '➕ เชิญร่วมสร้าง'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500">* ผู้ที่ถูกเชิญจะสามารถสร้างข้อสอบ แก้ไข หรือลบข้อสอบในวิชานี้ได้เสมือนเป็นเจ้าของครับ</p>
        </form>

        {/* รายชื่อผู้ร่วมดูแลปัจจุบัน */}
        <div className="space-y-3 pt-2 border-t border-slate-800/80">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">ผู้มีสิทธิ์จัดการวิชานี้</div>
          
          <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3 max-h-60 overflow-y-auto space-y-2.5">
            {/* เจ้าของหลัก */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black flex items-center justify-center text-xs">👑</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">เจ้าของวิชาเริ่มต้น (Original Creator)</div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">ID: {category.created_by?.substring(0, 8)}...</div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">เจ้าของหลัก</span>
            </div>

            {/* รายชื่อเจ้าของร่วม */}
            {loading ? (
              <div className="text-center py-4 text-xs text-slate-500 font-bold">⏳ กำลังโหลดรายชื่อผู้ร่วมสร้าง...</div>
            ) : coOwnersList.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-600 font-medium">ยังไม่มีผู้ร่วมดูแลในวิชานี้ (คุณเป็นผู้ดูแลคนเดียว)</div>
            ) : (
              coOwnersList.map(u => (
                <div key={u.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800/80">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold flex items-center justify-center text-xs uppercase font-mono">
                      {u.display_name?.charAt(0) || u.email?.charAt(0) || 'C'}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{u.display_name || 'Creator'}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">{u.email}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">เจ้าของร่วม</span>
                    <button
                      onClick={() => handleRemoveCoOwner(u.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer text-xs"
                      title="ลบสิทธิ์"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button onClick={onClose} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer">เสร็จสิ้น / ปิดหน้าต่าง</button>
        </div>
      </div>
    </div>
  )
}