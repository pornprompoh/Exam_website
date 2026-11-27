import { useEffect } from 'react'
import { CloseIcon } from './AdminIcons'

/**
 * Standardized Light/Dark Admin Slide-over Drawer / Modal Shell:
 * - Compact Header + optional subHeader (tabs/filters)
 * - Clean scrollable Body
 * - Optional Sticky Footer for primary/secondary actions
 * - Approved neutral dark surfaces (#181818 / #1F1F1F / #272727) & Escape key support
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
  zIndex = 'z-70',
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
      className={`fixed inset-0 ${zIndex} bg-black/55 dark:bg-black/75 backdrop-blur-xs flex justify-end animate-fadeIn`}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className={`h-full w-full ${maxWidth} bg-white dark:bg-[#181818] border-l border-zinc-200 dark:border-[#272727] shadow-2xl flex flex-col overflow-hidden relative animate-slideLeft`}
      >
        <header className="px-6 py-4 border-b border-zinc-200 dark:border-[#272727] bg-white dark:bg-[#181818] shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <span className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-[#1F1F1F] text-indigo-600 dark:text-indigo-400 border border-zinc-200 dark:border-[#272727] flex items-center justify-center shrink-0">
                  {icon}
                </span>
              )}
              <div className="min-w-0">
                <h2 id={titleId} className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                aria-label="ปิดหน้าต่าง"
                className="w-9 h-9 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1F1F1F] dark:hover:bg-[#272727] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 flex items-center justify-center transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {subHeader}
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">{children}</div>

        {footer && (
          <footer className="px-6 py-4 border-t border-zinc-200 dark:border-[#272727] bg-zinc-50 dark:bg-[#1F1F1F] shrink-0">
            {footer}
          </footer>
        )}
      </section>
    </div>
  )
}
