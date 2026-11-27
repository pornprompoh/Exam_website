import { useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'
import { AlertTriangleIcon, CheckCircleIcon, InfoCircleIcon } from './AdminIcons'

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'ยืนยันการทำรายการ',
  description = 'กรุณาตรวจสอบความถูกต้องก่อนดำเนินการต่อ',
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
          icon: <AlertTriangleIcon className="w-5 h-5" />,
          iconBg: isDark
            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            : 'bg-rose-50 text-rose-600 border-rose-200',
          btnStyle: 'bg-rose-600 hover:bg-rose-700 text-white'
        }
      case 'warning':
        return {
          icon: <AlertTriangleIcon className="w-5 h-5" />,
          iconBg: isDark
            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            : 'bg-amber-50 text-amber-700 border-amber-200',
          btnStyle: 'bg-amber-600 hover:bg-amber-700 text-white'
        }
      case 'success':
        return {
          icon: <CheckCircleIcon className="w-5 h-5" />,
          iconBg: isDark
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200',
          btnStyle: 'bg-emerald-600 hover:bg-emerald-700 text-white'
        }
      case 'info':
      default:
        return {
          icon: <InfoCircleIcon className="w-5 h-5" />,
          iconBg: isDark
            ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
            : 'bg-indigo-50 text-indigo-600 border-indigo-200',
          btnStyle: 'bg-indigo-600 hover:bg-indigo-700 text-white'
        }
    }
  }

  const config = getConfig()

  return (
    <div className="fixed inset-0 z-90 overflow-y-auto flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-fadeIn cursor-pointer"
      />

      <section
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-md rounded-2xl p-6 text-center border shadow-2xl z-10 animate-scaleUp ${
          isDark
            ? 'bg-[#181818] border-[#272727] text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-900'
        }`}
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 border ${config.iconBg}`}>
          {config.icon}
        </div>

        <h3 className={`text-base font-bold mb-2 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
          {title}
        </h3>

        <div
          className={`text-sm leading-relaxed mb-6 break-words [word-break:break-word] ${
            isDark ? 'text-zinc-400' : 'text-zinc-600'
          }`}
        >
          {description}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2.5 justify-center">
          {cancelText && (
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer border ${
                isDark
                  ? 'bg-[#1F1F1F] hover:bg-[#272727] text-zinc-200 border-[#313131]'
                  : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200'
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
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 ${config.btnStyle}`}
          >
            {confirmText}
          </button>
        </div>
      </section>
    </div>
  )
}
