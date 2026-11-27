import { FolderIcon, TrashIcon } from './AdminIcons'

export default function BatchActionBar({
  selectedCount,
  itemName = 'รายการ',
  onClearSelection,
  onToggleStatus,
  onMove,
  moveSlot = null,
  onDelete
}) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] sm:w-auto max-w-4xl animate-slideUp">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-2xl shadow-slate-900/15 dark:shadow-black/50 rounded-2xl px-3.5 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-center gap-3">
        {/* Selected count & clear */}
        <div className="flex items-center gap-2.5 sm:border-r border-slate-200 dark:border-slate-800 sm:pr-3.5">
          <span className="min-w-7 h-7 px-2 bg-indigo-600 text-white font-bold rounded-lg flex items-center justify-center text-xs tabular-nums shrink-0">
            {selectedCount}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
            เลือกอยู่
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white underline underline-offset-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            ล้างการเลือก
          </button>
        </div>

        {/* Batch actions */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {onToggleStatus && (
            <div className="inline-flex items-center bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => onToggleStatus(true)}
                className="px-2.5 py-1.5 hover:bg-white dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                เปิดใช้งาน
              </button>
              <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-800 mx-0.5" />
              <button
                type="button"
                onClick={() => onToggleStatus(false)}
                className="px-2.5 py-1.5 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                ซ่อนฉบับร่าง
              </button>
            </div>
          )}

          {moveSlot}

          {!moveSlot && onMove && (
            <button
              type="button"
              onClick={onMove}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FolderIcon className="w-3.5 h-3.5" />
              <span>ย้ายหมวดวิชา</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              <span>ลบ ({selectedCount}) {itemName}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
