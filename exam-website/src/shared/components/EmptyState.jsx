import { useTheme } from '../context/ThemeContext'

export default function EmptyState({
  icon = '📁',
  title = 'ไม่มีข้อมูล',
  description = 'ยังไม่พบข้อมูลในรายการนี้',
  actionText = '',
  onAction = null,
  theme
}) {
  const { isDark: contextIsDark } = useTheme()
  const isDark = theme ? theme === 'dark' : contextIsDark

  return (
    <div className={`rounded-2xl p-8 sm:p-10 text-center border max-w-md mx-auto my-6 ${
      isDark
        ? 'bg-slate-900/70 border-slate-800 text-slate-100'
        : 'bg-white border-slate-200 text-slate-900'
    }`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl mx-auto mb-3.5 border ${
        isDark
          ? 'bg-slate-800 border-slate-700 text-indigo-400'
          : 'bg-slate-50 border-slate-200 text-indigo-600'
      }`}>
        {icon}
      </div>

      <h3 className={`text-base font-bold mb-1.5 tracking-tight ${
        isDark ? 'text-white' : 'text-slate-900'
      }`}>
        {title}
      </h3>

      <p className={`text-xs sm:text-sm leading-relaxed ${
        isDark ? 'text-slate-400' : 'text-slate-500'
      }`}>
        {description}
      </p>

      {actionText && typeof onAction === 'function' && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </div>
  )
}
