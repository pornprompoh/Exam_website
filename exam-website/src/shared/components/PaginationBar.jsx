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
    <div className="bg-white dark:bg-slate-900 px-4 sm:px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row items-center justify-between gap-3.5">
      <div className="text-xs text-slate-500 dark:text-slate-400 text-center xl:text-left shrink-0 tabular-nums">
        แสดงข้อที่ <strong className="font-semibold text-slate-900 dark:text-white">{startItemNumber}</strong>–<strong className="font-semibold text-slate-900 dark:text-white">{endItemNumber}</strong> จากทั้งหมด <strong className="font-semibold text-indigo-600 dark:text-indigo-400">{totalCount.toLocaleString('th-TH')}</strong> ข้อ
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2.5 w-full xl:w-auto min-w-0">
        {totalPages > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-35 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
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
                      className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer flex items-center justify-center ${
                        currentPage === pageNum
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
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
                  return <span key={pageNum} className="text-slate-400 dark:text-slate-600 px-1 text-xs">...</span>
                }
                return null
              })}
            </div>

            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-35 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              ถัดไป
            </button>
          </div>
        )}

        {totalPages > 1 && <span className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden lg:inline-block shrink-0" />}

        <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
          {totalPages > 1 && (
            <form onSubmit={onPageJumpSubmit} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">หน้า</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                placeholder={String(currentPage)}
                value={pageJumpInput}
                onChange={(e) => setPageJumpInput(e.target.value)}
                aria-label="ไปที่หน้า"
                className="w-12 h-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-semibold tabular-nums text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">/{totalPages}</span>
              <button
                type="submit"
                className="h-7 px-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold rounded-md text-xs transition-colors cursor-pointer"
              >
                ไป
              </button>
            </form>
          )}

          <form onSubmit={onQuestionJumpSubmit} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">ข้อที่</span>
            <input
              type="number"
              min="1"
              max={totalCount}
              placeholder="15"
              value={questionJumpInput}
              onChange={(e) => setQuestionJumpInput(e.target.value)}
              aria-label="ไปที่ข้อสอบหมายเลข"
              className="w-14 h-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-semibold tabular-nums text-center text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">/{totalCount}</span>
            <button
              type="submit"
              className="h-7 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md text-xs transition-colors cursor-pointer"
            >
              ไป
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
