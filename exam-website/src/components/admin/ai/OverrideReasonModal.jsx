import { useState, useEffect, useRef } from 'react'
import { getGeminiModelLabel } from '../../../lib/geminiModels'

function getChoiceLetter(index) {
  const letters = ['A', 'B', 'C', 'D', 'E']
  return letters[index] || String(index + 1)
}

export default function OverrideReasonModal({
  item,
  onClose,
  onConfirmAiAnswer,
  onRevertToBookAnswer,
  onSaveExplanationOnly
}) {
  const [saving, setSaving] = useState(false)
  const [reverted, setReverted] = useState(false)
  const [explanationDraft, setExplanationDraft] = useState(item?.explanation || '')
  const [errorMsg, setErrorMsg] = useState('')
  const explanationInputRef = useRef(null)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !saving) onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving])

  if (!item) return null

  const options = Array.isArray(item.options) ? item.options : []
  const bookIdx = item.book_answer !== null && item.book_answer !== undefined ? Number(item.book_answer) : null
  const aiIdx = item.correct_option !== null && item.correct_option !== undefined ? Number(item.correct_option) : null

  const bookOptionText = bookIdx !== null && options[bookIdx] !== undefined ? options[bookIdx] : '(ไม่พบข้อความตัวเลือก)'
  const aiOptionText = aiIdx !== null && options[aiIdx] !== undefined ? options[aiIdx] : '(ไม่พบข้อความตัวเลือก)'

  const handleConfirmAi = async () => {
    setSaving(true)
    setErrorMsg('')
    try {
      await onConfirmAiAnswer?.(item, explanationDraft)
      onClose?.()
    } catch (error) {
      setErrorMsg(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRevertToBook = async () => {
    if (bookIdx === null) {
      setErrorMsg('ไม่พบเฉลยต้นฉบับจากหนังสือสำหรับข้อสอบข้อนี้')
      return
    }
    setSaving(true)
    setErrorMsg('')
    try {
      const nextExplanation = item.book_explanation || explanationDraft || `เฉลยตามหนังสือคือ "${bookOptionText}"`
      await onRevertToBookAnswer?.(item, nextExplanation)
      setExplanationDraft(nextExplanation)
      setReverted(true)
      setTimeout(() => {
        explanationInputRef.current?.focus()
      }, 60)
    } catch (error) {
      setErrorMsg(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRevertedExplanation = async () => {
    setSaving(true)
    setErrorMsg('')
    try {
      await onSaveExplanationOnly?.(item, explanationDraft)
      onClose?.()
    } catch (error) {
      setErrorMsg(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="presentation"
      onClick={() => !saving && onClose?.()}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="override-audit-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-orange-500/35 bg-slate-900 p-5 sm:p-7 text-slate-200 shadow-2xl space-y-5 animate-scaleUp"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/15 text-xl">
              {reverted ? '✅' : '⚖️'}
            </span>
            <div className="min-w-0">
              <h3 id="override-audit-title" className="text-base sm:text-lg font-black text-white">
                {reverted ? 'ย้อนกลับไปใช้เฉลยตามหนังสือแล้ว' : 'เปรียบเทียบเฉลย: หนังสือ vs AI แก้เฉลย'}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                {item.source_question_number && (
                  <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 font-bold text-slate-300">
                    ต้นฉบับ #{item.source_question_number}
                  </span>
                )}
                {item.source_section && (
                  <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 font-bold text-slate-300">
                    {item.source_section}
                  </span>
                )}
                {item.source_page && (
                  <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-slate-400">
                    หน้า {item.source_page}
                  </span>
                )}
                {item.verified_by_model && (
                  <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-bold text-indigo-300">
                    🤖 ตรวจโดย: {getGeminiModelLabel(item.verified_by_model)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="h-9 w-9 shrink-0 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Question Stem */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">โจทย์คำถาม</p>
          <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-white break-words">
            {item.question_text}
          </p>
        </div>

        {/* Side-by-side Full Option Text Comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className={`rounded-2xl border p-4 space-y-2 ${
            reverted
              ? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30'
              : 'border-rose-500/35 bg-rose-500/10'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-black ${reverted ? 'text-emerald-300' : 'text-rose-300'}`}>
                📖 เฉลยเดิมจากหนังสือ
              </span>
              {bookIdx !== null && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-black ${
                  reverted ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500/20 text-rose-200'
                }`}>
                  ตัวเลือก {bookIdx + 1} ({getChoiceLetter(bookIdx)})
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-white break-words">
              {bookOptionText}
            </p>
            {reverted && (
              <p className="text-[11px] font-bold text-emerald-300">
                ✓ กำลังใช้งานคำตอบนี้ (สถานะ: book_verified)
              </p>
            )}
          </div>

          <div className={`rounded-2xl border p-4 space-y-2 ${
            reverted
              ? 'border-slate-800 bg-slate-950/60 opacity-65'
              : 'border-amber-500/45 bg-amber-500/10 ring-1 ring-amber-500/25'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-amber-300">
                🤖 เฉลยที่ AI แก้ให้
              </span>
              {aiIdx !== null && (
                <span className="rounded-full bg-amber-500/25 px-2 py-0.5 text-[10px] font-mono font-black text-amber-200">
                  ตัวเลือก {aiIdx + 1} ({getChoiceLetter(aiIdx)})
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-white break-words">
              {aiOptionText}
            </p>
            {!reverted && (
              <p className="text-[11px] font-bold text-amber-300">
                ⚡ ค่าที่เลือกใช้งานอยู่ปัจจุบัน
              </p>
            )}
          </div>
        </div>

        {/* Override Reason Analysis */}
        <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4 space-y-2">
          <p className="text-xs font-black text-orange-300 flex items-center gap-1.5">
            <span>🔎</span>
            <span>เหตุผลเชิงวิเคราะห์ที่ AI มองว่าเฉลยหนังสือผิด และเลือกคำตอบใหม่แทน</span>
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-orange-100 break-words">
            {item.override_reason || 'ไม่มีรายละเอียดเหตุผลเพิ่มเติม'}
          </p>
        </div>

        {/* Editable Explanation Box (immediately ready especially after reverting!) */}
        <div className="space-y-2">
          <label htmlFor="override-explanation-input" className="block text-xs font-bold text-slate-300">
            {reverted
              ? '✏️ แก้ไขคำอธิบายเฉลยสำหรับเฉลยตามหนังสือ (ปรับแก้แล้วกดบันทึกได้ทันที)'
              : '💡 คำอธิบายเฉลยที่จะแสดงให้ผู้สอบเห็น (ปรับแก้ก่อนยืนยันได้)'}
          </label>
          <textarea
            id="override-explanation-input"
            ref={explanationInputRef}
            rows={3}
            value={explanationDraft}
            onChange={(e) => setExplanationDraft(e.target.value)}
            placeholder="พิมพ์คำอธิบายเฉลย 1–3 ประโยคที่กระชับ ชัดเจน..."
            className={`w-full rounded-2xl border bg-slate-950 p-3.5 text-sm text-white outline-none transition-colors ${
              reverted
                ? 'border-emerald-500/60 focus:border-emerald-400 ring-2 ring-emerald-500/15'
                : 'border-slate-700 focus:border-amber-500'
            }`}
          />
        </div>

        {errorMsg && (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-300">
            ⚠️ {errorMsg}
          </p>
        )}

        {/* Decision Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t border-slate-800 pt-4">
          {reverted ? (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-3 text-xs font-bold text-slate-300 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveRevertedExplanation}
                className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 px-5 py-3 text-xs font-black text-white shadow cursor-pointer"
              >
                {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึกคำอธิบายและปิดหน้าต่าง'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={saving || bookIdx === null}
                onClick={handleRevertToBook}
                className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-40 px-4 py-3 text-xs font-black text-emerald-300 transition-colors cursor-pointer"
              >
                {saving ? '⏳ กำลังสลับเฉลย...' : '↩️ ย้อนกลับไปใช้เฉลยตามหนังสือ'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmAi}
                className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 px-5 py-3 text-xs font-black text-slate-950 shadow cursor-pointer"
              >
                {saving ? '⏳ กำลังบันทึก...' : '✅ ยืนยันใช้เฉลย AI'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
