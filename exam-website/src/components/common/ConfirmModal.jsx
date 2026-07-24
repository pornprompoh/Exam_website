import React from 'react'

export default function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  onConfirm,
  onClose,
  type = 'warning'
}) {
  if (!isOpen) return null

  const themeConfig = {
    warning: {
      icon: '⚠️',
      iconBg: 'bg-amber-100 text-amber-600',
      btnBg: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20'
    },
    danger: {
      icon: '🚨',
      iconBg: 'bg-red-100 text-red-600',
      btnBg: 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20'
    },
    info: {
      icon: '💡',
      iconBg: 'bg-teal-100 text-teal-600',
      btnBg: 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-500/20'
    },
    success: {
      icon: '✨',
      iconBg: 'bg-emerald-100 text-emerald-600',
      btnBg: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
    }
  }

  const currentTheme = themeConfig[type] || themeConfig.warning

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 border border-slate-200 shadow-2xl text-center transform scale-100 transition-all">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5 shadow-inner ${currentTheme.iconBg}`}>
          {currentTheme.icon}
        </div>
        <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">
          {title}
        </h3>
        <div className="text-slate-500 text-xs sm:text-sm leading-relaxed mb-6">
          {description}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-all cursor-pointer shadow-2xs"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-3 font-bold rounded-xl text-xs sm:text-sm transition-all shadow-sm hover:shadow cursor-pointer flex items-center justify-center gap-1.5 ${currentTheme.btnBg}`}
          >
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  )
}