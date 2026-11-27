import { useState, useMemo, useRef } from 'react'
import { CheckCircleIcon, InboxIcon } from '../../../shared/components/AdminIcons'
import ExamReviewCard from './ExamReviewCard'

const PAGE_SIZE_OPTIONS = [20, 25, 30, 50]

function RefreshIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  )
}

function HomeIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="m3 10 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

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
    {
      key: 'answered',
      label: 'เฉพาะข้อที่ทำแล้ว',
      count: classified.answered.length,
      activeCls: 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
    },
    {
      key: 'correct',
      label: 'ตอบถูก',
      count: classified.correct.length,
      activeCls: 'bg-emerald-600 text-white border-emerald-600'
    },
    {
      key: 'wrong',
      label: 'ตอบผิด',
      count: classified.wrong.length,
      activeCls: 'bg-rose-600 text-white border-rose-600'
    },
    {
      key: 'unanswered',
      label: 'ยังไม่ทำ',
      count: classified.unanswered.length,
      activeCls: 'bg-amber-600 text-white border-amber-600'
    }
  ]

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 sm:mt-8 space-y-6">
      <section className="bg-white dark:bg-[#181818] rounded-2xl border border-zinc-200 dark:border-[#272727] p-5 sm:p-7 space-y-6 transition-colors duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-100 dark:border-[#272727]">
          <div className="space-y-1.5 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/70 dark:border-indigo-500/20 px-2.5 py-1 rounded-md">
              <CheckCircleIcon className="w-3.5 h-3.5" />
              <span>สรุปผลการสอบ</span>
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
              {categoryName}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              ทำไปแล้ว{' '}
              <strong className="text-zinc-900 dark:text-zinc-100 font-mono tabular-nums font-semibold">
                {answeredCount.toLocaleString()}
              </strong>{' '}
              จากชุดข้อสอบทั้งหมด{' '}
              <strong className="text-zinc-900 dark:text-zinc-100 font-mono tabular-nums font-semibold">
                {questions.length.toLocaleString()}
              </strong>{' '}
              ข้อ
              {classified.unanswered.length > 0 && ' · ข้อที่เว้นว่างจะถูกซ่อนเฉลยและไม่เก็บลงคลังข้อผิดพลาด'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRestartExam}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold text-sm transition-all duration-300 ease-premium cursor-pointer inline-flex items-center gap-1.5"
            >
              <RefreshIcon className="w-4 h-4" />
              <span>ตั้งค่าสอบรอบใหม่</span>
            </button>
            <button
              type="button"
              onClick={onGoHome}
              className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-[#1F1F1F] hover:bg-zinc-200 dark:hover:bg-[#272727] active:scale-[0.98] text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-[#313131] font-semibold text-sm transition-all duration-300 ease-premium cursor-pointer inline-flex items-center gap-1.5"
            >
              <HomeIcon className="w-4 h-4" />
              <span>กลับหน้าหลัก</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-500/25 bg-indigo-50/70 dark:bg-indigo-500/10 p-4">
            <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">คะแนนที่ได้</p>
            <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-indigo-950 dark:text-indigo-100">
              {score.toLocaleString()}{' '}
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                / {answeredCount.toLocaleString()}
              </span>
            </p>
            <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-1 tabular-nums">
              แม่นยำ {accuracyOnAnswered}% (รวมชุด {overallPercent}%)
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-500/25 bg-emerald-50/70 dark:bg-emerald-500/10 p-4">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">ตอบถูก</p>
            <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
              {classified.correct.length.toLocaleString()}
            </p>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-300/75 mt-1">ข้อ</p>
          </div>

          <div className="rounded-xl border border-rose-200/80 dark:border-rose-500/25 bg-rose-50/70 dark:bg-rose-500/10 p-4">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300">ตอบผิด</p>
            <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-300">
              {classified.wrong.length.toLocaleString()}
            </p>
            <p className="text-xs text-rose-700/80 dark:text-rose-300/75 mt-1">บันทึกเข้าคลังข้อผิดแล้ว</p>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-[#272727] bg-zinc-50 dark:bg-[#1F1F1F] p-4">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">ยังไม่ทำ (ซ่อนเฉลย)</p>
            <p className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
              {classified.unanswered.length.toLocaleString()}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">ไม่เก็บเข้าคลังข้อผิด</p>
          </div>
        </div>
      </section>

      <div
        ref={reviewTopRef}
        className="bg-white dark:bg-[#181818] rounded-2xl border border-zinc-200 dark:border-[#272727] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 scroll-mt-20 transition-colors duration-300"
      >
        <div className="flex flex-wrap items-center gap-2">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleFilterChange(tab.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer inline-flex items-center gap-2 ${
                  isActive
                    ? tab.activeCls
                    : 'bg-zinc-50 dark:bg-[#1F1F1F] hover:bg-zinc-100 dark:hover:bg-[#272727] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-[#313131]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-xs font-mono tabular-nums ${
                    isActive
                      ? 'bg-white/20 dark:bg-black/20 text-current'
                      : 'bg-white dark:bg-[#272727] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-[#313131]'
                  }`}
                >
                  {tab.count.toLocaleString()}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
          <label htmlFor="review-page-size" className="font-medium">
            แสดงหน้าละ
          </label>
          <select
            id="review-page-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-[#313131] bg-zinc-50 dark:bg-[#1F1F1F] text-zinc-800 dark:text-zinc-200 font-medium text-xs cursor-pointer focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} ข้อ
              </option>
            ))}
          </select>
        </div>
      </div>

      {visibleEntries.length === 0 ? (
        <div className="bg-white dark:bg-[#181818] rounded-2xl border border-zinc-200 dark:border-[#272727] p-10 text-center space-y-2">
          <div className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-[#1F1F1F] border border-zinc-200 dark:border-[#272727] text-zinc-500 dark:text-zinc-400 flex items-center justify-center mx-auto mb-2">
            <InboxIcon className="w-5 h-5" />
          </div>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">ไม่มีข้อสอบในตัวกรองนี้</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">ลองสลับแท็บตัวกรองด้านบนเพื่อดูข้อสอบกลุ่มอื่น</p>
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
        <div className="bg-white dark:bg-[#181818] p-4 sm:p-5 rounded-2xl border border-zinc-200 dark:border-[#272727] flex flex-col lg:flex-row items-center justify-between gap-4 transition-colors duration-300">
          <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            แสดงลำดับที่{' '}
            <strong className="text-zinc-900 dark:text-zinc-100 font-mono tabular-nums">
              {(startIdx + 1).toLocaleString()}
            </strong>{' '}
            ถึง{' '}
            <strong className="text-zinc-900 dark:text-zinc-100 font-mono tabular-nums">
              {Math.min(startIdx + pageSize, visibleEntries.length).toLocaleString()}
            </strong>{' '}
            จากทั้งหมด{' '}
            <strong className="text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">
              {visibleEntries.length.toLocaleString()}
            </strong>{' '}
            ข้อ
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(safePage - 1)}
              disabled={safePage === 1}
              className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#1F1F1F] hover:bg-zinc-200 dark:hover:bg-[#272727] border border-zinc-200 dark:border-[#313131] disabled:opacity-35 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              ก่อนหน้า
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
                      className={`w-8 h-8 rounded-lg text-xs font-mono tabular-nums font-semibold transition-all cursor-pointer flex items-center justify-center border ${
                        safePage === pageNum
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-zinc-50 dark:bg-[#1F1F1F] hover:bg-zinc-100 dark:hover:bg-[#272727] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-[#313131]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                }
                if ((pageNum === safePage - 2 && pageNum > 1) || (pageNum === safePage + 2 && pageNum < totalPages)) {
                  return (
                    <span key={pageNum} className="text-zinc-400 dark:text-zinc-500 px-1 font-mono text-xs">
                      ...
                    </span>
                  )
                }
                return null
              })}
            </div>

            <button
              type="button"
              onClick={() => handlePageChange(safePage + 1)}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#1F1F1F] hover:bg-zinc-200 dark:hover:bg-[#272727] border border-zinc-200 dark:border-[#313131] disabled:opacity-35 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              ถัดไป
            </button>

            <form
              onSubmit={handlePageJumpSubmit}
              className="flex items-center gap-1.5 bg-zinc-50 dark:bg-[#1F1F1F] px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-[#272727]"
            >
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">หน้า</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                placeholder={String(safePage)}
                value={pageJumpInput}
                onChange={(e) => setPageJumpInput(e.target.value)}
                className="w-12 py-0.5 bg-white dark:bg-[#272727] border border-zinc-300 dark:border-[#313131] rounded-md text-xs font-mono tabular-nums font-semibold text-center text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono tabular-nums">/{totalPages}</span>
              <button
                type="submit"
                className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md text-xs cursor-pointer transition-colors"
              >
                ไป
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
