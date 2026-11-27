export default function SubjectCard({ category, onStartExam }) {
  const hasQuestions = category.questionCount > 0
  const subjectCode = category.id ? category.id.substring(0, 6).toUpperCase() : '000000'

  return (
    <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col justify-between space-y-6 group">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0 font-bold border border-indigo-100 group-hover:scale-105 transition-transform">
              📖
            </span>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 break-words [word-break:break-word] group-hover:text-indigo-600 transition-colors">
                {category.name}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-[11px] font-semibold text-indigo-500 uppercase tracking-wider">
                  SUBJECT CODE: <span className="font-mono">#{subjectCode}</span>
                </span>
                {hasQuestions ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    พร้อมสอบ
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    รอเพิ่มโจทย์
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed pl-14 break-words [word-break:break-word]">
          {category.description || 'ไม่มีคำอธิบายสำหรับหมวดหมู่วิชานี้'}
        </p>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-4 pl-0 sm:pl-14">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 min-w-0">
          <span className="whitespace-nowrap">📝 มีข้อสอบ</span>
          <span className="font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
            {category.questionCount}
          </span>
          <span>ข้อ</span>
        </div>

        {hasQuestions ? (
          <button
            type="button"
            onClick={() => onStartExam(category)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow-indigo-200 dark:hover:shadow-none transition-all cursor-pointer shrink-0"
          >
            <span>🚀</span>
            <span className="whitespace-nowrap">เริ่มทำข้อสอบ</span>
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-400 font-medium text-sm rounded-xl cursor-not-allowed border border-slate-200 dark:border-slate-700 shrink-0"
          >
            ยังไม่มีข้อสอบ
          </button>
        )}
      </div>
    </div>
  )
}
