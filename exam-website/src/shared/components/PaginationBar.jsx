export default function PaginationBar({
  totalCount,
  currentPage,
  totalPages,
  startItemNumber,
  endItemNumber,
  pageJumpInput,
  setPageJumpInput,
  questionJumpInput,
  setQuestionJumpInput,
  onPageChange,
  onPageJumpSubmit,
  onQuestionJumpSubmit
}) {
  if (totalCount <= 5) return null

  return (
    <nav
      aria-label="เปลี่ยนหน้าข้อสอบ"
      className="bg-white dark:bg-[#181818] px-4 sm:px-5 py-3.5 rounded-2xl border border-zinc-200 dark:border-[#272727] flex flex-col xl:flex-row items-center justify-between gap-3"
    >
      <div className="text-xs text-zinc-500 dark:text-zinc-400 text-center xl:text-left shrink-0 tabular-nums">
        แสดงข้อที่ <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{startItemNumber}</strong> ถึง{' '}
        <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{endItemNumber}</strong> จากทั้งหมด{' '}
        <strong className="font-semibold text-indigo-600 dark:text-indigo-400">
          {totalCount.toLocaleString('th-TH')}
        </strong>{' '}
        ข้อ
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5 w-full xl:w-auto min-w-0">
        {totalPages > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1F1F1F] dark:hover:bg-[#272727] disabled:opacity-35 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-semibold transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
            >
              ก่อนหน้า
            </button>

            <div className="flex items-center gap-1 px-0.5">
              {[...Array(totalPages)].map((_, idx) => {
                const pageNum = idx + 1
                if (
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button
                      type="button"
                      key={pageNum}
                      onClick={() => onPageChange(pageNum)}
                      aria-current={currentPage === pageNum ? 'page' : undefined}
                      className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold tabular-nums transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer flex items-center justify-center ${
                        currentPage === pageNum
                          ? 'bg-indigo-600 text-white'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-[#272727]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                }
                if (
                  (pageNum === currentPage - 2 && pageNum > 1) ||
                  (pageNum === currentPage + 2 && pageNum < totalPages)
                ) {
                  return (
                    <span key={pageNum} className="text-zinc-400 dark:text-zinc-600 px-1 text-xs">
                      ...
                    </span>
                  )
                }
                return null
              })}
            </div>

            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-8 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1F1F1F] dark:hover:bg-[#272727] disabled:opacity-35 text-zinc-700 dark:text-zinc-200 rounded-lg text-xs font-semibold transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
            >
              ถัดไป
            </button>
          </div>
        )}

        {totalPages > 1 && <span className="h-4 w-px bg-zinc-200 dark:bg-[#272727] hidden lg:inline-block shrink-0" />}

        <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
          {totalPages > 1 && (
            <form
              onSubmit={onPageJumpSubmit}
              className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#1F1F1F] p-1 pl-2.5 rounded-xl border border-zinc-200 dark:border-[#272727] shrink-0"
            >
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">หน้า</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                placeholder={String(currentPage)}
                value={pageJumpInput}
                onChange={(e) => setPageJumpInput(e.target.value)}
                aria-label="ไปที่หน้า"
                className="w-12 h-7 bg-white dark:bg-[#181818] border border-zinc-200 dark:border-[#313131] rounded-lg text-xs font-semibold tabular-nums text-center text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">/{totalPages}</span>
              <button
                type="submit"
                className="h-7 px-2.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-[#272727] dark:hover:bg-[#313131] text-zinc-800 dark:text-zinc-100 font-semibold rounded-lg text-xs transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
              >
                ไป
              </button>
            </form>
          )}

          <form
            onSubmit={onQuestionJumpSubmit}
            className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#1F1F1F] p-1 pl-2.5 rounded-xl border border-zinc-200 dark:border-[#272727] shrink-0"
          >
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">ข้อที่</span>
            <input
              type="number"
              min="1"
              max={totalCount}
              placeholder="15"
              value={questionJumpInput}
              onChange={(e) => setQuestionJumpInput(e.target.value)}
              aria-label="ไปที่ข้อสอบหมายเลข"
              className="w-14 h-7 bg-white dark:bg-[#181818] border border-zinc-200 dark:border-[#313131] rounded-lg text-xs font-semibold tabular-nums text-center text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">/{totalCount}</span>
            <button
              type="submit"
              className="h-7 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
            >
              ไป
            </button>
          </form>
        </div>
      </div>
    </nav>
  )
}
