export default function SubjectPerformanceGrid({ subjectStats }) {
  return (
    <section className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-200 dark:border-[#272727]">
        <h2 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 tracking-tight">
          ประสิทธิภาพแยกตามหมวดวิชา
        </h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          เรียงตามจำนวนข้อที่ทำมากที่สุด
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 min-w-0">
        {subjectStats.map((sub, idx) => {
          const performance =
            sub.accuracy >= 80
              ? {
                  badgeStyle:
                    'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25',
                  barColor: 'bg-emerald-500',
                  statusText: 'จุดแข็ง (ทำได้ดีมาก)'
                }
              : sub.accuracy >= 60
                ? {
                    badgeStyle:
                      'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/25',
                    barColor: 'bg-indigo-500',
                    statusText: 'มาตรฐาน (ผ่านเกณฑ์)'
                  }
                : {
                    badgeStyle:
                      'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/25',
                    barColor: 'bg-rose-500',
                    statusText: 'ควรทบทวนเพิ่ม'
                  }

          return (
            <article
              key={idx}
              className="bg-white dark:bg-[#181818] p-5 sm:p-6 rounded-2xl border border-zinc-200 dark:border-[#272727] space-y-4 min-w-0 transition-colors duration-300"
            >
              <div className="flex items-start justify-between gap-3 min-w-0">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 font-mono tabular-nums block mb-0.5">
                    วิชาที่ {idx + 1}
                  </span>
                  <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {sub.name}
                  </h3>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border shrink-0 ${performance.badgeStyle}`}
                >
                  {performance.statusText}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-zinc-500 dark:text-zinc-400">ความแม่นยำ</span>
                  <span className="font-mono tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                    {sub.accuracy}%
                  </span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-[#272727] h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-premium ${performance.barColor}`}
                    style={{ width: `${Math.max(4, sub.accuracy)}%` }}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-[#272727] grid grid-cols-3 gap-2.5 text-center">
                <div className="bg-zinc-50 dark:bg-[#1F1F1F] border border-zinc-200/70 dark:border-[#272727] p-2.5 rounded-xl">
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400 font-medium">เข้าสอบ</span>
                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 font-mono tabular-nums mt-0.5 block">
                    {sub.sessions.toLocaleString()} รอบ
                  </span>
                </div>
                <div className="bg-zinc-50 dark:bg-[#1F1F1F] border border-zinc-200/70 dark:border-[#272727] p-2.5 rounded-xl">
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400 font-medium">ทำไปแล้ว</span>
                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 font-mono tabular-nums mt-0.5 block">
                    {sub.questions.toLocaleString()} ข้อ
                  </span>
                </div>
                <div className="bg-zinc-50 dark:bg-[#1F1F1F] border border-zinc-200/70 dark:border-[#272727] p-2.5 rounded-xl">
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400 font-medium">คะแนนรวม</span>
                  <span className="font-semibold text-sm text-indigo-600 dark:text-indigo-400 font-mono tabular-nums mt-0.5 block">
                    {sub.score.toLocaleString()} แต้ม
                  </span>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
