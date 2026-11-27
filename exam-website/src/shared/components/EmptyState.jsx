import { useTheme } from '../context/ThemeContext'
import { FolderIcon } from './AdminIcons'

export default function EmptyState({
  icon = null,
  title = 'ยังไม่มีข้อมูล',
  description = 'เริ่มต้นสร้างรายการแรกของคุณได้เลย',
  actionText = '',
  onAction = null,
  theme
}) {
  const { isDark: contextIsDark } = useTheme()
  const isDark = theme ? theme === 'dark' : contextIsDark

  return (
    <section
      className={`rounded-2xl p-8 sm:p-10 text-center border max-w-md mx-auto my-6 ${
        isDark
          ? 'bg-[#181818] border-[#272727] text-zinc-100'
          : 'bg-white border-zinc-200 text-zinc-900'
      }`}
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 border ${
          isDark
            ? 'bg-[#1F1F1F] border-[#313131] text-indigo-400'
            : 'bg-zinc-50 border-zinc-200 text-indigo-600'
        }`}
      >
        {icon || <FolderIcon className="w-5 h-5" />}
      </div>

      <h3 className={`text-base font-semibold mb-1.5 ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
        {title}
      </h3>

      <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
        {description}
      </p>

      {actionText && typeof onAction === 'function' && (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-semibold transition-all duration-300 ease-premium cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </section>
  )
}
