import Navbar from '../common/Navbar'

export default function ExamHeader({
  categoryName,
  questionsLength,
  examPhase,
  score,
  answeredCount,
  isAllAnswered,
  totalTimeSeconds,
  timeLeft,
  timePercent,
  isTimeCritical,
  formatTime,
  onBackNavigation
}) {
  return (
      <Navbar
        showNavPills={false}
        customLeftContent={
          <div className="flex items-center gap-2 sm:gap-4 shrink-0 min-w-0">
            <button onClick={onBackNavigation} className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 rounded-xl flex items-center justify-center text-sm font-bold transition-all cursor-pointer shadow-2xs shrink-0" title="กลับไปเลือกวิชา">←</button>
            <div className="min-w-0">
              <span className="font-black text-sm sm:text-lg text-slate-900 tracking-tight block truncate">{categoryName}</span>
              <span className="block text-[10px] sm:text-[11px] font-bold text-teal-600 -mt-0.5 tracking-wide truncate flex items-center gap-1.5">
                <span>📝 โหมดทดสอบ</span><span className="w-1 h-1 rounded-full bg-teal-300"></span><span>{questionsLength} ข้อ</span>
              </span>
            </div>
          </div>
        }
        customRightContent={
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {examPhase === 'submitted' ? (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 sm:px-5 py-2 rounded-xl font-black text-xs sm:text-sm shadow-md flex items-center gap-1.5 shrink-0 animate-fadeIn">
                <span>🏆</span><span className="hidden sm:inline">ผลการสอบ:</span><span className="text-sm sm:text-base underline decoration-2">{score}</span><span>/{questionsLength}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 sm:p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs shrink-0">
                {totalTimeSeconds > 0 && (
                  <div className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl font-mono font-black text-xs sm:text-sm flex items-center gap-1.5 transition-colors shadow-sm border ${isTimeCritical ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-white text-slate-700 border-slate-200'}`}>
                    <span>⏳</span><span>{formatTime(timeLeft)}</span>
                  </div>
                )}
                <div className="bg-white border border-slate-200 text-slate-600 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm shrink-0">
                  <span className={`w-2 h-2 rounded-full inline-block ${isAllAnswered ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`}></span>
                  <span className="hidden sm:inline">ทำแล้ว</span>
                  <span><strong className="text-teal-600 font-mono text-xs sm:text-sm">{answeredCount}</strong>/{questionsLength}</span>
                </div>
              </div>
            )}
          </div>
        }
        customBottomContent={examPhase === 'testing' && (
          <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${totalTimeSeconds > 0 && isTimeCritical ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${totalTimeSeconds > 0 ? timePercent : 100}%` }}
            />
          </div>
        )}
      />
  )
}
