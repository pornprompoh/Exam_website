import { useState } from 'react'
import LoadingScreen from '../common/LoadingScreen'
import EmptyState from '../common/EmptyState'

export default function QuestionList({
  questions,
  loading,
  userRole,
  totalCount,
  currentPage,
  sortOrder,
  highlightedNum,
  editingId,
  onEditClick,
  onDeleteClick,
  onToggleStatus,
  onToggleSortOrder,
  ITEMS_PER_PAGE,
  // 🌟 Props ใหม่สำหรับ Bulk Actions
  selectedIds = [],
  onSelectItem,
  onSelectAll,
  onBulkStatus,
  onBulkDelete,
  onBulkMove,
  categories = []
}) {
  const [targetMoveCat, setTargetMoveCat] = useState('')
  const [showMoveDropdown, setShowMoveDropdown] = useState(false)
  
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1
  const allCurrentPageIds = questions.map(q => q.id)
  const isAllSelected = questions.length > 0 && allCurrentPageIds.every(id => selectedIds.includes(id))

  const handleConfirmMove = () => {
    if (!targetMoveCat) return alert('กรุณาเลือกวิชาที่ต้องการย้ายไปครับ')
    onBulkMove(targetMoveCat)
    setShowMoveDropdown(false)
    setTargetMoveCat('')
  }

  return (
    <div className="space-y-4 min-w-0 relative pb-16">
      
      {/* ส่วนหัวตาราง พร้อมปุ่มเลือกทั้งหมด (Select All) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {questions.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <input
                type="checkbox"
                id="selectAll"
                checked={isAllSelected}
                onChange={(e) => onSelectAll(e.target.checked, allCurrentPageIds)}
                className="w-4 h-4 accent-indigo-500 rounded cursor-pointer shrink-0"
              />
              <label htmlFor="selectAll" className="text-xs font-bold text-slate-300 cursor-pointer select-none">
                เลือกหน้านี้ ({selectedIds.length})
              </label>
            </div>
          )}

          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-300">
              {userRole === 'admin' ? `ข้อสอบทั้งหมด (${totalCount} ข้อ)` : `ข้อสอบของคุณ (${totalCount} ข้อ)`}
            </h3>
            {totalCount > 0 && (
              <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                หน้า {currentPage}/{totalPages}
              </span>
            )}
          </div>
        </div>

        {totalCount > 1 && (
          <button
            onClick={onToggleSortOrder}
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 self-start sm:self-auto"
          >
            <span>🔀 เรียงลำดับ:</span>
            <span className="text-amber-400 font-mono">{sortOrder === 'asc' ? 'ข้อ 1 ➔ ล่าสุด' : 'ล่าสุด ➔ ข้อ 1'}</span>
          </button>
        )}
      </div>

      {loading ? (
        <LoadingScreen text="กำลังดึงโจทย์ข้อสอบ..." />
      ) : questions.length === 0 ? (
        <EmptyState 
          icon="📝"
          title="ยังไม่มีโจทย์ข้อสอบ"
          description={userRole === 'admin' ? "หมวดหมู่นี้ยังไม่มีข้อสอบ คุณสามารถเพิ่มข้อสอบใหม่ได้เลยครับ" : "คุณยังไม่ได้สร้างข้อสอบในหมวดหมู่นี้ เริ่มต้นสร้างโจทย์ข้อแรกจากปุ่มด้านบนได้เลยครับ"}
          theme="dark"
        />
      ) : (
        <>
          {questions.map((q, idx) => {
            const displayIndex = sortOrder === 'asc'
              ? (currentPage - 1) * ITEMS_PER_PAGE + idx + 1
              : totalCount - ((currentPage - 1) * ITEMS_PER_PAGE + idx)

            const isHighlighted = highlightedNum === displayIndex
            const isChecked = selectedIds.includes(q.id)

            return (
              <div 
                key={q.id}
                id={`question-card-${displayIndex}`} 
                className={`p-5 sm:p-6 rounded-3xl border transition-all duration-300 space-y-4 min-w-0 ${
                  isChecked
                    ? 'border-indigo-500 bg-indigo-950/20 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                    : isHighlighted
                      ? 'bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-900 border-amber-400 ring-4 ring-amber-400/40'
                      : editingId === q.id 
                        ? 'border-amber-500 bg-slate-900/90 shadow-md' 
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4 min-w-0">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    
                    {/* 🌟 Checkbox เลือกข้อสอบนี้ */}
                    <div className="pt-1 flex items-center justify-center shrink-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onSelectItem(q.id)}
                        className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
                        title="คลิกเพื่อเลือกข้อสอบนี้"
                      />
                    </div>

                    <span className={`w-7 h-7 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 font-mono mt-0.5 ${
                      isHighlighted ? 'bg-amber-400 text-slate-950 font-black animate-bounce' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    }`}>
                      #{displayIndex}
                    </span>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          q.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {q.is_active ? '● เปิดใช้งาน' : '⭕ ฉบับร่าง'}
                        </span>
                        {isChecked && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-600 text-white shrink-0">
                            ✓ เลือกอยู่
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-white leading-relaxed break-words [word-break:break-word] block">{q.question_text}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onToggleStatus(q)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                        q.is_active ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                      }`}
                      title={q.is_active ? "คลิกเพื่อซ่อนข้อสอบนี้เป็นฉบับร่าง" : "คลิกเพื่อเปิดใช้งานข้อสอบนี้ทันที"}
                    >
                      <span>{q.is_active ? '⏸ ปิด' : '▶ เปิด'}</span>
                    </button>

                    <button
                      onClick={() => onEditClick(q)}
                      className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>✏️</span><span className="hidden sm:inline">แก้ไข</span>
                    </button>
                    
                    <button
                      onClick={() => onDeleteClick(q)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {q.image_url && (
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-center ml-8">
                    <img src={q.image_url} alt="รูปโจทย์" className="max-h-48 object-contain rounded-xl" loading="lazy" />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8 min-w-0">
                  {q.options?.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-start gap-2.5 border min-w-0 ${
                        oIdx === Number(q.correct_option) ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-bold' : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-lg text-[10px] flex items-center justify-center shrink-0 font-mono mt-0.5 ${
                        oIdx === Number(q.correct_option) ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {oIdx + 1}
                      </span>
                      <span className="break-words [word-break:break-word] flex-1 min-w-0 leading-relaxed pt-0.5">{opt}</span>
                    </div>
                  ))}
                </div>

                {(q.explanation || q.explanation_image_url) && (
                  <div className="ml-8 p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-xs text-amber-300/90 space-y-2 min-w-0">
                    <div className="font-bold flex items-center gap-1.5 text-amber-400">
                      <span>💡</span><span>คำอธิบายเฉลย:</span>
                    </div>
                    {q.explanation && <p className="leading-relaxed text-slate-300 pl-5 break-words [word-break:break-word] min-w-0">{q.explanation}</p>}
                    {q.explanation_image_url && (
                      <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex justify-center mt-2">
                        <img src={q.explanation_image_url} alt="รูปเฉลย" className="max-h-36 object-contain rounded-lg" loading="lazy" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* 🌟 Floating Batch Toolbar: แผงเมนูลอยตัวด้านล่าง ปรากฏเมื่อติ๊กเลือกข้อสอบตั้งแต่ 1 ข้อขึ้นไป */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-4 animate-slideUp">
          <div className="bg-slate-900/95 backdrop-blur-md border border-indigo-500/40 shadow-2xl shadow-indigo-500/20 p-4 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            <div className="flex items-center justify-between sm:justify-start gap-3 border-b sm:border-0 pb-3 sm:pb-0 border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center text-sm shadow-md animate-pulse">
                  {selectedIds.length}
                </span>
                <span className="text-xs sm:text-sm font-bold text-white">รายการที่เลือก</span>
              </div>
              
              <button
                onClick={() => onSelectAll(false, [])}
                className="text-xs text-slate-400 hover:text-red-400 underline cursor-pointer font-semibold sm:ml-2"
              >
                ยกเลิกทั้งหมด
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 justify-end">
              
              {/* กลุ่มเปิด/ปิดสถานะ */}
              <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800">
                <button
                  onClick={() => onBulkStatus(true)}
                  className="px-3 py-1.5 hover:bg-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  title="เปิดใช้งานข้อที่เลือกทั้งหมด"
                >
                  <span>▶</span><span>เปิดใช้งาน</span>
                </button>
                <span className="text-slate-800">|</span>
                <button
                  onClick={() => onBulkStatus(false)}
                  className="px-3 py-1.5 hover:bg-slate-800 text-slate-400 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  title="ซ่อนข้อที่เลือกทั้งหมดเป็นฉบับร่าง"
                >
                  <span>⏸</span><span>ซ่อนฉบับร่าง</span>
                </button>
              </div>

              {/* ปุ่มย้ายหมวดหมู่วิชา */}
              <div className="relative">
                <button
                  onClick={() => setShowMoveDropdown(!showMoveDropdown)}
                  className="px-3.5 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>📁</span><span>ย้ายหมวดวิชา</span>
                </button>

                {showMoveDropdown && (
                  <div className="absolute bottom-full right-0 mb-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl z-50 space-y-2 animate-fadeIn">
                    <div className="text-xs font-bold text-slate-300 pb-1 border-b border-slate-800">ย้าย {selectedIds.length} ข้อไปที่วิชา:</div>
                    <select
                      value={targetMoveCat}
                      onChange={(e) => setTargetMoveCat(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- เลือกวิชาปลายทาง --</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>📖 {cat.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-1.5 pt-1">
                      <button
                        onClick={() => setShowMoveDropdown(false)}
                        className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={handleConfirmMove}
                        disabled={!targetMoveCat}
                        className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md"
                      >
                        ยืนยันย้าย
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ปุ่มลบกลุ่ม */}
              <button
                onClick={onBulkDelete}
                className="px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-red-500/20"
                title="ลบข้อที่เลือกทั้งหมดทิ้งอย่างถาวร"
              >
                <span>🗑️</span><span>ลบ ({selectedIds.length}) ข้อ</span>
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  )
}