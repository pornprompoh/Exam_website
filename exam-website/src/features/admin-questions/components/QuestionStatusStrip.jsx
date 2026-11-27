import { FlagIcon, InboxIcon } from '../../../shared/components/AdminIcons'

export default function QuestionStatusStrip({
  hasFlagged,
  hasDrafts,
  flaggedCounts,
  stagingCount,
  onOpenFlaggedAuditor,
  onOpenStagingExtractor,
  onRequestClearDrafts
}) {
  if (!hasFlagged && !hasDrafts) return null

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {hasFlagged && (
        <div className="flex-1 min-w-[260px] flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/80 dark:bg-rose-500/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <FlagIcon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <p className="text-xs sm:text-sm font-medium text-rose-900 dark:text-rose-200 truncate">
              พบเฉลยที่อาจผิด:{' '}
              <strong className="font-bold tabular-nums">
                {flaggedCounts.categoryFlagged > 0
                  ? `วิชานี้ ${flaggedCounts.categoryFlagged} ข้อ`
                  : `ทั้งระบบ ${flaggedCounts.totalFlagged} ข้อ`}
              </strong>
              {flaggedCounts.categoryFlagged > 0 && flaggedCounts.totalFlagged > flaggedCounts.categoryFlagged && (
                <span className="text-rose-700/80 dark:text-rose-300/80 ml-1 tabular-nums">
                  (ทั้งระบบ {flaggedCounts.totalFlagged} ข้อ)
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenFlaggedAuditor}
            className="h-8 px-3 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shrink-0"
          >
            ตรวจรายการ
          </button>
        </div>
      )}

      {hasDrafts && (
        <div className="flex-1 min-w-[260px] flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/80 dark:bg-amber-500/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <InboxIcon className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <p className="text-xs sm:text-sm font-medium text-amber-950 dark:text-amber-200 truncate">
              ข้อสอบ Draft รอตรวจสอบ: <strong className="font-bold tabular-nums">{stagingCount} ข้อ</strong>
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenStagingExtractor}
              className="h-8 px-3 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors cursor-pointer"
            >
              เปิดตรวจ
            </button>
            <button
              type="button"
              onClick={onRequestClearDrafts}
              className="h-8 px-2.5 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors cursor-pointer"
            >
              ล้าง
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
