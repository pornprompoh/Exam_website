import Navbar from '../../../shared/components/Navbar'
import LoadingScreen from '../../../shared/components/LoadingScreen'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import useProfile from '../hooks/useProfile'

export default function ProfilePage() {
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

  return (
    <div className="min-h-screen bg-slate-50/70 font-sans text-slate-800 pb-24 overflow-x-hidden">
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

      <Navbar showNavPills={true} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 mt-8 space-y-6 sm:space-y-8 min-w-0">
        {loading ? (
          <LoadingScreen text="กำลังโหลดข้อมูลโปรไฟล์..." />
        ) : (
          <>
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-black text-xl flex items-center justify-center shadow-md shrink-0">
                  {displayName ? displayName.charAt(0).toUpperCase() : '👤'}
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg truncate">{displayName || 'ผู้ใช้งานระบบ'}</h3>
                  <p className="text-xs text-slate-400 font-mono truncate">{email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <span className="text-xs font-bold text-slate-500">สถานะสิทธิ์:</span>
                <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border ${
                  role === 'admin' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {role === 'admin' ? '⚡ แอดมินผู้ดูแลระบบ' : '🎓 นักเรียน / ผู้เข้าสอบ'}
                </span>
              </div>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 min-w-0">
              <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
                <span className="text-lg">✏️</span>
                <div>
                  <h2 className="font-extrabold text-slate-900 text-base sm:text-lg">ข้อมูลโปรไฟล์ทั่วไป</h2>
                  <p className="text-xs text-slate-400">ชื่อนี้จะถูกนำไปใช้แสดงในหน้าผลสอบและประวัติสถิติต่างๆ ครับ</p>
                </div>
              </div>

              <form onSubmit={handleUpdateName} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    ชื่อแสดงผล (Display Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="เช่น ครูสายคอม, สมชาย ใจดี"
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    อีเมลบัญชี (ไม่สามารถแก้ไขได้)
                  </label>
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-200/60 rounded-2xl text-sm font-semibold text-slate-400 cursor-not-allowed select-none"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingName}
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-sm hover:shadow cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>{savingName ? '⏳ กำลังบันทึก...' : '💾 บันทึกชื่อแสดงผล'}</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 min-w-0">
              <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
                <span className="text-lg">🔒</span>
                <div>
                  <h2 className="font-extrabold text-slate-900 text-base sm:text-lg">ความปลอดภัยและรหัสผ่าน</h2>
                  <p className="text-xs text-slate-400">ตั้งค่ารหัสผ่านใหม่สำหรับเข้าใช้งานระบบในครั้งถัดไป</p>
                </div>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      รหัสผ่านใหม่ * (ขั้นต่ำ 6 ตัวอักษร)
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      ยืนยันรหัสผ่านใหม่อีกครั้ง *
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-xs text-amber-800 font-medium flex items-center gap-2">
                  <span className="text-base shrink-0">💡</span>
                  <span>คำแนะนำ: ควรใช้รหัสผ่านที่มีทั้งตัวอักษรภาษาอังกฤษและตัวเลขผสมกันเพื่อความปลอดภัยครับ</span>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingPass}
                    className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-sm hover:shadow cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>{savingPass ? '⏳ กำลังอัปเดตรหัสผ่าน...' : '🔑 เปลี่ยนรหัสผ่านทันที'}</span>
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
