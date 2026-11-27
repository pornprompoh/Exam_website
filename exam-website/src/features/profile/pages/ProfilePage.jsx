import { useState } from 'react'
import Navbar from '../../../shared/components/Navbar'
import LoadingScreen from '../../../shared/components/LoadingScreen'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import {
  EditIcon,
  EyeIcon,
  EyeOffIcon,
  InfoCircleIcon,
  KeyIcon,
  ShieldCheckIcon,
  UserIcon
} from '../../../shared/components/AdminIcons'
import useProfile from '../hooks/useProfile'

export default function ProfilePage() {
  const [showPass, setShowPass] = useState(false)
  const {
    loading,
    email,
    role,
    displayName,
    setDisplayName,
    savingName,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    savingPass,
    modalConfig,
    closeModal,
    handleUpdateName,
    handleUpdatePassword
  } = useProfile()

  const inputBaseClass =
    'w-full px-4 py-2.5 bg-zinc-50 dark:bg-[#1F1F1F] hover:bg-zinc-100/70 dark:hover:bg-[#272727] focus:bg-white dark:focus:bg-[#272727] border border-zinc-200 dark:border-[#313131] rounded-xl text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300 ease-premium'

  return (
    <div className="min-h-dvh bg-[#f8f8f9] dark:bg-[#000000] font-sans text-zinc-900 dark:text-zinc-100 pb-24 overflow-x-hidden transition-colors duration-300">
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        title={modalConfig.title}
        description={modalConfig.description}
        confirmText="ตกลง"
        cancelText=""
        onConfirm={closeModal}
        onClose={closeModal}
      />

      <Navbar showNavPills={true} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-7 space-y-5 sm:space-y-6 min-w-0">
        <header className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/70 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <UserIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
              ตั้งค่าโปรไฟล์และบัญชี
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
              จัดการชื่อแสดงผลและรหัสผ่านสำหรับเข้าใช้งานระบบ
            </p>
          </div>
        </header>

        {loading ? (
          <LoadingScreen text="กำลังโหลดข้อมูลโปรไฟล์..." />
        ) : (
          <>
            <section className="bg-white dark:bg-[#181818] p-5 sm:p-6 rounded-2xl border border-zinc-200 dark:border-[#272727] flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0 transition-colors duration-300">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shrink-0">
                  {displayName ? displayName.charAt(0).toUpperCase() : <UserIcon className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base sm:text-lg truncate">
                    {displayName || 'ผู้ใช้งานระบบ'}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">{email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">สถานะสิทธิ์</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                    role === 'admin'
                      ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25'
                      : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25'
                  }`}
                >
                  <ShieldCheckIcon className="w-3.5 h-3.5" />
                  <span>{role === 'admin' ? 'ผู้ดูแลระบบ' : 'นักเรียน / ผู้เข้าสอบ'}</span>
                </span>
              </div>
            </section>

            <section className="bg-white dark:bg-[#181818] p-6 sm:p-7 rounded-2xl border border-zinc-200 dark:border-[#272727] space-y-5 min-w-0 transition-colors duration-300">
              <div className="flex items-start gap-3 pb-4 border-b border-zinc-100 dark:border-[#272727]">
                <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-[#1F1F1F] border border-zinc-200 dark:border-[#272727] text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                  <EditIcon className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
                    ข้อมูลโปรไฟล์ทั่วไป
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    ชื่อนี้จะถูกแสดงในหน้าผลสอบและประวัติสถิติของคุณ
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpdateName} className="space-y-4">
                <div>
                  <label htmlFor="profile-display-name" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    ชื่อแสดงผล
                  </label>
                  <input
                    id="profile-display-name"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="เช่น สมชาย ใจดี"
                    className={inputBaseClass}
                  />
                </div>

                <div>
                  <label htmlFor="profile-email" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                    อีเมลบัญชี (ไม่สามารถแก้ไขได้)
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    disabled
                    value={email}
                    className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-[#1F1F1F]/60 border border-zinc-200 dark:border-[#272727] rounded-xl text-sm font-mono text-zinc-500 dark:text-zinc-400 cursor-not-allowed select-none"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingName}
                    className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-premium cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    <span>{savingName ? 'กำลังบันทึก...' : 'บันทึกชื่อแสดงผล'}</span>
                  </button>
                </div>
              </form>
            </section>

            <section className="bg-white dark:bg-[#181818] p-6 sm:p-7 rounded-2xl border border-zinc-200 dark:border-[#272727] space-y-5 min-w-0 transition-colors duration-300">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-[#272727]">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-[#1F1F1F] border border-zinc-200 dark:border-[#272727] text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                    <KeyIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
                      ความปลอดภัยและรหัสผ่าน
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      ตั้งรหัสผ่านใหม่สำหรับเข้าใช้งานระบบในครั้งถัดไป
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPass((prev) => !prev)}
                  aria-label={showPass ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  className="p-2 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#272727] transition-colors cursor-pointer shrink-0"
                >
                  {showPass ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="profile-new-password" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      รหัสผ่านใหม่ (ขั้นต่ำ 6 ตัวอักษร)
                    </label>
                    <input
                      id="profile-new-password"
                      type={showPass ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านใหม่"
                      className={inputBaseClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="profile-confirm-password" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      ยืนยันรหัสผ่านใหม่อีกครั้ง
                    </label>
                    <input
                      id="profile-confirm-password"
                      type={showPass ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                      className={inputBaseClass}
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-[#131209] border border-amber-200 dark:border-amber-500/25 text-xs text-amber-900 dark:text-amber-300 font-medium flex items-start gap-2.5">
                  <InfoCircleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <span className="leading-relaxed">
                    คำแนะนำ: ควรใช้รหัสผ่านที่มีทั้งตัวอักษรภาษาอังกฤษและตัวเลขผสมกันเพื่อความปลอดภัยของบัญชี
                  </span>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingPass}
                    className="w-full sm:w-auto px-5 py-2.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white active:scale-[0.98] disabled:opacity-50 text-white dark:text-zinc-900 font-semibold rounded-xl text-sm transition-all duration-300 ease-premium cursor-pointer inline-flex items-center justify-center gap-2"
                  >
                    <KeyIcon className="w-4 h-4" />
                    <span>{savingPass ? 'กำลังอัปเดตรหัสผ่าน...' : 'เปลี่ยนรหัสผ่าน'}</span>
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
