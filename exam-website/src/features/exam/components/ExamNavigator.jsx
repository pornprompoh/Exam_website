import { useState, useMemo } from 'react'
import { CheckCircleIcon } from '../../../shared/components/AdminIcons'

const NAV_CHUNK_SIZE = 100

function GridIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

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

  const activeChunk =
    chunkNavState.syncedIdx !== currentIdx
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
    <aside className="lg:col-span-1 order-2">
      <div className="bg-white dark:bg-[#181818] p-5 rounded-2xl border border-zinc-200 dark:border-[#272727] sticky top-24 space-y-4 transition-colors duration-300">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-[#272727]">
          <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <GridIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>แผงนำทางข้อสอบ</span>
          </h2>
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
            {answeredCount.toLocaleString()}/{totalQuestions.toLocaleString()}
          </span>
        </div>

        {totalChunks > 1 && (
          <div className="space-y-2 bg-zinc-50 dark:bg-[#1F1F1F] p-2.5 rounded-xl border border-zinc-200 dark:border-[#272727]">
            <select
              aria-label="เลือกช่วงข้อสอบ"
              value={activeChunk}
              onChange={(e) => setManualChunk(Number(e.target.value))}
              className="w-full px-2.5 py-2 bg-white dark:bg-[#272727] border border-zinc-200 dark:border-[#313131] rounded-lg text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
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
                className="flex-1 py-1.5 px-2 rounded-lg bg-white dark:bg-[#272727] hover:bg-zinc-100 dark:hover:bg-[#313131] border border-zinc-200 dark:border-[#313131] disabled:opacity-35 text-xs font-medium text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                ก่อนหน้า
              </button>
              <span className="text-xs font-mono tabular-nums font-semibold text-zinc-500 dark:text-zinc-400 shrink-0">
                {activeChunk + 1}/{totalChunks}
              </span>
              <button
                type="button"
                disabled={activeChunk >= totalChunks - 1}
                onClick={() => setManualChunk(activeChunk + 1)}
                className="flex-1 py-1.5 px-2 rounded-lg bg-white dark:bg-[#272727] hover:bg-zinc-100 dark:hover:bg-[#313131] border border-zinc-200 dark:border-[#313131] disabled:opacity-35 text-xs font-medium text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-1.5 max-h-64 sm:max-h-72 lg:max-h-80 overflow-y-auto p-1">
          {visibleQuestions.map((question, offset) => {
            const globalIdx = sliceStart + offset
            const isAnswered = userAnswers[question.id] !== undefined
            let btnStyle =
              'bg-zinc-100 dark:bg-[#1F1F1F] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-[#272727] border border-zinc-200/80 dark:border-[#272727] font-medium'

            if (examPhase === 'submitted') {
              if (!isAnswered) {
                btnStyle =
                  'bg-zinc-100 dark:bg-[#1F1F1F] text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-[#272727] font-medium'
              } else {
                const isCorrect = userAnswers[question.id] === question.displayCorrectOption
                btnStyle = isCorrect
                  ? 'bg-emerald-600 text-white border border-emerald-600 font-semibold'
                  : 'bg-rose-600 text-white border border-rose-600 font-semibold'
              }
            } else if (isAnswered) {
              btnStyle = 'bg-indigo-600 text-white border border-indigo-600 font-semibold'
            }

            if (currentIdx === globalIdx) {
              btnStyle += ' ring-2 ring-indigo-500 ring-offset-2 ring-offset-white dark:ring-offset-[#181818] z-10'
            }

            return (
              <button
                type="button"
                key={question.id}
                aria-label={`ไปยังข้อที่ ${globalIdx + 1}`}
                aria-current={currentIdx === globalIdx ? 'true' : undefined}
                onClick={() => onSelectQuestion(globalIdx)}
                className={`h-9 rounded-lg text-xs font-mono tabular-nums transition-all duration-300 ease-premium cursor-pointer flex items-center justify-center ${btnStyle}`}
              >
                {globalIdx + 1}
              </button>
            )
          })}
        </div>

        {examPhase === 'testing' && typeof onSubmitExam === 'function' && (
          <div className="pt-3 border-t border-zinc-100 dark:border-[#272727] space-y-2">
            <button
              type="button"
              disabled={saving}
              onClick={onSubmitExam}
              className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-premium cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircleIcon className="w-4 h-4" />
              <span>{saving ? 'กำลังตรวจคะแนน...' : 'ส่งข้อสอบเลย (ดูเฉลย)'}</span>
            </button>
            <p className="text-xs text-center text-zinc-500 dark:text-zinc-400 leading-relaxed">
              ส่งได้เมื่อทำแล้วอย่างน้อย 1 ข้อ ข้อที่เว้นว่างจะซ่อนเฉลยและไม่เข้าคลังข้อผิด
            </p>
          </div>
        )}

        <div className="pt-3 border-t border-zinc-100 dark:border-[#272727] text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
          {examPhase === 'testing' ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-indigo-600 inline-block shrink-0" />
                <span>ทำข้อนี้แล้ว</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-zinc-100 dark:bg-[#1F1F1F] border border-zinc-300 dark:border-[#313131] inline-block shrink-0" />
                <span>ยังไม่ได้ทำ</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-emerald-600 inline-block shrink-0" />
                <span>ตอบถูก</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-rose-600 inline-block shrink-0" />
                <span>ตอบผิด</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-zinc-100 dark:bg-[#1F1F1F] border border-zinc-300 dark:border-[#313131] inline-block shrink-0" />
                <span>ยังไม่ได้ทำ (ซ่อนเฉลย)</span>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
