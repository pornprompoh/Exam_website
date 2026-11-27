import { CheckCircleIcon, FileExtractIcon, ShieldCheckIcon } from '../../../shared/components/AdminIcons'

function TargetIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  )
}

export default function AnalyticsKpiGrid({ totalQuestions, totalSessions, overallAccuracy, resolvedRate }) {
  const cards = [
    {
      label: 'โจทย์ที่ฝึกทำไปแล้ว',
      icon: <FileExtractIcon className="w-4 h-4" />,
      iconClass: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200/70 dark:border-indigo-500/20',
      value: totalQuestions.toLocaleString(),
      caption: 'ข้อสอบทั้งหมดที่ผ่านมือ'
    },
    {
      label: 'รอบการเข้าสอบ',
      icon: <ShieldCheckIcon className="w-4 h-4" />,
      iconClass: 'bg-zinc-100 dark:bg-[#1F1F1F] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-[#313131]',
      value: totalSessions.toLocaleString(),
      caption: 'ครั้งที่ทำแบบทดสอบเสร็จ'
    },
    {
      label: 'ความแม่นยำรวม',
      icon: <TargetIcon className="w-4 h-4" />,
      iconClass: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/70 dark:border-emerald-500/20',
      value: `${overallAccuracy}%`,
      caption: 'อัตราตอบถูกเฉลี่ยทุกวิชา'
    },
    {
      label: 'อัตราเคลียร์จุดอ่อน',
      icon: <CheckCircleIcon className="w-4 h-4" />,
      iconClass: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/70 dark:border-amber-500/20',
      value: `${resolvedRate}%`,
      caption: 'ทบทวนข้อผิดในคลังแล้ว'
    }
  ]

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-[#272727]">
        <h2 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 tracking-tight">
          ภาพรวมความคืบหน้า
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-[#181818] p-5 rounded-2xl border border-zinc-200 dark:border-[#272727] flex flex-col justify-between gap-3 min-w-0 transition-colors duration-300"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
                {card.label}
              </span>
              <span
                className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${card.iconClass}`}
              >
                {card.icon}
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 font-mono tabular-nums tracking-tight">
                {card.value}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">{card.caption}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
