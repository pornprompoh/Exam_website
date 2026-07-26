export default function EmptyState({ 
  icon = "📁", 
  title = "ไม่มีข้อมูล", 
  description = "ยังไม่พบข้อมูลในรายการนี้ครับ", 
  theme = "light" // 🌟 เพิ่ม prop รองรับ 'light' หรือ 'dark'
}) {
  const isDark = theme === 'dark'

  return (
    <div className={`rounded-3xl p-8 sm:p-12 text-center border transition-all duration-300 max-w-lg mx-auto my-6 animate-fadeIn ${
      isDark 
        ? 'bg-slate-900 border-slate-800 text-white shadow-2xl shadow-indigo-500/5' 
        : 'bg-white border-slate-200/80 text-slate-800 shadow-sm'
    }`}>
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border transition-transform hover:scale-110 ${
        isDark 
          ? 'bg-slate-950 border-slate-800 text-indigo-400 shadow-inner' 
          : 'bg-slate-50 border-slate-100 text-indigo-600 shadow-inner'
      }`}>
        {icon}
      </div>
      
      <h3 className={`text-lg font-black mb-2 tracking-tight ${
        isDark ? 'text-white' : 'text-slate-900'
      }`}>
        {title}
      </h3>
      
      <p className={`text-xs sm:text-sm leading-relaxed ${
        isDark ? 'text-slate-400' : 'text-slate-500'
      }`}>
        {description}
      </p>
    </div>
  )
}