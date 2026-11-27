/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { CloseIcon, PlusIcon, TrashIcon, UsersIcon } from '../../../shared/components/AdminIcons'
import {
  fetchCoOwnerProfiles,
  findProfileByEmail,
  updateCategoryCoOwners
} from '../services/categoryService'

export default function ShareCategoryModal({ isOpen, onClose, category, currentUserId, onSuccess, showModal }) {
  const [emailInput, setEmailInput] = useState('')
  const [coOwnersList, setCoOwnersList] = useState([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (isOpen && category) {
      loadCoOwners()
    } else {
      setEmailInput('')
      setCoOwnersList([])
    }
  }, [isOpen, category])

  useEffect(() => {
    if (!isOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  async function loadCoOwners() {
    if (!category?.co_owners || category.co_owners.length === 0) {
      setCoOwnersList([])
      return
    }
    setLoading(true)
    try {
      const data = await fetchCoOwnerProfiles(category.co_owners)
      setCoOwnersList(data)
    } catch (err) {
      console.error('Error fetching co-owners:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddCoOwner(e) {
    e.preventDefault()
    if (!emailInput.trim()) return

    setSearching(true)
    try {
      const userFound = await findProfileByEmail(emailInput)
      if (!userFound) {
        return showModal('warning', 'ไม่พบผู้ใช้งาน', 'ไม่พบบัญชีผู้ใช้งานที่ใช้อีเมลนี้ในระบบ กรุณาตรวจสอบอีเมลอีกครั้ง')
      }
      if (userFound.id === currentUserId || userFound.id === category.created_by) {
        return showModal('warning', 'เพิ่มไม่ได้', 'คุณหรือผู้ใช้นี้เป็นเจ้าของหลักของหมวดหมู่วิชานี้อยู่แล้ว')
      }
      const currentCoOwners = category.co_owners || []
      if (currentCoOwners.includes(userFound.id)) {
        return showModal('warning', 'มีสิทธิ์อยู่แล้ว', 'ผู้ใช้งานนี้เป็นเจ้าของร่วมในวิชานี้อยู่แล้ว')
      }

      await updateCategoryCoOwners(category.id, [...currentCoOwners, userFound.id])
      setCoOwnersList((prev) => [...prev, userFound])
      setEmailInput('')
      showModal('success', 'เพิ่มเจ้าของร่วมสำเร็จ', `เพิ่ม ${userFound.display_name || userFound.email} เป็นผู้ร่วมดูแลวิชานี้เรียบร้อยแล้ว`)
      onSuccess?.()
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', 'ไม่สามารถเพิ่มเจ้าของร่วมได้: ' + err.message)
    } finally {
      setSearching(false)
    }
  }

  async function handleRemoveCoOwner(removeUserId) {
    try {
      const updatedCoOwners = (category.co_owners || []).filter((id) => id !== removeUserId)
      await updateCategoryCoOwners(category.id, updatedCoOwners)
      setCoOwnersList((prev) => prev.filter((u) => u.id !== removeUserId))
      showModal('success', 'ลบสิทธิ์สำเร็จ', 'นำผู้ร่วมดูแลออกจากหมวดหมู่วิชานี้เรียบร้อยแล้ว')
      onSuccess?.()
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาด', err.message)
    }
  }

  if (!isOpen || !category) return null

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 bg-slate-950/55 dark:bg-black/75 backdrop-blur-xs animate-fadeIn"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-category-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 z-10 animate-scaleUp space-y-5"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-500/25 flex items-center justify-center shrink-0">
              <UsersIcon className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 id="share-category-title" className="text-base font-bold text-slate-900 dark:text-white truncate">
                แชร์สิทธิ์และเจ้าของร่วม
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">วิชา: {category.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleAddCoOwner} className="space-y-2">
          <label htmlFor="co-owner-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            เชิญผู้ร่วมสร้างด้วยอีเมล (Creator / Admin)
          </label>
          <div className="flex gap-2">
            <input
              id="co-owner-email"
              type="email"
              required
              placeholder="creator@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="flex-1 h-10 px-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <button
              type="submit"
              disabled={searching || !emailInput.trim()}
              className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>{searching ? 'กำลังค้นหา...' : 'เชิญ'}</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ผู้ที่ถูกเชิญจะสามารถเพิ่ม แก้ไข หรือลบข้อสอบในวิชานี้ได้
          </p>
        </form>

        <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">ผู้มีสิทธิ์จัดการวิชานี้</div>

          <div className="bg-slate-50/80 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 max-h-60 overflow-y-auto space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25 font-bold flex items-center justify-center text-xs shrink-0">O</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">เจ้าของวิชาเริ่มต้น</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                    ID: {category.created_by?.substring(0, 8)}...
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25 shrink-0">เจ้าของหลัก</span>
            </div>

            {loading ? (
              <div className="text-center py-4 text-xs text-slate-500 font-medium">กำลังโหลดรายชื่อผู้ร่วมดูแล...</div>
            ) : coOwnersList.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500 dark:text-slate-400">ยังไม่มีผู้ร่วมดูแลในวิชานี้</div>
            ) : (
              coOwnersList.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/25 font-semibold flex items-center justify-center text-xs uppercase shrink-0">
                      {u.display_name?.charAt(0) || u.email?.charAt(0) || 'C'}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{u.display_name || 'Creator'}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">{u.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/25">เจ้าของร่วม</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCoOwner(u.id)}
                      aria-label={`ลบสิทธิ์ของ ${u.email}`}
                      className="w-7 h-7 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                      title="ลบสิทธิ์"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </section>
    </div>
  )
}
