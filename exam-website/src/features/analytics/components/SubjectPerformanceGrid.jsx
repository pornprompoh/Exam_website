export default function SubjectPerformanceGrid({ subjectStats }) {
  return (
    <section className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <h2 className="font-extrabold text-base sm:text-lg text-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-5 bg-teal-600 rounded-full inline-block" />
          <span>ประสิทธิภาพแยกตามหมวดวิชา (Subject Performance)</span>
        </h2>
        <span className="text-xs text-slate-400 font-medium">เรียงตามจำนวนข้อที่ทำเยอะสุด</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 min-w-0">
        {subjectStats.map((sub, idx) => {
          const performance =
            sub.accuracy >= 80
              ? {
                  badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  barColor: 'from-teal-500 to-emerald-500',
                  statusText: '🔥 จุดแข็ง (ทำได้ดีมาก)'
                }
              : sub.accuracy >= 60
                ? {
                    badgeStyle: 'bg-teal-50 text-teal-700 border-teal-200',
                    barColor: 'from-cyan-500 to-teal-500',
                    statusText: '✨ มาตรฐาน (ผ่านเกณฑ์)'
                  }
                : {
                    badgeStyle: 'bg-red-50 text-red-700 border-red-200',
                    barColor: 'from-red-500 to-rose-500',
                    statusText: '⚠️ ควรทบทวนเพิ่ม'
                  }

          return (
            <div key={idx} className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 min-w-0">
              <div className="flex items-start justify-between gap-3 min-w-0">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-slate-400 font-mono block mb-0.5">SUBJECT #{idx + 1}</span>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">{sub.name}</h3>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${performance.badgeStyle}`}>
                  {performance.statusText}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-500">ความแม่นยำ (Accuracy)</span>
                  <span className="font-mono text-slate-900">{sub.accuracy}%</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${performance.barColor} transition-all duration-1000`}
                    style={{ width: `${Math.max(5, sub.accuracy)}%` }}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="block text-[10px] text-slate-400 font-bold">เข้าสอบ</span>
                  <span className="font-extrabold text-slate-800 font-mono">{sub.sessions} รอบ</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="block text-[10px] text-slate-400 font-bold">ทำไปแล้ว</span>
                  <span className="font-extrabold text-slate-800 font-mono">{sub.questions} ข้อ</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                  <span className="block text-[10px] text-slate-400 font-bold">คะแนนรวม</span>
                  <span className="font-extrabold text-teal-600 font-mono">{sub.score} แต้ม</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
