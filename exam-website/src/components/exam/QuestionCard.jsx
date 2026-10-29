export default function QuestionCard({
  currentQ,
  currentIdx,
  questionsLength,
  examPhase,
  userAnswers,
  isLastQuestion,
  isAllAnswered,
  saving,
  onSelectOption,
  onPrevious,
  onNext,
  onSubmit
}) {
  const selectedAnswer = userAnswers[currentQ.id]

  return (
    <div className="lg:col-span-3 order-1 lg:order-1 space-y-6 min-w-0">
      <div className="bg-white p-5 sm:p-10 rounded-3xl border border-slate-200/80 shadow-sm min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-5 sm:mb-6 pb-4 sm:pb-5 border-b border-slate-100">
          <span className="text-[11px] sm:text-xs font-black text-teal-700 bg-teal-50 border border-teal-200/80 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-xl uppercase tracking-wider shrink-0">
            QUESTION {currentIdx + 1} / {questionsLength}
          </span>
          {examPhase === 'submitted' && (
            <span className={`text-[11px] sm:text-xs font-bold px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-xl flex items-center gap-1.5 shrink-0 ${selectedAnswer === currentQ.displayCorrectOption ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
              <span>{selectedAnswer === currentQ.displayCorrectOption ? '✅' : '❌'}</span>
              <span>{selectedAnswer === currentQ.displayCorrectOption ? 'ถูกต้อง' : 'ตอบผิด / ไม่ได้ตอบ'}</span>
            </span>
          )}
        </div>

        <div className="text-slate-900 font-bold text-base sm:text-lg md:text-xl mb-6 leading-relaxed break-words [word-break:break-word] min-w-0">{currentQ.question_text}</div>

        {currentQ.image_url && (
          <div className="mb-6 sm:mb-8 bg-slate-50/80 p-2 sm:p-4 rounded-2xl border border-slate-200/80 flex justify-center shadow-inner overflow-hidden">
            <img src={currentQ.image_url} alt="รูปประกอบโจทย์" className="max-w-full max-h-80 object-contain rounded-xl" loading="lazy" />
          </div>
        )}

        <div className="space-y-3 min-w-0">
          {currentQ.displayOptions?.map((optionText, optIdx) => {
            const isSelected = selectedAnswer === optIdx
            const isCorrectOption = currentQ.displayCorrectOption === optIdx
            let cardStyle = 'border-slate-200 hover:border-teal-400 bg-white hover:bg-slate-50/50 text-slate-700'
            let badgeStyle = 'bg-slate-100 text-slate-600 border border-slate-200'
            if (examPhase === 'submitted') {
              if (isCorrectOption) {
                cardStyle = 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-bold shadow-xs ring-1 ring-emerald-500'
                badgeStyle = 'bg-emerald-500 text-white font-bold border-emerald-500'
              } else if (isSelected) {
                cardStyle = 'border-red-300 bg-red-50/70 text-red-900 font-semibold'
                badgeStyle = 'bg-red-500 text-white font-bold border-red-500'
              } else {
                cardStyle = 'border-slate-150 bg-slate-50/40 text-slate-400 opacity-60'
              }
            } else if (isSelected) {
              cardStyle = 'border-teal-500 bg-teal-50/60 text-teal-950 font-bold shadow-xs ring-1 ring-teal-500'
              badgeStyle = 'bg-teal-600 text-white font-bold border-teal-600'
            }
            return (
              <div key={optIdx} onClick={() => onSelectOption(currentQ.id, optIdx)} className={`min-h-14 p-3.5 sm:p-4.5 rounded-2xl border transition-all flex items-start gap-3 sm:gap-3.5 min-w-0 ${examPhase === 'testing' ? 'cursor-pointer active:scale-[0.998]' : 'cursor-default'} ${cardStyle}`}>
                <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-xl text-xs flex items-center justify-center shrink-0 font-mono mt-0.5 transition-colors ${badgeStyle}`}>{optIdx + 1}</span>
                <span className="text-xs sm:text-base leading-relaxed break-words [word-break:break-word] flex-1 min-w-0 pt-0.5">{optionText}</span>
                {examPhase === 'submitted' && isCorrectOption && <span className="text-sm sm:text-base shrink-0">🎯</span>}
                {examPhase === 'submitted' && isSelected && !isCorrectOption && <span className="text-sm sm:text-base shrink-0">❌</span>}
              </div>
            )
          })}
        </div>

        {examPhase === 'submitted' && (currentQ.explanation || currentQ.explanation_image_url) && (
          <div className="mt-6 sm:mt-8 p-5 sm:p-6 bg-amber-50/80 border border-amber-200/80 rounded-3xl text-slate-800 shadow-2xs animate-fadeIn min-w-0">
            <div className="font-black text-amber-900 text-xs sm:text-sm flex items-center gap-2 mb-3"><span className="text-sm sm:text-base">💡</span><span>คำอธิบายเฉลยละเอียด:</span></div>
            {currentQ.explanation && <p className="text-xs sm:text-sm text-slate-700 leading-relaxed break-words [word-break:break-word] mb-4 min-w-0">{currentQ.explanation}</p>}
            {currentQ.explanation_image_url && <div className="mt-3 bg-white p-2 sm:p-3 rounded-2xl border border-amber-200/80 flex justify-center shadow-inner overflow-hidden"><img src={currentQ.explanation_image_url} alt="รูปประกอบเฉลย" className="max-w-full max-h-72 object-contain rounded-xl" loading="lazy" /></div>}
          </div>
        )}

        <div className="mt-8 sm:mt-10 pt-5 sm:pt-6 border-t border-slate-100 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 sm:gap-4">
          <button type="button" onClick={onPrevious} disabled={currentIdx === 0} className="flex-1 sm:flex-none py-2.5 sm:py-2.5 px-4 sm:px-5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-transparent text-slate-600 font-bold text-xs sm:text-sm transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shrink-0">
            <span>←</span><span>ข้อก่อนหน้า</span>
          </button>
          {!isLastQuestion ? (
            <button type="button" onClick={onNext} className="flex-1 sm:flex-none py-2.5 sm:py-2.5 px-5 sm:px-6 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs sm:text-sm transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 shrink-0"><span>ข้อถัดไป</span><span>→</span></button>
          ) : examPhase === 'testing' && (
            isAllAnswered ? (
              <button type="button" onClick={onSubmit} disabled={saving} className="w-full sm:w-auto py-3 sm:px-6 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2 shrink-0 order-first sm:order-none mb-2 sm:mb-0"><span>✨</span><span>ส่งข้อสอบและตรวจคะแนน</span></button>
            ) : (
              <div className="w-full sm:w-auto py-2.5 px-4 sm:px-5 bg-amber-50 border border-amber-200 text-amber-800 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0 order-first sm:order-none mb-2 sm:mb-0 text-center"><span>⚠️ กรุณาทำข้อสอบให้ครบทุกข้อก่อนส่ง</span></div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
