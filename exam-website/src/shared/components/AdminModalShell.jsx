import { useEffect } from 'react'
import { CloseIcon } from './AdminIcons'

/**
 * Standardized Light/Dark Admin Slide-over Drawer / Modal Shell:
 * - Consistent compact Header + optional subHeader (tabs/filters)
 * - Clean scrollable Body
 * - Optional Sticky Footer for primary/secondary actions
 * - Escape key support
 */
export default function AdminModalShell({
  isOpen,
  onClose,
  title,
  subtitle = '',
  titleId,
  icon = null,
  headerActions = null,
  subHeader = null,
  footer = null,
  maxWidth = 'max-w-4xl',
  zIndex = 'z-[1000]',
  children
}) {
  useEffect(() => {
    if (!isOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="presentation"
      onClick={onClose}
      className={`fixed inset-0 ${zIndex} bg-slate-950/55 dark:bg-black/70 backdrop-blur-xs flex justify-end`}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className={`h-full w-full ${maxWidth} bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden relative animate-slideLeft`}
      >
        <header className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shrink-0 space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <span className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-500/25 flex items-center justify-center shrink-0">
                  {icon}
                </span>
              )}
              <div className="min-w-0">
                <h2 id={titleId} className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                aria-label="ปิดหน้าต่าง"
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {subHeader}
        </header>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          {children}
        </div>

        {footer && (
          <footer className="px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 backdrop-blur-md shrink-0">
            {footer}
          </footer>
        )}
      </section>
    </div>
  )
}
