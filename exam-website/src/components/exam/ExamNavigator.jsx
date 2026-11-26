import { useState, useMemo } from 'react'

const NAV_CHUNK_SIZE = 100

export default function ExamNavigator({
  questions,
  userAnswers,
  currentIdx,
  examPhase,
  answeredCount,
  saving = false,
  onSelectQuestion,
  onSubmitExam
}) {
  const totalQuestions = questions.length
  const totalChunks = Math.max(1, Math.ceil(totalQuestions / NAV_CHUNK_SIZE))
  const currentIdxChunk = Math.floor(currentIdx / NAV_CHUNK_SIZE)

  // Track user's manual chunk browsing while auto-syncing whenever `currentIdx` changes!
  const [chunkNavState, setChunkNavState] = useState({
    chunk: currentIdxChunk,
    syncedIdx: currentIdx
  })

  const activeChunk = chunkNavState.syncedIdx !== currentIdx
    ? currentIdxChunk
    : Math.min(chunkNavState.chunk, totalChunks - 1)

  const setManualChunk = (nextChunk) => {
    const clamped = Math.max(0, Math.min(totalChunks - 1, nextChunk))
    setChunkNavState({ chunk: clamped, syncedIdx: currentIdx })
  }

  // Precompute per-chunk answered counts for dropdown summaries (e.g. "101–200 (ทำแล้ว 45/100)")
  const chunkSummaries = useMemo(() => {
    if (totalChunks <= 1) return []
    const summaries = []
    for (let c = 0; c < totalChunks; c += 1) {
      const start = c * NAV_CHUNK_SIZE
      const end = Math.min(totalQuestions, start + NAV_CHUNK_SIZE)
      let answeredInChunk = 0
      for (let i = start; i < end; i += 1) {
        if (userAnswers[questions[i].id] !== undefined) answeredInChunk += 1
      }
      summaries.push({
        chunkIndex: c,
        startNum: start + 1,
        endNum: end,
        size: end - start,
        answeredInChunk
      })
    }
    return summaries
  }, [questions, userAnswers, totalChunks, totalQuestions])

  const sliceStart = activeChunk * NAV_CHUNK_SIZE
  const sliceEnd = Math.min(totalQuestions, sliceStart + NAV_CHUNK_SIZE)
  const visibleQuestions = questions.slice(sliceStart, sliceEnd)

  return (
    <div className="lg:col-span-1 order-2 lg:order-2">
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm sticky top-24 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <span>📑</span><span>แผงนำทางข้อสอบ</span>
          </h2>
          <span className="text-[11px] font-bold text-slate-400 font-mono">
            {answeredCount.toLocaleString()}/{totalQuestions.toLocaleString()}
          </span>
        </div>

        {/* Paginated Range Switcher (only shown when > 100 questions) */}
        {totalChunks > 1 && (
          <div className="space-y-2 bg-slate-50/80 p-2.5 rounded-2xl border border-slate-200/80">
            <select
              aria-label="เลือกช่วงข้อสอบ"
              value={activeChunk}
              onChange={(e) => setManualChunk(Number(e.target.value))}
              className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              {chunkSummaries.map((info) => (
                <option key={info.chunkIndex} value={info.chunkIndex}>
                  ข้อ {info.startNum}–{info.endNum} (ทำแล้ว {info.answeredInChunk}/{info.size})
                </option>
              ))}
            </select>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={activeChunk === 0}
                onClick={() => setManualChunk(activeChunk - 1)}
                className="flex-1 py-1.5 px-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-35 text-[11px] font-bold text-slate-600 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                ← ช่วงก่อนหน้า
              </button>
              <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0">
                {activeChunk + 1}/{totalChunks}
              </span>
              <button
                type="button"
                disabled={activeChunk >= totalChunks - 1}
                onClick={() => setManualChunk(activeChunk + 1)}
                className="flex-1 py-1.5 px-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-35 text-[11px] font-bold text-slate-600 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                ช่วงถัดไป →
              </button>
            </div>
          </div>
        )}

        {/* Question Number Grid (Max 100 buttons rendered at once — zero DOM lag!) */}
        <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2 max-h-60 sm:max-h-72 lg:max-h-80 overflow-y-auto p-1">
          {visibleQuestions.map((question, offset) => {
            const globalIdx = sliceStart + offset
            const isAnswered = userAnswers[question.id] !== undefined
            let btnStyle = 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent font-semibold'
            if (examPhase === 'submitted') {
              if (!isAnswered) {
                btnStyle = 'bg-slate-100 text-slate-400 border border-slate-200 font-semibold'
              } else {
                const isCorrect = userAnswers[question.id] === question.displayCorrectOption
                btnStyle = isCorrect
                  ? 'bg-emerald-500 text-white font-bold shadow-2xs shadow-emerald-500/30'
                  : 'bg-red-500 text-white font-bold shadow-2xs shadow-red-500/30'
              }
            } else if (isAnswered) {
              btnStyle = 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-bold shadow-2xs shadow-teal-500/20'
            }
            if (currentIdx === globalIdx) {
              btnStyle += ' ring-4 ring-teal-500/30 ring-offset-1 scale-105 z-10'
            }
            return (
              <button
                type="button"
                key={question.id}
                onClick={() => onSelectQuestion(globalIdx)}
                className={`h-10 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center ${btnStyle}`}
              >
                {globalIdx + 1}
              </button>
            )
          })}
        </div>

        {/* Submit Now Button inside Navigator (accessible from any question, safe from misclicks) */}
        {examPhase === 'testing' && typeof onSubmitExam === 'function' && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <button
              type="button"
              disabled={saving}
              onClick={onSubmitExam}
              className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:opacity-50 text-white font-black rounded-2xl text-xs sm:text-sm transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🚀</span>
              <span>{saving ? 'กำลังตรวจคะแนน...' : 'ส่งข้อสอบเลย (ดูเฉลย)'}</span>
            </button>
            <p className="text-[10px] text-center text-slate-400 leading-snug">
              ส่งได้ทันทีเมื่อทำแล้วอย่างน้อย 1 ข้อ · ข้อที่เว้นว่างจะซ่อนเฉลยและไม่เข้าคลังข้อผิด
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-2 font-medium">
          {examPhase === 'testing' ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-gradient-to-r from-teal-500 to-emerald-600 inline-block shrink-0 shadow-2xs" />
                <span>ทำข้อนี้แล้ว (Answered)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-slate-100 border border-slate-300 inline-block shrink-0" />
                <span>ยังไม่ได้ทำ (Unanswered)</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block shrink-0 shadow-2xs" />
                <span>ตอบถูก (Correct)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-red-500 inline-block shrink-0 shadow-2xs" />
                <span>ตอบผิด (Incorrect)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-slate-100 border border-slate-300 inline-block shrink-0" />
                <span>ยังไม่ได้ทำ (ซ่อนเฉลย)</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
