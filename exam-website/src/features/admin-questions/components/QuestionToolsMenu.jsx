import {
  ChevronDownIcon,
  FileExtractIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UploadBoltIcon
} from '../../../shared/components/AdminIcons'

export default function QuestionToolsMenu({
  toolsMenuRef,
  showToolsMenu,
  disabled,
  alertBadgeCount,
  hasDrafts,
  stagingCount,
  hasFlagged,
  flaggedCounts,
  onToggleMenu,
  onOpenExtractor,
  onOpenGenerator,
  onOpenAuditor,
  onOpenBulkImport
}) {
  return (
    <div className="relative" ref={toolsMenuRef}>
      <button
        type="button"
        onClick={onToggleMenu}
        disabled={disabled}
        aria-expanded={showToolsMenu}
        aria-haspopup="menu"
        className="h-10 px-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer inline-flex items-center gap-2 shrink-0"
      >
        <SparklesIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <span>เครื่องมือ AI & นำเข้า</span>
        {alertBadgeCount > 0 && (
          <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-600 text-white text-[11px] font-bold tabular-nums inline-flex items-center justify-center">
            {alertBadgeCount}
          </span>
        )}
        <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform ${showToolsMenu ? 'rotate-180' : ''}`} />
      </button>

      {showToolsMenu && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-1.5 z-40 animate-fadeIn space-y-0.5"
        >
          <button
            type="button"
            role="menuitem"
            onClick={onOpenExtractor}
            className="w-full px-3 py-2.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-start gap-2.5"
          >
            <FileExtractIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">AI ดึงข้อสอบจากไฟล์</span>
                {hasDrafts && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-semibold tabular-nums">
                    {stagingCount} Draft
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">สกัดโจทย์ตามต้นฉบับจาก PDF / รูปภาพ</p>
            </div>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={onOpenGenerator}
            className="w-full px-3 py-2.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-start gap-2.5"
          >
            <SparklesIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-slate-900 dark:text-white block">AI สร้างข้อสอบจากเอกสาร</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">สรุปเนื้อหาและออกโจทย์ใหม่อัตโนมัติ</p>
            </div>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={onOpenAuditor}
            className="w-full px-3 py-2.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-start gap-2.5"
          >
            <ShieldCheckIcon className="w-4 h-4 text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">AI ตรวจทานเฉลย</span>
                {hasFlagged && (
                  <span className="px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] font-semibold tabular-nums">
                    {flaggedCounts.categoryFlagged > 0 ? flaggedCounts.categoryFlagged : flaggedCounts.totalFlagged} ข้อ
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">สแกนและคัดกรองเฉลยที่อาจผิดพลาด</p>
            </div>
          </button>

          <div className="my-1 border-t border-slate-200 dark:border-slate-800" />

          <button
            type="button"
            role="menuitem"
            onClick={onOpenBulkImport}
            className="w-full px-3 py-2.5 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-start gap-2.5"
          >
            <UploadBoltIcon className="w-4 h-4 text-slate-600 dark:text-slate-300 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-slate-900 dark:text-white block">นำเข้าชุดใหญ่ (วางข้อความ)</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">วางโจทย์แบบชุดเพื่อแปลงลงคลังเร็ว</p>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
