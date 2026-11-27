export default function MistakeCard({ item, index, onRequestResolve }) {
  const q = item.questions
  const userAnswerIdx = item.user_answer !== null ? Number(item.user_answer) : null
  const correctIdx = Number(q.correct_option)

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-md transition-all min-w-0">
      <div className="bg-slate-100/80 px-4 sm:px-6 py-3 border-b border-slate-200/60 flex flex-wrap items-center justify-between gap-1.5 text-xs font-bold text-slate-600 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block shrink-0" />
          <span className="text-slate-900 font-extrabold truncate">📖 {q.categories?.name || 'หมวดวิชาทั่วไป'}</span>
          <span className="text-slate-300 shrink-0">|</span>
          <span className="shrink-0">#{index + 1}</span>
        </div>
        <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono shrink-0">
          {new Date(item.created_at).toLocaleDateString('th-TH', {
            year: '2-digit',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}{' '}
          น.
        </span>
      </div>

      <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 min-w-0">
        <div className="text-slate-900 font-bold text-sm sm:text-lg leading-relaxed break-words [word-break:break-word] min-w-0">
          {q.question_text}
        </div>

        {q.image_url && (
          <div className="bg-slate-50 p-2 sm:p-3 rounded-2xl border border-slate-200 flex justify-center overflow-hidden">
            <img src={q.image_url} alt="รูปโจทย์" className="max-w-full max-h-72 object-contain rounded-xl" loading="lazy" />
          </div>
        )}

        <div className="space-y-3 min-w-0 pt-1">
          <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
            ตัวเลือกทั้งหมด และจุดที่คุณต้องทบทวน:
          </div>

          {q.options?.map((optText, optIdx) => {
            const isUserChoice = userAnswerIdx === optIdx
            const isCorrectChoice = correctIdx === optIdx

            let cardStyle = 'bg-slate-50/60 border-slate-200/80 text-slate-600'
            let badgeStyle = 'bg-slate-200 text-slate-700'
            let statusBadge = null

            if (isCorrectChoice) {
              cardStyle = 'bg-emerald-50/80 border-emerald-500 text-emerald-950 font-bold ring-1 ring-emerald-500 shadow-2xs'
              badgeStyle = 'bg-emerald-500 text-white font-black'
              statusBadge = (
                <span className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md ml-auto shrink-0 shadow-xs">
                  🎯 คำตอบที่ถูกต้อง
                </span>
              )
            } else if (isUserChoice) {
              cardStyle = 'bg-red-50/80 border-red-300 text-red-900 font-semibold shadow-2xs'
              badgeStyle = 'bg-red-500 text-white font-black'
              statusBadge = (
                <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-md ml-auto shrink-0 shadow-xs">
                  ❌ คุณเคยตอบข้อนี้
                </span>
              )
            }

            return (
              <div key={optIdx} className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex items-center gap-3 min-w-0 ${cardStyle}`}>
                <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-xl text-xs flex items-center justify-center shrink-0 font-mono ${badgeStyle}`}>
                  {optIdx + 1}
                </span>
                <span className="text-xs sm:text-sm leading-relaxed break-words [word-break:break-word] flex-1 min-w-0">
                  {optText}
                </span>
                {statusBadge}
              </div>
            )
          })}

          {userAnswerIdx === null && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800 flex items-center gap-2">
              <span>⚠️</span><span>ข้อนี้คุณไม่ได้เลือกคำตอบ (อาจจะหมดเวลา หรือเว้นว่างไว้)</span>
            </div>
          )}
        </div>

        {(q.explanation || q.explanation_image_url) && (
          <div className="p-4 sm:p-5 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-slate-800 min-w-0 mt-4">
            <div className="font-black text-amber-900 text-xs sm:text-sm flex items-center gap-1.5 mb-2">
              <span>💡</span><span>คำอธิบายเฉลยเพิ่มเติม:</span>
            </div>
            {q.explanation && <p className="text-xs sm:text-sm text-slate-700 leading-relaxed break-words [word-break:break-word] min-w-0">{q.explanation}</p>}
            {q.explanation_image_url && (
              <div className="mt-3 bg-white p-2 sm:p-3 rounded-xl border border-amber-200/80 flex justify-center overflow-hidden">
                <img src={q.explanation_image_url} alt="รูปเฉลย" className="max-w-full max-h-64 object-contain rounded-lg" loading="lazy" />
              </div>
            )}
          </div>
        )}

        <div className="pt-3 sm:pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={() => onRequestResolve(item)}
            className="w-full sm:w-auto px-5 sm:px-6 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-sm hover:shadow cursor-pointer flex items-center justify-center gap-2 group shrink-0"
          >
            <span>✓</span>
            <span>ทบทวนเข้าใจแล้ว (นำออกจากคลัง)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
