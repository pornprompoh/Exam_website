import { useEffect } from 'react'

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "ยืนยันการทำรายการ?",
  description = "กรุณาตรวจสอบความถูกต้องก่อนกดตกลงครับ",
  confirmText = "ตกลง / ยืนยัน",
  cancelText = "← ยกเลิก",
  type = "danger", // 'danger' | 'warning' | 'success' | 'info'
  theme = "light"  // 🌟 เพิ่ม prop รองรับ 'light' หรือ 'dark'
}) {
  const isDark = theme === 'dark'

  // ปิดป็อปอัปเมื่อกดปุ่ม ESC บนคีย์บอร์ด
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // กำหนดโทนสีและไอคอนตามประเภท (Type)
  const getConfig = () => {
    switch (type) {
      case 'danger':
        return {
          icon: '🚨',
          iconBg: isDark ? 'bg-red-500/10 text-red-400 border-red-500/20 shadow-red-500/10' : 'bg-red-50 text-red-600 border-red-100',
          btnStyle: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-500/20 ring-1 ring-red-400/30'
        }
      case 'warning':
        return {
          icon: '⚠️',
          iconBg: isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/10' : 'bg-amber-50 text-amber-600 border-amber-100',
          btnStyle: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-lg shadow-orange-500/20 ring-1 ring-amber-400/30'
        }
      case 'success':
        return {
          icon: '🎉',
          iconBg: isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10' : 'bg-emerald-50 text-emerald-600 border-emerald-100',
          btnStyle: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30'
        }
      case 'info':
      default:
        return {
          icon: '💡',
          iconBg: isDark ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-indigo-500/10' : 'bg-indigo-50 text-indigo-600 border-indigo-100',
          btnStyle: 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400/30'
        }
    }
  }

  const config = getConfig()

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* 🌟 Backdrop พื้นหลังมืดกึ่งโปร่งแสง พร้อมเอฟเฟกต์เบลอ */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity animate-fadeIn cursor-pointer"
      />

      {/* 🌟 Modal Card (เปลี่ยนสีตาม Theme สว่าง/มืด) */}
      <div className={`relative w-full max-w-md rounded-3xl p-6 sm:p-8 text-center border shadow-2xl z-10 animate-scaleUp transition-all duration-300 ${
        isDark 
          ? 'bg-slate-900 border-slate-800 text-white shadow-indigo-500/5' 
          : 'bg-white border-slate-100 text-slate-900'
      }`}>
        
        {/* ไอคอนเรืองแสงด้านบน */}
        <div className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl mx-auto mb-5 border shadow-inner transition-transform duration-300 hover:scale-110 ${config.iconBg}`}>
          {config.icon}
        </div>

        {/* หัวข้อและการ์ดอธิบาย */}
        <h3 className={`text-lg sm:text-xl font-black mb-2 tracking-tight ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}>
          {title}
        </h3>

        <p className={`text-xs sm:text-sm leading-relaxed mb-8 break-words [word-break:break-word] ${
          isDark ? 'text-slate-400' : 'text-slate-500'
        }`}>
          {description}
        </p>

        {/* ปุ่มซ้าย-ขวา */}
        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 justify-center">
          {cancelText && (
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-3 px-5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                isDark 
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`flex-1 py-3 px-5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${config.btnStyle}`}
          >
            {confirmText}
          </button>
        </div>

      </div>
    </div>
  )
}