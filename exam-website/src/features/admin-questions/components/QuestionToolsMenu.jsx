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
        className="h-10 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1F1F1F] dark:hover:bg-[#272727] disabled:opacity-40 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-[#272727] rounded-xl text-sm font-semibold transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer inline-flex items-center gap-2 shrink-0"
      >
        <SparklesIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <span>เครื่องมือ AI และนำเข้า</span>
        {alertBadgeCount > 0 && (
          <span className="min-w-5 h-5 px-1.5 rounded-md bg-rose-600 text-white text-xs font-semibold tabular-nums inline-flex items-center justify-center">
            {alertBadgeCount}
          </span>
        )}
        <ChevronDownIcon
          className={`w-4 h-4 text-zinc-400 transition-transform duration-300 ease-premium ${
            showToolsMenu ? 'rotate-180' : ''
          }`}
        />
      </button>

      {showToolsMenu && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#181818] border border-zinc-200 dark:border-[#272727] rounded-2xl shadow-xl p-2 z-40 animate-fadeIn space-y-1"
        >
          <button
            type="button"
            role="menuitem"
            onClick={onOpenExtractor}
            className="w-full px-3 py-2.5 rounded-lg text-left hover:bg-zinc-100 dark:hover:bg-[#272727] transition-colors duration-300 cursor-pointer flex items-start gap-3"
          >
            <FileExtractIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI ดึงข้อสอบจากไฟล์</span>
                {hasDrafts && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-semibold tabular-nums">
                    {stagingCount} Draft
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">สกัดโจทย์ตามต้นฉบับจาก PDF หรือรูปภาพ</p>
            </div>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={onOpenGenerator}
            className="w-full px-3 py-2.5 rounded-lg text-left hover:bg-zinc-100 dark:hover:bg-[#272727] transition-colors duration-300 cursor-pointer flex items-start gap-3"
          >
            <SparklesIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 block">
                AI สร้างข้อสอบจากเอกสาร
              </span>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">สรุปเนื้อหาและออกโจทย์ใหม่อัตโนมัติ</p>
            </div>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={onOpenAuditor}
            className="w-full px-3 py-2.5 rounded-lg text-left hover:bg-zinc-100 dark:hover:bg-[#272727] transition-colors duration-300 cursor-pointer flex items-start gap-3"
          >
            <ShieldCheckIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI ตรวจทานเฉลย</span>
                {hasFlagged && (
                  <span className="px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold tabular-nums">
                    {flaggedCounts.categoryFlagged > 0 ? flaggedCounts.categoryFlagged : flaggedCounts.totalFlagged} ข้อ
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">สแกนและคัดกรองเฉลยที่อาจผิดพลาด</p>
            </div>
          </button>

          <div className="my-1 border-t border-zinc-200 dark:border-[#272727]" />

          <button
            type="button"
            role="menuitem"
            onClick={onOpenBulkImport}
            className="w-full px-3 py-2.5 rounded-lg text-left hover:bg-zinc-100 dark:hover:bg-[#272727] transition-colors duration-300 cursor-pointer flex items-start gap-3"
          >
            <UploadBoltIcon className="w-4 h-4 text-zinc-500 dark:text-zinc-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 block">
                นำเข้าชุดใหญ่ (วางข้อความ)
              </span>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">วางโจทย์แบบชุดเพื่อแปลงลงคลังเร็ว</p>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
