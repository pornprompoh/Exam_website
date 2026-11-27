import { FileExtractIcon } from '../../../shared/components/AdminIcons'

function CalendarIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

export default function RecentExamLogs({ sessions }) {
  return (
    <section className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-200 dark:border-[#272727]">
        <h2 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 tracking-tight">
          ประวัติการสอบล่าสุด
        </h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
          ทั้งหมด {sessions.length.toLocaleString()} รายการ
        </span>
      </div>

      <div className="bg-white dark:bg-[#181818] rounded-2xl border border-zinc-200 dark:border-[#272727] overflow-hidden min-w-0 transition-colors duration-300">
        <div className="divide-y divide-zinc-100 dark:divide-[#272727] min-w-0">
          {sessions.map((sess) => {
            const totalQ = sess.total_questions || 0
            const sc = sess.score || 0
            const pct = totalQ > 0 ? Math.round((sc / totalQ) * 100) : 0

            let scoreBadge =
              'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25'
            if (pct < 50) {
              scoreBadge =
                'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/25'
            } else if (pct < 80) {
              scoreBadge =
                'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/25'
            }

            return (
              <div
                key={sess.id}
                className="p-4 sm:p-5 hover:bg-zinc-50 dark:hover:bg-[#1F1F1F] transition-colors duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0"
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-[#1F1F1F] border border-zinc-200 dark:border-[#272727] text-zinc-600 dark:text-zinc-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                    <FileExtractIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm sm:text-base truncate">
                      {sess.categories?.name || 'หมวดวิชาทั่วไป'}
                    </h4>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums inline-flex items-center gap-1.5 mt-0.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>
                        {new Date(sess.completed_at).toLocaleDateString('th-TH', {
                          year: '2-digit',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}{' '}
                        น.
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto pt-2.5 sm:pt-0 border-t sm:border-0 border-zinc-100 dark:border-[#272727] shrink-0">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:hidden">
                    ผลคะแนนที่ได้
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium hidden sm:inline">
                      คะแนน
                    </span>
                    <span
                      className={`px-3 py-1 rounded-md text-xs sm:text-sm font-semibold font-mono tabular-nums border inline-flex items-center gap-1.5 ${scoreBadge}`}
                    >
                      <span>
                        {sc.toLocaleString()}/{totalQ.toLocaleString()}
                      </span>
                      <span className="text-xs opacity-85">({pct}%)</span>
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
