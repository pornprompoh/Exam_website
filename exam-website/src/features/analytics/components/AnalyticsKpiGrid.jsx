export default function AnalyticsKpiGrid({ totalQuestions, totalSessions, overallAccuracy, resolvedRate }) {
  const cards = [
    {
      label: 'โจทย์ที่ฝึกทำไปแล้ว',
      icon: '📝',
      iconClass: 'bg-indigo-50 text-indigo-600',
      value: totalQuestions.toLocaleString(),
      caption: 'ข้อสอบทั้งหมดที่ผ่านมือ'
    },
    {
      label: 'รอบการเข้าสอบ',
      icon: '🏆',
      iconClass: 'bg-teal-50 text-teal-600',
      value: totalSessions.toLocaleString(),
      caption: 'ครั้งที่ทำแบบทดสอบเสร็จ'
    },
    {
      label: 'ความแม่นยำรวม',
      icon: '🎯',
      iconClass: 'bg-emerald-50 text-emerald-600',
      value: `${overallAccuracy}%`,
      caption: 'อัตราตอบถูกเฉลี่ยทุกวิชา'
    },
    {
      label: 'อัตราเคลียร์จุดอ่อน',
      icon: '💡',
      iconClass: 'bg-amber-50 text-amber-600',
      value: `${resolvedRate}%`,
      caption: 'ทบทวนข้อผิดในคลังแล้ว'
    }
  ]

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <h2 className="font-extrabold text-base sm:text-lg text-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-5 bg-red-600 rounded-full inline-block" />
          <span>ภาพรวมความคืบหน้า (Key Metrics)</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 min-w-0">
        {cards.map((card) => (
          <div key={card.label} className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-xs font-bold text-slate-400 truncate">{card.label}</span>
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 ${card.iconClass}`}>{card.icon}</span>
            </div>
            <div>
              <div className="text-2xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight">{card.value}</div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium truncate">{card.caption}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
