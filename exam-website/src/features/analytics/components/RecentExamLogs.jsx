export default function RecentExamLogs({ sessions }) {
  return (
    <section className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <h2 className="font-extrabold text-base sm:text-lg text-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-5 bg-indigo-600 rounded-full inline-block" />
          <span>ประวัติการสอบล่าสุด (Recent Exam Logs)</span>
        </h2>
        <span className="text-xs text-slate-400 font-mono">ทั้งหมด {sessions.length} รายการ</span>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden min-w-0">
        <div className="divide-y divide-slate-100 min-w-0">
          {sessions.map((sess) => {
            const totalQ = sess.total_questions || 0
            const sc = sess.score || 0
            const pct = totalQ > 0 ? Math.round((sc / totalQ) * 100) : 0

            let scoreBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200'
            if (pct < 50) scoreBadge = 'bg-red-50 text-red-700 border-red-200'
            else if (pct < 80) scoreBadge = 'bg-amber-50 text-amber-800 border-amber-200'

            return (
              <div key={sess.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-lg shrink-0 mt-0.5 sm:mt-0">
                    📑
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                      {sess.categories?.name || 'หมวดวิชาทั่วไป'}
                    </h4>
                    <span className="text-xs text-slate-400 font-mono block mt-0.5">
                      📅{' '}
                      {new Date(sess.completed_at).toLocaleDateString('th-TH', {
                        year: '2-digit',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}{' '}
                      น.
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 shrink-0">
                  <div className="text-xs font-bold text-slate-500 sm:hidden">ผลคะแนนที่ได้:</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium hidden sm:inline">คะแนน:</span>
                    <span className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black font-mono border flex items-center gap-1.5 ${scoreBadge}`}>
                      <span>{sc}/{totalQ}</span>
                      <span className="text-[10px] opacity-80">({pct}%)</span>
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
