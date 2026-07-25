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
    <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 flex flex-col xl:flex-row items-center justify-between gap-4 mt-6">
      
      <div className="text-xs font-semibold text-slate-400 text-center xl:text-left shrink-0">
        แสดงข้อที่ <strong className="text-white font-mono">{startItemNumber}</strong> - <strong className="text-white font-mono">{endItemNumber}</strong> จากทั้งหมด <strong className="text-indigo-400 font-mono">{totalCount}</strong> ข้อ
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 w-full xl:w-auto min-w-0">
        
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              ← ก่อนหน้า
            </button>

            <div className="flex items-center gap-1 px-1">
              {[...Array(totalPages)].map((_, idx) => {
                const pageNum = idx + 1
                if (
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => onPageChange(pageNum)}
                      className={`w-8 h-8 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center ${
                        currentPage === pageNum
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                } else if (
                  (pageNum === currentPage - 2 && pageNum > 1) ||
                  (pageNum === currentPage + 2 && pageNum < totalPages)
                ) {
                  return <span key={pageNum} className="text-slate-600 px-1 font-mono text-xs">...</span>
                }
                return null
              })}
            </div>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              ถัดไป →
            </button>
          </div>
        )}

        {totalPages > 1 && <span className="text-slate-700 hidden lg:inline shrink-0">|</span>}

        {/* 🌟 กล่องค้นหาคู่: ไปหน้า (Page Jumper) & ไปข้อที่ (Question Jumper) */}
        <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
          
          {totalPages > 1 && (
            <form onSubmit={onPageJumpSubmit} className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 shrink-0">
              <span className="text-xs font-bold text-slate-400">📄 หน้า:</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                placeholder={String(currentPage)}
                value={pageJumpInput}
                onChange={(e) => setPageJumpInput(e.target.value)}
                className="w-12 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-center text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-500 font-mono">/{totalPages}</span>
              <button
                type="submit"
                className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-all cursor-pointer"
              >
                ไป
              </button>
            </form>
          )}

          <form onSubmit={onQuestionJumpSubmit} className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 shrink-0">
            <span className="text-xs font-bold text-slate-400">🎯 ข้อที่:</span>
            <input
              type="number"
              min="1"
              max={totalCount}
              placeholder="เช่น 15"
              value={questionJumpInput}
              onChange={(e) => setQuestionJumpInput(e.target.value)}
              className="w-14 py-0.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-center text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="text-xs text-slate-500 font-mono">/{totalCount}</span>
            <button
              type="submit"
              className="px-2.5 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-xs transition-all cursor-pointer shadow-xs"
            >
              ไป
            </button>
          </form>

        </div>

      </div>

    </div>
  )
}