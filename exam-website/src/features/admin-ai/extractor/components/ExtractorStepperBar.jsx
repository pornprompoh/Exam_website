const PIPELINE_STEPS = [
  { pass: 1, label: 'ขั้น 1/3', title: 'สกัดโจทย์และเฉลย (Flash Lite)' },
  { pass: 2, label: 'ขั้น 2/3', title: 'จับคู่เฉลยหนังสือทั้งไฟล์' },
  { pass: 3, label: 'ขั้น 3/3', title: 'ตรวจเฉลยและฟันธง (Hybrid)' }
]

export default function ExtractorStepperBar({ isExtracting, progress, stats, activePass, progressPercent }) {
  if (!isExtracting && !progress) return null

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-[#272727] bg-zinc-50 dark:bg-[#1F1F1F] p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {PIPELINE_STEPS.map((step) => {
          const isCompleted = progress?.status === 'completed' || activePass > step.pass
          const isCurrent = !isCompleted && activePass === step.pass

          return (
            <div
              key={step.pass}
              className={`rounded-xl border px-3 py-2 flex items-center gap-2.5 transition-colors duration-300 ${
                isCompleted
                  ? 'border-emerald-200 dark:border-emerald-500/35 bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
                  : isCurrent
                    ? 'border-indigo-300 dark:border-indigo-500/50 bg-indigo-50/80 dark:bg-indigo-500/15 text-indigo-950 dark:text-zinc-100'
                    : 'border-zinc-200 dark:border-[#272727] bg-white dark:bg-[#181818] text-zinc-400 dark:text-zinc-500'
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold tabular-nums ${
                  isCompleted
                    ? 'bg-emerald-600 text-white'
                    : isCurrent
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-200 dark:bg-[#272727] text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {isCompleted ? '✓' : step.pass}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium opacity-75">
                  {step.label}
                  {isCurrent && step.pass === 3 && progress?.pass3Stage ? ` · Stage ${progress.pass3Stage}` : ''}
                </p>
                <p className="text-xs font-semibold truncate">{step.title}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {isExtracting && (
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse shrink-0" />
            )}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
              {progress?.statusMessage || 'กำลังเตรียมประมวลผล...'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {progress?.activeModelLabel && (
              <span className="rounded-md border border-indigo-200 dark:border-indigo-500/35 bg-indigo-50 dark:bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-200">
                {progress.activeModelLabel}
              </span>
            )}
            {progress?.adaptiveDelayMs > 0 && isExtracting && (
              <span className="rounded-md border border-zinc-200 dark:border-[#313131] bg-white dark:bg-[#181818] px-2 py-0.5 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                RPM {(progress.adaptiveDelayMs / 1000).toFixed(1)}s
              </span>
            )}
            <span className="font-bold tabular-nums text-indigo-700 dark:text-indigo-300">{progressPercent}%</span>
          </div>
        </div>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-[#272727]"
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ease-premium ${
              progress?.status === 'error'
                ? 'bg-rose-500'
                : progress?.status === 'paused'
                  ? 'bg-amber-500'
                  : 'bg-indigo-600 dark:bg-indigo-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {stats?.fallbackTriggered && stats?.fallbackNotice && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-200">
            Auto-Fallback: {stats.fallbackNotice}
          </div>
        )}
      </div>
    </div>
  )
}
