export default function ExamReviewCard({ question, questionNumber, totalQuestions, selectedIdx, status }) {
  const isUnanswered = status === 'unanswered'
  const isCorrect = status === 'correct'

  return (
    <article className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-7 space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <span className="text-xs font-black text-teal-700 bg-teal-50 border border-teal-200/80 px-3 py-1 rounded-xl font-mono">
          ข้อที่ {questionNumber} / {totalQuestions}
        </span>

        {isUnanswered ? (
          <span className="text-xs font-bold px-3 py-1 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5">
            <span>🔒</span><span>ยังไม่ได้ทำข้อนี้ (ซ่อนเฉลย)</span>
          </span>
        ) : isCorrect ? (
          <span className="text-xs font-bold px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
            <span>✅</span><span>ตอบถูกต้อง</span>
          </span>
        ) : (
          <span className="text-xs font-bold px-3 py-1 rounded-xl bg-red-100 text-red-800 border border-red-200 flex items-center gap-1.5">
            <span>❌</span><span>ตอบผิด</span>
          </span>
        )}
      </div>

      <div className="text-slate-900 font-bold text-sm sm:text-base md:text-lg leading-relaxed break-words [word-break:break-word]">
        {question.question_text}
      </div>

      {question.image_url && (
        <div className="bg-slate-50 p-2 sm:p-3 rounded-2xl border border-slate-200 flex justify-center overflow-hidden">
          <img src={question.image_url} alt="รูปประกอบโจทย์" className="max-w-full max-h-72 object-contain rounded-xl" loading="lazy" />
        </div>
      )}

      {isUnanswered ? (
        <div className="space-y-2.5">
          <div className="space-y-2 opacity-75">
            {question.displayOptions?.map((optText, optIdx) => (
              <div key={optIdx} className="p-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 text-slate-600 flex items-start gap-3">
                <span className="w-6 h-6 rounded-lg bg-slate-200/80 text-slate-600 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                  {optIdx + 1}
                </span>
                <span className="text-xs sm:text-sm leading-relaxed break-words flex-1">{optText}</span>
              </div>
            ))}
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-600 flex items-center gap-2">
            <span>🔒</span>
            <span>ยังไม่ได้ทำข้อนี้ (ซ่อนเฉลยและคำอธิบายเฉลย เพื่อไม่ให้สปอยล์สำหรับการฝึกทำรอบถัดไป)</span>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {question.displayOptions?.map((optText, optIdx) => {
              const isCorrectOpt = optIdx === question.displayCorrectOption
              const isSelectedOpt = optIdx === selectedIdx

              let cardStyle = 'border-slate-150 bg-slate-50/40 text-slate-400 opacity-70'
              let badgeStyle = 'bg-slate-100 text-slate-500 border border-slate-200'

              if (isCorrectOpt) {
                cardStyle = 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-bold ring-1 ring-emerald-500'
                badgeStyle = 'bg-emerald-500 text-white font-bold border-emerald-500'
              } else if (isSelectedOpt) {
                cardStyle = 'border-red-300 bg-red-50/80 text-red-900 font-semibold'
                badgeStyle = 'bg-red-500 text-white font-bold border-red-500'
              }

              return (
                <div key={optIdx} className={`p-3.5 rounded-2xl border flex items-start gap-3 min-w-0 ${cardStyle}`}>
                  <span className={`w-6 h-6 rounded-xl text-xs font-mono flex items-center justify-center shrink-0 mt-0.5 ${badgeStyle}`}>
                    {optIdx + 1}
                  </span>
                  <span className="text-xs sm:text-sm leading-relaxed break-words flex-1 min-w-0">{optText}</span>
                  {isCorrectOpt && <span className="shrink-0 text-xs font-black text-emerald-700">🎯 เฉลย</span>}
                  {isSelectedOpt && !isCorrectOpt && <span className="shrink-0 text-xs font-black text-red-600">❌ คำตอบคุณ</span>}
                </div>
              )
            })}
          </div>

          {(question.explanation || question.explanation_image_url) && (
            <div className="p-4 sm:p-5 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-slate-800 space-y-2">
              <div className="font-black text-amber-900 text-xs sm:text-sm flex items-center gap-1.5">
                <span>💡</span><span>คำอธิบายเฉลย:</span>
              </div>
              {question.explanation && (
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                  {question.explanation}
                </p>
              )}
              {question.explanation_image_url && (
                <div className="mt-2 bg-white p-2 rounded-xl border border-amber-200 flex justify-center overflow-hidden">
                  <img src={question.explanation_image_url} alt="รูปประกอบเฉลย" className="max-w-full max-h-64 object-contain rounded-lg" loading="lazy" />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </article>
  )
}
