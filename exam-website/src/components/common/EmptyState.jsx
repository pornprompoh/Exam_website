import React from 'react'

export default function EmptyState({ 
  icon = '🔍', 
  title = 'ไม่พบข้อมูลครับ', 
  description = 'ลองตรวจสอบเงื่อนไขการค้นหาอีกครั้ง หรือลองรีเซ็ตตัวกรองใหม่นะครับ',
  actionText = null,
  onAction = null 
}) {
  return (
    <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm max-w-md mx-auto my-8 animate-fadeIn">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">
        {icon}
      </div>
      <p className="font-bold text-slate-800 text-base">{title}</p>
      <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">{description}</p>
      
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-6 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm hover:shadow cursor-pointer inline-flex items-center gap-1.5"
        >
          <span>🔄</span>
          <span>{actionText}</span>
        </button>
      )}
    </div>
  )
}