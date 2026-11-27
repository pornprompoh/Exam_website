import { useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { AlertTriangleIcon, CheckCircleIcon, InfoCircleIcon } from './AdminIcons'

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'ยืนยันการทำรายการ?',
  description = 'กรุณาตรวจสอบความถูกต้องก่อนกดตกลง',
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  type = 'danger',
  theme
}) {
  const { isDark: contextIsDark } = useTheme()
  const isDark = theme ? theme === 'dark' : contextIsDark

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const getConfig = () => {
    switch (type) {
      case 'danger':
        return {
          icon: <AlertTriangleIcon className="w-6 h-6" />,
          iconBg: isDark
            ? 'bg-red-500/15 text-red-400 border-red-500/25'
            : 'bg-red-50 text-red-600 border-red-200/80',
          btnStyle: 'bg-red-600 hover:bg-red-700 text-white'
        }
      case 'warning':
        return {
          icon: <AlertTriangleIcon className="w-6 h-6" />,
          iconBg: isDark
            ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
            : 'bg-amber-50 text-amber-600 border-amber-200/80',
          btnStyle: 'bg-amber-600 hover:bg-amber-700 text-white'
        }
      case 'success':
        return {
          icon: <CheckCircleIcon className="w-6 h-6" />,
          iconBg: isDark
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
            : 'bg-emerald-50 text-emerald-600 border-emerald-200/80',
          btnStyle: 'bg-emerald-600 hover:bg-emerald-700 text-white'
        }
      case 'info':
      default:
        return {
          icon: <InfoCircleIcon className="w-6 h-6" />,
          iconBg: isDark
            ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25'
            : 'bg-indigo-50 text-indigo-600 border-indigo-200/80',
          btnStyle: 'bg-indigo-600 hover:bg-indigo-700 text-white'
        }
    }
  }

  const config = getConfig()

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-xs animate-fadeIn cursor-pointer"
      />

      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-md rounded-2xl p-6 text-center border shadow-xl z-10 animate-scaleUp ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 border ${config.iconBg}`}>
          {config.icon}
        </div>

        <h3 className={`text-base sm:text-lg font-bold mb-2 tracking-tight ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}>
          {title}
        </h3>

        <div className={`text-xs sm:text-sm leading-relaxed mb-6 break-words [word-break:break-word] ${
          isDark ? 'text-slate-400' : 'text-slate-600'
        }`}>
          {description}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2.5 justify-center">
          {cancelText && (
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer border ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
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
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${config.btnStyle}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
