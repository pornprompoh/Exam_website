import React from 'react'

export default function LoadingScreen({ text = 'กำลังจัดเตรียมข้อมูล กรุณารอสักครู่...' }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 font-sans text-center">
      <div className="w-14 h-14 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center text-2xl animate-bounce mb-4">
        ⌛
      </div>
      <p className="text-slate-700 font-extrabold text-base">{text}</p>
      <p className="text-slate-400 text-xs mt-1">ระบบกำลังประมวลผลข้อมูลมาตรฐานให้คุณครับ</p>
    </div>
  )
}