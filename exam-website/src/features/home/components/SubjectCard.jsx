function BookOpenIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

function ArrowRightIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  )
}

export default function SubjectCard({ category, onStartExam }) {
  const hasQuestions = category.questionCount > 0
  const subjectCode = category.id ? category.id.substring(0, 6).toUpperCase() : '000000'

  return (
    <article className="bg-white dark:bg-[#181818] p-5 sm:p-6 rounded-2xl border border-zinc-200 dark:border-[#272727] hover:border-zinc-300 dark:hover:border-[#313131] hover:shadow-sm transition-all duration-300 ease-premium flex flex-col justify-between gap-5 group">
      <div className="space-y-3">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-500/20">
            <BookOpenIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 break-words [word-break:break-word] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {category.name}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                #{subjectCode}
              </span>
              {hasQuestions ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  พร้อมสอบ
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  รอเพิ่มโจทย์
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed break-words [word-break:break-word]">
          {category.description || 'ไม่มีคำอธิบายสำหรับหมวดหมู่วิชานี้'}
        </p>
      </div>

      <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-[#272727] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 min-w-0">
          <span className="whitespace-nowrap">จำนวนข้อสอบ</span>
          <span className="font-semibold font-mono tabular-nums text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-[#272727] px-2.5 py-0.5 rounded-md">
            {Number(category.questionCount || 0).toLocaleString()}
          </span>
          <span>ข้อ</span>
        </div>

        {hasQuestions ? (
          <button
            type="button"
            onClick={() => onStartExam(category)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold text-sm rounded-xl transition-all duration-300 ease-premium cursor-pointer shrink-0"
          >
            <span className="whitespace-nowrap">เริ่มทำข้อสอบ</span>
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex items-center px-4 py-2 bg-zinc-100 dark:bg-[#1F1F1F] text-zinc-400 dark:text-zinc-500 font-medium text-sm rounded-xl cursor-not-allowed border border-zinc-200 dark:border-[#272727] shrink-0"
          >
            ยังไม่มีข้อสอบ
          </button>
        )}
      </div>
    </article>
  )
}
