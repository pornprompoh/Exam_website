import Navbar from '../../../shared/components/Navbar'
import { CheckCircleIcon } from '../../../shared/components/AdminIcons'

function ArrowLeftIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  )
}

function ClockIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

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
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 min-w-0">
          <button
            type="button"
            onClick={onBackNavigation}
            aria-label="กลับไปเลือกวิชา"
            title="กลับไปเลือกวิชา"
            className="w-9 h-9 bg-zinc-100 dark:bg-[#1F1F1F] hover:bg-rose-50 dark:hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-[#272727] rounded-xl flex items-center justify-center transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer shrink-0"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <span className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 tracking-tight block truncate">
              {categoryName}
            </span>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1.5">
              <span>โหมดทดสอบ</span>
              <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <span className="font-mono tabular-nums">{questionsLength.toLocaleString()} ข้อ</span>
            </span>
          </div>
        </div>
      }
      customRightContent={
        <div className="flex items-center gap-2 shrink-0">
          {examPhase === 'submitted' ? (
            <div className="bg-emerald-600 text-white px-3.5 sm:px-4 py-1.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-1.5 shrink-0 animate-fadeIn">
              <CheckCircleIcon className="w-4 h-4" />
              <span className="hidden sm:inline">ผลการสอบ</span>
              <span className="font-mono tabular-nums font-bold">
                {score.toLocaleString()}/{answeredCount.toLocaleString()}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-[#1F1F1F] p-1 rounded-xl border border-zinc-200 dark:border-[#272727] shrink-0">
              {totalTimeSeconds > 0 && (
                <div
                  className={`px-2.5 py-1 rounded-lg font-mono tabular-nums font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors border ${
                    isTimeCritical
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white dark:bg-[#272727] text-zinc-800 dark:text-zinc-100 border-zinc-200 dark:border-[#313131]'
                  }`}
                >
                  <ClockIcon className="w-3.5 h-3.5" />
                  <span>{formatTime(timeLeft)}</span>
                </div>
              )}
              <div className="bg-white dark:bg-[#272727] border border-zinc-200 dark:border-[#313131] text-zinc-600 dark:text-zinc-300 px-2.5 py-1 rounded-lg font-medium text-xs sm:text-sm flex items-center gap-1.5 shrink-0">
                <span
                  className={`w-2 h-2 rounded-full inline-block shrink-0 ${
                    isAllAnswered ? 'bg-emerald-500' : 'bg-indigo-500'
                  }`}
                />
                <span className="hidden sm:inline">ทำแล้ว</span>
                <span className="font-mono tabular-nums">
                  <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">
                    {answeredCount.toLocaleString()}
                  </strong>
                  /{questionsLength.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      }
      customBottomContent={
        examPhase === 'testing' && (
          <div className="w-full h-1 bg-zinc-200/80 dark:bg-[#272727] overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ease-premium ${
                totalTimeSeconds > 0 && isTimeCritical
                  ? 'bg-rose-500'
                  : 'bg-indigo-600 dark:bg-indigo-500'
              }`}
              style={{ width: `${totalTimeSeconds > 0 ? timePercent : 100}%` }}
            />
          </div>
        )
      }
    />
  )
}
