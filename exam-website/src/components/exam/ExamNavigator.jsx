export default function ExamNavigator({ questions, userAnswers, currentIdx, examPhase, answeredCount, onSelectQuestion }) {
  return (
    <div className="lg:col-span-1 order-2 lg:order-2">
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm sticky top-24">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2"><span>📑</span><span>แผงนำทางข้อสอบ</span></h2>
          <span className="text-[11px] font-bold text-slate-400 font-mono">{answeredCount}/{questions.length}</span>
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2 max-h-60 sm:max-h-72 lg:max-h-80 overflow-y-auto p-1">
          {questions.map((question, idx) => {
            const isAnswered = userAnswers[question.id] !== undefined
            let btnStyle = 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent font-semibold'
            if (examPhase === 'submitted') {
              const isCorrect = userAnswers[question.id] === question.displayCorrectOption
              btnStyle = isCorrect ? 'bg-emerald-500 text-white font-bold shadow-2xs shadow-emerald-500/30' : 'bg-red-500 text-white font-bold shadow-2xs shadow-red-500/30'
            } else if (isAnswered) {
              btnStyle = 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-bold shadow-2xs shadow-teal-500/20'
            }
            if (currentIdx === idx) btnStyle += ' ring-4 ring-teal-500/30 ring-offset-1 scale-105 z-10'
            return <button type="button" key={question.id} onClick={() => onSelectQuestion(idx)} className={`h-10 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center ${btnStyle}`}>{idx + 1}</button>
          })}
        </div>
        <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-500 space-y-2 font-medium">
          {examPhase === 'testing' ? (
            <>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-gradient-to-r from-teal-500 to-emerald-600 inline-block shrink-0 shadow-2xs"/><span>ทำข้อนี้แล้ว (Answered)</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-slate-100 border border-slate-300 inline-block shrink-0"/><span>ยังไม่ได้ทำ (Unanswered)</span></div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-emerald-500 inline-block shrink-0 shadow-2xs"/><span>ตอบถูก (Correct)</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-red-500 inline-block shrink-0 shadow-2xs"/><span>ตอบผิด / ไม่ได้ตอบ (Incorrect)</span></div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
