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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] sm:w-auto max-w-4xl animate-slideUp">
      <div className="bg-white/95 dark:bg-[#181818]/95 backdrop-blur-md border border-zinc-200 dark:border-[#313131] shadow-2xl shadow-zinc-900/12 dark:shadow-black/60 rounded-2xl px-4 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-center gap-3">
        <div className="flex items-center gap-2.5 sm:border-r border-zinc-200 dark:border-[#272727] sm:pr-4">
          <span className="min-w-7 h-7 px-2 bg-indigo-600 text-white font-semibold rounded-lg flex items-center justify-center text-xs tabular-nums shrink-0">
            {selectedCount}
          </span>
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 whitespace-nowrap">เลือกอยู่</span>
          <button
            type="button"
            onClick={onClearSelection}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 underline underline-offset-4 transition-colors duration-300 cursor-pointer whitespace-nowrap"
          >
            ล้าง
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          {onToggleStatus && (
            <div className="inline-flex items-center bg-zinc-100 dark:bg-[#1F1F1F] border border-zinc-200 dark:border-[#272727] rounded-xl p-1">
              <button
                type="button"
                onClick={() => onToggleStatus(true)}
                className="px-2.5 py-1 hover:bg-white dark:hover:bg-[#272727] text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-semibold transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer whitespace-nowrap"
              >
                เปิดใช้งาน
              </button>
              <span className="w-px h-3.5 bg-zinc-200 dark:bg-[#313131] mx-1" />
              <button
                type="button"
                onClick={() => onToggleStatus(false)}
                className="px-2.5 py-1 hover:bg-white dark:hover:bg-[#272727] text-zinc-600 dark:text-zinc-300 rounded-lg text-xs font-semibold transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer whitespace-nowrap"
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
              className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1F1F1F] dark:hover:bg-[#272727] text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-[#272727] rounded-xl text-xs font-semibold transition-all duration-300 ease-premium active:scale-[0.98] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FolderIcon className="w-3.5 h-3.5" />
              <span>ย้ายหมวดวิชา</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all duration-300 ease-premium active:scale-[0.98] whitespace-nowrap"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              <span>
                ลบ ({selectedCount}) {itemName}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
