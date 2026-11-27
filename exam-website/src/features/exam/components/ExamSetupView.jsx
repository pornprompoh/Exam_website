import { Link } from 'react-router-dom'
import Navbar from '../../../shared/components/Navbar'
import { EditIcon, SettingsIcon } from '../../../shared/components/AdminIcons'
import { formatExamTime } from '../utils/examShuffleUtils'

function ArrowLeftIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  )
}

function ArrowRightIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  )
}

function ClockIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function BookmarkIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function PlayIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  )
}

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

function CheckIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

const TIME_OPTIONS = [
  { label: 'ไม่จับเวลา (ฝึกทำอิสระ)', value: 0, icon: 'none' },
  { label: '30 นาที', value: 30, icon: 'clock' },
  { label: '60 นาที', value: 60, icon: 'clock' },
  { label: 'กำหนดเวลาเอง', value: -1, icon: 'edit' }
]

export default function ExamSetupView({
  categoryName,
  totalBankCount,
  selectedCount,
  customCountInput,
  selectedTimeLimit,
  customTimeInput,
  pendingAutosave,
  onSelectCountBtn,
  onCustomCountChange,
  onSelectTimeLimit,
  onCustomTimeChange,
  onResumeAutosave,
  onDiscardAutosave,
  onStartExam
}) {
  const maxQ = totalBankCount
  const countOptions = [10, 20, 30, maxQ].filter((val, idx, self) => val <= maxQ && self.indexOf(val) === idx)
  if (!countOptions.includes(maxQ)) countOptions.push(maxQ)

  const displayTimeText =
    selectedTimeLimit === 0
      ? 'ไม่จับเวลา'
      : selectedTimeLimit === -1
        ? customTimeInput
          ? `${customTimeInput} นาที`
          : 'กำหนดเอง'
        : `${selectedTimeLimit} นาที`

  const draftAnsweredCount = pendingAutosave ? Object.keys(pendingAutosave.answers || {}).length : 0

  return (
    <div className="min-h-dvh bg-[#f8f8f9] dark:bg-[#000000] pb-24 font-sans text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
      <Navbar
        showNavPills={true}
        customLeftContent={
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 min-w-0">
            <Link
              to="/"
              aria-label="กลับไปหน้าหลัก"
              className="w-9 h-9 bg-zinc-100 dark:bg-[#1F1F1F] hover:bg-zinc-200 dark:hover:bg-[#272727] text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-[#272727] rounded-xl flex items-center justify-center transition-all duration-300 ease-premium active:scale-[0.98] shrink-0"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <span className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100 tracking-tight block truncate">
                {categoryName}
              </span>
              <span className="block text-xs font-medium text-indigo-600 dark:text-indigo-400 truncate">
                ตั้งค่าห้องสอบก่อนเริ่มทำข้อสอบ
              </span>
            </div>
          </div>
        }
      />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 mt-6 sm:mt-10 space-y-5">
        {pendingAutosave && (
          <section className="w-full bg-amber-50/90 dark:bg-[#131209] border border-amber-300 dark:border-amber-500/30 rounded-2xl p-5 sm:p-6 space-y-4 animate-fadeIn">
            <div className="flex items-start gap-3.5">
              <span className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25 flex items-center justify-center shrink-0">
                <BookmarkIcon className="w-5 h-5" />
              </span>
              <div className="min-w-0 space-y-1">
                <h2 className="text-sm sm:text-base font-bold text-amber-950 dark:text-amber-200">
                  พบการทำข้อสอบค้างไว้{' '}
                  <span className="font-mono tabular-nums">
                    {draftAnsweredCount.toLocaleString()} / {pendingAutosave.questionIds.length.toLocaleString()}
                  </span>{' '}
                  ข้อ
                </h2>
                <p className="text-xs sm:text-sm text-amber-900/80 dark:text-amber-300/80 leading-relaxed">
                  บันทึกล่าสุดเมื่อ{' '}
                  <strong className="font-mono tabular-nums font-semibold">
                    {new Date(pendingAutosave.savedAt).toLocaleString('th-TH', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}{' '}
                    น.
                  </strong>
                  {pendingAutosave.timerConfig?.totalTimeSeconds > 0 && (
                    <>
                      {' '}
                      · เวลาที่หยุดพักไว้เหลือ{' '}
                      <strong className="font-mono tabular-nums font-semibold text-amber-950 dark:text-amber-100">
                        {formatExamTime(pendingAutosave.remainingSeconds)}
                      </strong>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={onResumeAutosave}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold text-sm cursor-pointer transition-all duration-300 ease-premium inline-flex items-center justify-center gap-2"
              >
                <PlayIcon className="w-4 h-4" />
                <span>ทำต่อจากเดิม (ข้อที่ {((pendingAutosave.currentIndex || 0) + 1).toLocaleString()})</span>
              </button>
              <button
                type="button"
                onClick={onDiscardAutosave}
                className="sm:w-auto py-2.5 px-4 rounded-xl bg-white dark:bg-[#1F1F1F] hover:bg-amber-100/70 dark:hover:bg-[#272727] active:scale-[0.98] border border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 font-semibold text-sm cursor-pointer transition-all duration-300 ease-premium inline-flex items-center justify-center gap-2"
              >
                <RefreshIcon className="w-4 h-4" />
                <span>เริ่มทำใหม่</span>
              </button>
            </div>
          </section>
        )}

        <section className="w-full bg-white dark:bg-[#181818] p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-[#272727] space-y-7 animate-fadeIn">
          <div className="text-center space-y-2 pb-6 border-b border-zinc-100 dark:border-[#272727]">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/70 dark:border-indigo-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <SettingsIcon className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              ปรับแต่งรูปแบบการสอบของคุณ
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
              เลือกหรือกำหนดจำนวนข้อและเวลาสอบตามต้องการ ระบบจะสุ่มโจทย์จากคลังและสลับลำดับตัวเลือกใหม่ทุกรอบ
            </p>
          </div>

          <div className="space-y-3.5">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 tracking-wide">
              1. เลือกจำนวนข้อสอบ (มีในคลังทั้งหมด{' '}
              <span className="font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                {maxQ.toLocaleString()}
              </span>{' '}
              ข้อ)
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {countOptions.map((cnt) => {
                const isSelected = selectedCount === cnt && parseInt(customCountInput, 10) === cnt
                return (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => onSelectCountBtn(cnt)}
                    className={`min-h-14 py-3 px-3 rounded-xl font-semibold text-sm transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-zinc-50 dark:bg-[#1F1F1F] hover:bg-zinc-100 dark:hover:bg-[#272727] text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-[#313131]'
                    }`}
                  >
                    <span className="text-base sm:text-lg font-mono tabular-nums font-bold">
                      {cnt.toLocaleString()}
                    </span>
                    <span className={`text-xs font-medium ${isSelected ? 'text-indigo-100' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {cnt === maxQ ? 'ทั้งหมด' : 'ข้อ'}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="pt-1">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-50 dark:bg-[#1F1F1F] border border-zinc-200 dark:border-[#272727] rounded-xl px-4 py-2.5">
                <label htmlFor="custom-question-count" className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-2">
                  <EditIcon className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                  <span>กำหนดจำนวนข้อเอง (1 ถึง {maxQ.toLocaleString()})</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="custom-question-count"
                    type="number"
                    min="1"
                    max={maxQ}
                    value={customCountInput}
                    onChange={(e) => onCustomCountChange(e.target.value)}
                    placeholder={`1-${maxQ}`}
                    className="w-24 px-3 py-1.5 bg-white dark:bg-[#272727] border border-zinc-300 dark:border-[#313131] rounded-lg text-sm font-mono tabular-nums font-semibold text-center text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">ข้อ</span>
                </div>
              </div>
              {parseInt(customCountInput, 10) > maxQ && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1.5 pl-1">
                  ปรับเป็น {maxQ.toLocaleString()} ข้อให้อัตโนมัติตามจำนวนข้อสอบที่มีจริงในคลัง
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3.5">
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 tracking-wide">
              2. กำหนดเวลาในการสอบ
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TIME_OPTIONS.map((t) => {
                const isSelected = selectedTimeLimit === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => onSelectTimeLimit(t.value)}
                    className={`min-h-12 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer border text-left flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 font-semibold'
                        : 'bg-zinc-50 dark:bg-[#1F1F1F] hover:bg-zinc-100 dark:hover:bg-[#272727] text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-[#313131]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {t.icon === 'edit' ? (
                        <EditIcon className={`w-4 h-4 ${isSelected ? 'text-indigo-100' : 'text-zinc-400 dark:text-zinc-500'}`} />
                      ) : (
                        <ClockIcon className={`w-4 h-4 ${isSelected ? 'text-indigo-100' : 'text-zinc-400 dark:text-zinc-500'}`} />
                      )}
                      <span>{t.label}</span>
                    </span>
                    {isSelected && <CheckIcon className="w-4 h-4" />}
                  </button>
                )
              })}
            </div>

            {selectedTimeLimit === -1 && (
              <div className="pt-1 animate-fadeIn">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/70 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl px-4 py-2.5">
                  <label htmlFor="custom-time-minutes" className="text-xs sm:text-sm font-medium text-indigo-900 dark:text-indigo-200 inline-flex items-center gap-2">
                    <ClockIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>ระบุจำนวนนาทีที่ต้องการ</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="custom-time-minutes"
                      type="number"
                      min="1"
                      max="120"
                      value={customTimeInput}
                      onChange={(e) => onCustomTimeChange(e.target.value)}
                      placeholder="เช่น 45"
                      className="w-20 px-3 py-1.5 bg-white dark:bg-[#1F1F1F] border border-indigo-300 dark:border-indigo-500/40 rounded-lg text-sm font-mono tabular-nums font-semibold text-center text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                    <span className="text-xs font-medium text-indigo-800 dark:text-indigo-300">นาที</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-[#1F1F1F] border border-zinc-200 dark:border-[#272727] text-sm text-zinc-600 dark:text-zinc-400 flex flex-wrap items-center justify-between gap-2">
            <span>สรุปการสอบรอบนี้</span>
            <div className="font-semibold font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
              {selectedCount.toLocaleString()} ข้อ &middot; {displayTimeText}
            </div>
          </div>

          <button
            type="button"
            onClick={onStartExam}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold rounded-xl text-sm sm:text-base transition-all duration-300 ease-premium cursor-pointer flex items-center justify-center gap-2"
          >
            <span>เริ่มทำข้อสอบ</span>
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </section>
      </main>
    </div>
  )
}
