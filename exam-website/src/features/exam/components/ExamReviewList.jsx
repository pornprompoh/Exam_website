import { useState, useMemo, useRef } from 'react'
import ExamReviewCard from './ExamReviewCard'

const PAGE_SIZE_OPTIONS = [20, 25, 30, 50]

export default function ExamReviewList({
  questions,
  userAnswers,
  score,
  answeredCount,
  categoryName,
  onRestartExam,
  onGoHome
}) {
  const reviewTopRef = useRef(null)

  const classified = useMemo(() => {
    const answered = []
    const correct = []
    const wrong = []
    const unanswered = []

    questions.forEach((q, idx) => {
      const selectedIdx = userAnswers[q.id]
      const isAnswered = selectedIdx !== undefined && selectedIdx !== null
      const isCorrect = isAnswered && selectedIdx === q.displayCorrectOption
      const entry = {
        question: q,
        questionNumber: idx + 1,
        selectedIdx: isAnswered ? selectedIdx : null,
        status: !isAnswered ? 'unanswered' : isCorrect ? 'correct' : 'wrong'
      }

      if (!isAnswered) {
        unanswered.push(entry)
      } else {
        answered.push(entry)
        if (isCorrect) correct.push(entry)
        else wrong.push(entry)
      }
    })

    return { answered, correct, wrong, unanswered }
  }, [questions, userAnswers])

  const [activeFilter, setActiveFilter] = useState('answered')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [pageJumpInput, setPageJumpInput] = useState('')

  const visibleEntries = classified[activeFilter] || []
  const totalPages = Math.max(1, Math.ceil(visibleEntries.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIdx = (safePage - 1) * pageSize
  const paginatedEntries = visibleEntries.slice(startIdx, startIdx + pageSize)

  const scrollToReviewTop = () => {
    if (reviewTopRef.current) {
      reviewTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleFilterChange = (nextFilter) => {
    setActiveFilter(nextFilter)
    setCurrentPage(1)
    setPageJumpInput('')
    scrollToReviewTop()
  }

  const handlePageChange = (nextPage) => {
    const clamped = Math.max(1, Math.min(totalPages, nextPage))
    setCurrentPage(clamped)
    setPageJumpInput('')
    scrollToReviewTop()
  }

  const handlePageJumpSubmit = (e) => {
    e.preventDefault()
    const target = parseInt(pageJumpInput, 10)
    if (Number.isNaN(target) || target < 1 || target > totalPages) return
    handlePageChange(target)
  }

  const accuracyOnAnswered = answeredCount > 0 ? Math.round((score / answeredCount) * 100) : 0
  const overallPercent = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0

  const filterTabs = [
    { key: 'answered', label: 'เฉพาะข้อที่ทำแล้ว', count: classified.answered.length, activeCls: 'bg-slate-900 text-white border-slate-900' },
    { key: 'correct', label: '✅ ตอบถูก', count: classified.correct.length, activeCls: 'bg-emerald-600 text-white border-emerald-600' },
    { key: 'wrong', label: '❌ ตอบผิด', count: classified.wrong.length, activeCls: 'bg-red-600 text-white border-red-600' },
    { key: 'unanswered', label: '🔒 ยังไม่ทำ', count: classified.unanswered.length, activeCls: 'bg-amber-600 text-white border-amber-600' }
  ]

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 mt-6 sm:mt-8 space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="space-y-1 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1 rounded-xl">
              <span>🏆</span><span>สรุปผลการสอบ</span>
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">{categoryName}</h1>
            <p className="text-xs sm:text-sm text-slate-500">
              ทำไปแล้ว <strong className="text-slate-800 font-mono">{answeredCount.toLocaleString()}</strong> จากชุดข้อสอบทั้งหมด{' '}
              <strong className="text-slate-800 font-mono">{questions.length.toLocaleString()}</strong> ข้อ
              {classified.unanswered.length > 0 && ' · ข้อที่เว้นว่างจะถูกซ่อนเฉลยและไม่เก็บลงคลังข้อผิดพลาด'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button type="button" onClick={onRestartExam} className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm transition-all shadow-sm cursor-pointer">
              🔄 ตั้งค่าสอบรอบใหม่
            </button>
            <button type="button" onClick={onGoHome} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-all cursor-pointer">
              🏠 กลับหน้าหลัก
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4">
            <p className="text-[11px] font-bold text-teal-700">คะแนนที่ได้</p>
            <p className="mt-1 text-2xl font-black font-mono text-teal-900">
              {score.toLocaleString()} <span className="text-sm text-teal-600">/ {answeredCount.toLocaleString()}</span>
            </p>
            <p className="text-[11px] font-semibold text-teal-700/80 mt-0.5">
              แม่นยำ {accuracyOnAnswered}% (รวมชุด {overallPercent}%)
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <p className="text-[11px] font-bold text-emerald-700">✅ ตอบถูก</p>
            <p className="mt-1 text-2xl font-black font-mono text-emerald-700">{classified.correct.length.toLocaleString()}</p>
            <p className="text-[11px] text-emerald-700/70 mt-0.5">ข้อ</p>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4">
            <p className="text-[11px] font-bold text-red-700">❌ ตอบผิด (เข้าคลังข้อผิด)</p>
            <p className="mt-1 text-2xl font-black font-mono text-red-700">{classified.wrong.length.toLocaleString()}</p>
            <p className="text-[11px] text-red-700/70 mt-0.5">บันทึกเพื่อทบทวนแล้ว</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[11px] font-bold text-slate-600">🔒 ยังไม่ทำ (ซ่อนเฉลย)</p>
            <p className="mt-1 text-2xl font-black font-mono text-slate-700">{classified.unanswered.length.toLocaleString()}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">ไม่เก็บเข้าคลังข้อผิด</p>
          </div>
        </div>
      </div>

      <div ref={reviewTopRef} className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 scroll-mt-20">
        <div className="flex flex-wrap items-center gap-2">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleFilterChange(tab.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive ? `${tab.activeCls} shadow-xs` : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-mono ${isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
                  {tab.count.toLocaleString()}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
          <span className="font-bold">แสดงหน้าละ:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size} ข้อ</option>
            ))}
          </select>
        </div>
      </div>

      {visibleEntries.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center space-y-2">
          <p className="text-3xl">📭</p>
          <p className="text-sm font-black text-slate-800">ไม่มีข้อสอบในตัวกรองนี้</p>
          <p className="text-xs text-slate-500">ลองสลับแท็บตัวกรองด้านบนเพื่อดูข้อสอบกลุ่มอื่นครับ</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedEntries.map((entry) => (
            <ExamReviewCard
              key={entry.question.id}
              question={entry.question}
              questionNumber={entry.questionNumber}
              totalQuestions={questions.length}
              selectedIdx={entry.selectedIdx}
              status={entry.status}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="text-xs font-semibold text-slate-500">
            แสดงลำดับที่ <strong className="text-slate-900 font-mono">{startIdx + 1}</strong> -{' '}
            <strong className="text-slate-900 font-mono">{Math.min(startIdx + pageSize, visibleEntries.length)}</strong> จากทั้งหมด{' '}
            <strong className="text-teal-700 font-mono">{visibleEntries.length.toLocaleString()}</strong> ข้อ
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(safePage - 1)}
              disabled={safePage === 1}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-35 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              ← ก่อนหน้า
            </button>

            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, idx) => {
                const pageNum = idx + 1
                if (pageNum === 1 || pageNum === totalPages || (pageNum >= safePage - 1 && pageNum <= safePage + 1)) {
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-8 h-8 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center ${
                        safePage === pageNum
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                }
                if ((pageNum === safePage - 2 && pageNum > 1) || (pageNum === safePage + 2 && pageNum < totalPages)) {
                  return <span key={pageNum} className="text-slate-400 px-1 font-mono text-xs">...</span>
                }
                return null
              })}
            </div>

            <button
              type="button"
              onClick={() => handlePageChange(safePage + 1)}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-35 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              ถัดไป →
            </button>

            <form onSubmit={handlePageJumpSubmit} className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-500">หน้า:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                placeholder={String(safePage)}
                value={pageJumpInput}
                onChange={(e) => setPageJumpInput(e.target.value)}
                className="w-12 py-0.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <span className="text-xs text-slate-400 font-mono">/{totalPages}</span>
              <button type="submit" className="px-2 py-0.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs cursor-pointer">
                ไป
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
