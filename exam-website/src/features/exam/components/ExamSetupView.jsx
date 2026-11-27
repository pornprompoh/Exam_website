import { Link } from 'react-router-dom'
import Navbar from '../../../shared/components/Navbar'
import { formatExamTime } from '../utils/examShuffleUtils'

const TIME_OPTIONS = [
  { label: '🛑 ไม่จับเวลา (ชิลๆ)', value: 0 },
  { label: '⏱️ 30 นาที', value: 30 },
  { label: '⏱️ 60 นาที', value: 60 },
  { label: '✏️ กำหนดเวลาเอง', value: -1 }
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
    <div className="min-h-screen bg-slate-50/70 pb-24 font-sans text-slate-800">
      <Navbar
        showNavPills={true}
        customLeftContent={
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            <Link to="/" className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center font-bold transition-all shrink-0">←</Link>
            <div className="min-w-0">
              <span className="font-black text-sm sm:text-lg text-slate-900 tracking-tight block truncate">{categoryName}</span>
              <span className="block text-[10px] sm:text-[11px] font-bold text-teal-600 -mt-0.5 tracking-wide truncate">ตั้งค่าห้องสอบก่อนเริ่มทำข้อสอบ</span>
            </div>
          </div>
        }
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 mt-8 sm:mt-12 space-y-5">
        {pendingAutosave && (
          <div className="w-full bg-amber-50 border-2 border-amber-300 rounded-3xl p-5 sm:p-6 shadow-md space-y-4 animate-fadeIn">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-2xl bg-amber-200/80 text-amber-800 flex items-center justify-center text-xl shrink-0">📌</span>
              <div className="min-w-0 space-y-1">
                <h2 className="text-sm sm:text-base font-black text-amber-950">
                  พบการทำข้อสอบค้างไว้ {draftAnsweredCount.toLocaleString()} / {pendingAutosave.questionIds.length.toLocaleString()} ข้อ
                </h2>
                <p className="text-xs text-amber-900/80 leading-relaxed">
                  บันทึกล่าสุดเมื่อ{' '}
                  <strong className="font-mono">
                    {new Date(pendingAutosave.savedAt).toLocaleString('th-TH', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}{' '}
                    น.
                  </strong>
                  {pendingAutosave.timerConfig?.totalTimeSeconds > 0 && (
                    <> · เวลาที่หยุดพักไว้เหลือ <strong className="font-mono text-amber-950">{formatExamTime(pendingAutosave.remainingSeconds)}</strong></>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={onResumeAutosave}
                className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black text-xs sm:text-sm shadow-sm cursor-pointer transition-all"
              >
                ▶️ ทำต่อจากเดิม (ข้อที่ {(pendingAutosave.currentIndex || 0) + 1})
              </button>
              <button
                type="button"
                onClick={onDiscardAutosave}
                className="sm:w-auto py-3 px-4 rounded-2xl bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs sm:text-sm cursor-pointer transition-all"
              >
                🔄 เริ่มทำใหม่
              </button>
            </div>
          </div>
        )}

        <div className="w-full bg-white p-5 sm:p-10 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-900/5 space-y-7 sm:space-y-8 animate-fadeIn">
          <div className="text-center space-y-2 pb-6 border-b border-slate-100">
            <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">⚙️</div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">ปรับแต่งรูปแบบการสอบของคุณ</h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              เลือกหรือพิมพ์จำนวนข้อและเวลาในการสอบที่ต้องการได้ตามใจชอบ ระบบจะทำการสุ่มโจทย์จากทั้งคลังและสลับตัวเลือกใหม่ทุกรอบครับ
            </p>
          </div>

          <div className="space-y-3.5">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              1. เลือกจำนวนข้อสอบ (จากทั้งหมดที่มี {maxQ.toLocaleString()} ข้อ) *
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {countOptions.map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => onSelectCountBtn(cnt)}
                  className={`min-h-12 py-3 px-3 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                    selectedCount === cnt && parseInt(customCountInput, 10) === cnt
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-[1.02]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                  }`}
                >
                  <span className="text-base sm:text-lg font-mono">{cnt.toLocaleString()}</span>
                  <span className="text-[10px] opacity-70">{cnt === maxQ ? 'ทั้งหมด' : 'ข้อ'}</span>
                </button>
              ))}
            </div>

            <div className="pt-1">
              <div className="flex items-center justify-between bg-slate-50/80 border border-slate-200 rounded-2xl px-4 py-2.5">
                <span className="text-xs font-bold text-slate-600">✏️ กำหนดจำนวนข้อเอง (1 - {maxQ.toLocaleString()}):</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={maxQ}
                    value={customCountInput}
                    onChange={(e) => onCustomCountChange(e.target.value)}
                    placeholder={`1-${maxQ}`}
                    className="w-24 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-black text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                  />
                  <span className="text-xs font-bold text-slate-500">ข้อ</span>
                </div>
              </div>
              {parseInt(customCountInput, 10) > maxQ && (
                <p className="text-[11px] text-red-500 font-bold mt-1.5 pl-1">
                  * ปรับเป็น {maxQ.toLocaleString()} ข้อให้อัตโนมัติ (ไม่เกินจำนวนข้อสอบที่มีจริง)
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3.5">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              2. กำหนดเวลาในการสอบ (COUNTDOWN TIMER) *
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {TIME_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => onSelectTimeLimit(t.value)}
                  className={`min-h-12 p-3.5 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer border text-left flex items-center justify-between ${
                    selectedTimeLimit === t.value
                      ? 'bg-teal-600 text-white border-teal-600 shadow-md scale-[1.01]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                  }`}
                >
                  <span>{t.label}</span>
                  {selectedTimeLimit === t.value && <span className="text-base">✓</span>}
                </button>
              ))}
            </div>

            {selectedTimeLimit === -1 && (
              <div className="pt-2 animate-fadeIn">
                <div className="flex items-center justify-between bg-teal-50/60 border-2 border-teal-500 rounded-2xl px-4 py-2.5">
                  <span className="text-xs font-bold text-teal-900">⏱️ พิมพ์จำนวนนาทีที่ต้องการ:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={customTimeInput}
                      onChange={(e) => onCustomTimeChange(e.target.value)}
                      placeholder="เช่น 45"
                      className="w-20 px-3 py-1.5 bg-white border border-teal-400 rounded-xl text-sm font-black text-center text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                    />
                    <span className="text-xs font-bold text-teal-800">นาที</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs sm:text-sm text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">📋</span>
              <span>สรุปการสอบรอบนี้:</span>
            </div>
            <div className="font-extrabold font-mono text-amber-950">
              {selectedCount.toLocaleString()} ข้อ &bull; {displayTimeText}
            </div>
          </div>

          <button
            type="button"
            onClick={onStartExam}
            className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black rounded-2xl text-sm sm:text-base transition-all shadow-lg hover:shadow-xl cursor-pointer flex items-center justify-center gap-2"
          >
            <span>🚀</span><span>เริ่มจับเวลาและทำข้อสอบทันที</span>
          </button>
        </div>
      </div>
    </div>
  )
}
