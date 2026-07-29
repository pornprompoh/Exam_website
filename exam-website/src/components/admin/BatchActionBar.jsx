import React from 'react'

export default function BatchActionBar({
  selectedCount,
  itemName = 'รายการ', // เช่น 'หมวด' หรือ 'ข้อ'
  onClearSelection,
  onToggleStatus, // ฟังก์ชันเปิด/ปิดสถานะ
  onMove, // ฟังก์ชันย้ายหมวด (ถ้าไม่ส่งมา ปุ่มนี้จะซ่อนอัตโนมัติ)
  onDelete
}) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0A0F1C] border border-slate-700/80 shadow-2xl shadow-black/80 rounded-full px-3 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-center gap-3 sm:gap-4 animate-fadeIn whitespace-nowrap w-[95%] sm:w-auto overflow-x-auto">
      
      {/* ส่วนซ้าย: จำนวนที่เลือก และ ปุ่มยกเลิก */}
      <div className="flex items-center gap-3 sm:gap-4 sm:border-r border-slate-700/80 pr-2 sm:pr-4 pl-1">
        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-600 text-white font-black rounded-full flex items-center justify-center text-sm shadow-inner shadow-indigo-400/20 shrink-0">
          {selectedCount}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs sm:text-sm font-bold text-white tracking-tight">รายการที่เลือก</span>
          <button onClick={onClearSelection} className="text-[10px] sm:text-xs font-bold text-slate-400 hover:text-white underline transition-colors cursor-pointer">
            ยกเลิกทั้งหมด
          </button>
        </div>
      </div>
      
      {/* ส่วนขวา: ชุดปุ่ม Actions ต่างๆ */}
      <div className="flex items-center gap-2 shrink-0 pr-1">
        
        {/* กลุ่มปุ่ม เปิด/ซ่อน ฉบับร่าง */}
        {onToggleStatus && (
          <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-full overflow-hidden p-1 shadow-inner">
            <button 
              onClick={() => onToggleStatus(true)} 
              className="px-2.5 sm:px-3 py-1.5 hover:bg-indigo-500/10 text-indigo-400 rounded-full text-[10px] sm:text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="bg-indigo-500 text-white w-4 h-4 flex items-center justify-center rounded-sm text-[8px] sm:text-[10px]">▶</span> 
              <span>เปิดใช้งาน</span>
            </button>
            <div className="w-px h-4 bg-slate-700 mx-0.5 sm:mx-1"></div>
            <button 
              onClick={() => onToggleStatus(false)} 
              className="px-2.5 sm:px-3 py-1.5 hover:bg-slate-800 text-slate-400 rounded-full text-[10px] sm:text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="bg-slate-500 text-white w-4 h-4 flex items-center justify-center rounded-sm text-[8px] sm:text-[10px]">⏸</span> 
              <span>ซ่อนฉบับร่าง</span>
            </button>
          </div>
        )}
        
        {/* ปุ่มย้ายหมวดวิชา (แสดงเฉพาะเมื่อหน้าเพจนั้นส่งฟังก์ชัน onMove มาให้) */}
        {onMove && (
          <button 
            onClick={onMove}
            className="px-3 sm:px-4 py-2 bg-indigo-900/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 rounded-full text-[10px] sm:text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="text-xs sm:text-sm">📁</span> <span>ย้ายหมวดวิชา</span>
          </button>
        )}

        {/* ปุ่มลบ */}
        {onDelete && (
          <button 
            onClick={onDelete} 
            className="px-3 sm:px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-full text-[10px] sm:text-xs font-bold shadow-lg shadow-red-500/20 flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <span className="text-xs sm:text-sm">🗑️</span> <span>ลบ ({selectedCount}) {itemName}</span>
          </button>
        )}
      </div>

    </div>
  )
}