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
  ITEMS_PER_PAGE
}) {
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-300">
            {userRole === 'admin' 
              ? `ข้อสอบทั้งหมด (${totalCount} ข้อ)` 
              : `ข้อสอบของคุณ (${totalCount} ข้อ)`}
          </h3>
          {totalCount > 0 && (
            <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
              หน้า {currentPage}/{totalPages}
            </span>
          )}
        </div>

        {totalCount > 1 && (
          <button
            onClick={onToggleSortOrder}
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 self-start sm:self-auto"
            title="คลิกเพื่อเปลี่ยนทิศทางการเรียงลำดับข้อสอบ"
          >
            <span>🔀 เรียงลำดับ:</span>
            <span className="text-amber-400 font-mono">
              {sortOrder === 'asc' ? 'ข้อ 1 ➔ ล่าสุด' : 'ล่าสุด ➔ ข้อ 1'}
            </span>
          </button>
        )}
      </div>

      {loading ? (
        <LoadingScreen text="กำลังดึงโจทย์ข้อสอบ..." />
      ) : questions.length === 0 ? (
        <EmptyState 
          icon="📝"
          title="ยังไม่มีโจทย์ข้อสอบ"
          description={userRole === 'admin' 
            ? "หมวดหมู่นี้ยังไม่มีข้อสอบ คุณหรือผู้ช่วยสร้างสามารถเพิ่มข้อสอบใหม่ได้เลยครับ" 
            : "คุณยังไม่ได้สร้างข้อสอบในหมวดหมู่นี้ เริ่มต้นสร้างโจทย์ข้อแรกจากฟอร์มด้านซ้ายมือ หรือนำเข้าชุดใหญ่ด้วย AI ได้เลยครับ"}
        />
      ) : (
        <>
          {questions.map((q, idx) => {
            const displayIndex = sortOrder === 'asc'
              ? (currentPage - 1) * ITEMS_PER_PAGE + idx + 1
              : totalCount - ((currentPage - 1) * ITEMS_PER_PAGE + idx)

            const isHighlighted = highlightedNum === displayIndex

            return (
              <div 
                key={q.id}
                id={`question-card-${displayIndex}`} 
                className={`p-5 sm:p-6 rounded-3xl border transition-all duration-500 space-y-4 min-w-0 ${
                  isHighlighted
                    ? 'bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-900 border-amber-400 ring-4 ring-amber-400/40 ring-offset-2 ring-offset-slate-950 scale-[1.01] shadow-xl shadow-amber-500/10'
                    : editingId === q.id 
                      ? 'border-amber-500 bg-slate-900/90 shadow-md shadow-amber-500/10' 
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4 min-w-0">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <span className={`w-7 h-7 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 font-mono mt-0.5 ${
                      isHighlighted 
                        ? 'bg-amber-400 text-slate-950 font-black shadow-md animate-bounce' 
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                    }`}>
                      #{displayIndex}
                    </span>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          q.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {q.is_active ? '● เปิดใช้งาน' : '⭕ ฉบับร่าง (ซ่อนอยู่)'}
                        </span>
                        {isHighlighted && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-400 text-slate-950 shrink-0">
                            🎯 ตำแหน่งที่คุณค้นหา
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
                      title="แก้ไขข้อสอบนี้"
                    >
                      <span>✏️</span><span className="hidden sm:inline">แก้ไข</span>
                    </button>
                    
                    <button
                      onClick={() => onDeleteClick(q)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                      title="ลบข้อสอบ"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {q.image_url && (
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-center">
                    <img src={q.image_url} alt="รูปโจทย์" className="max-h-48 object-contain rounded-xl" loading="lazy" />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1 sm:pl-2 min-w-0">
                  {q.options?.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-start gap-2.5 border min-w-0 ${
                        oIdx === Number(q.correct_option)
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-bold'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
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
                  <div className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-xs text-amber-300/90 space-y-2 min-w-0">
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
    </div>
  )
}