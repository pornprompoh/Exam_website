import { useState, useEffect, useRef } from 'react'
import { getGeminiModelLabel } from '../../../../shared/lib/geminiModels'
import { AlertTriangleIcon, CheckCircleIcon, CloseIcon } from '../../../../shared/components/AdminIcons'

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
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 dark:bg-black/75 p-4 backdrop-blur-xs animate-fadeIn"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="override-audit-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 text-slate-800 dark:text-slate-200 shadow-2xl space-y-5 animate-scaleUp"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-start gap-3 min-w-0">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                reverted
                  ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}
            >
              {reverted ? <CheckCircleIcon className="w-5 h-5" /> : <AlertTriangleIcon className="w-5 h-5" />}
            </span>
            <div className="min-w-0">
              <h3 id="override-audit-title" className="text-base font-bold text-slate-900 dark:text-white">
                {reverted ? 'ย้อนกลับไปใช้เฉลยตามหนังสือแล้ว' : 'เปรียบเทียบเฉลย: หนังสือ vs AI แก้เฉลย'}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                {item.source_question_number && (
                  <span className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 px-2 py-0.5 font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                    ต้นฉบับ #{item.source_question_number}
                  </span>
                )}
                {item.source_section && (
                  <span className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 px-2 py-0.5 font-medium text-slate-700 dark:text-slate-300">
                    {item.source_section}
                  </span>
                )}
                {item.source_page && (
                  <span className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 px-2 py-0.5 tabular-nums">
                    หน้า {item.source_page}
                  </span>
                )}
                {item.verified_by_model && (
                  <span className="rounded-md border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 font-medium text-indigo-700 dark:text-indigo-300">
                    ตรวจโดย {getGeminiModelLabel(item.verified_by_model)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="h-9 w-9 shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-pointer transition-colors"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 p-4 space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">โจทย์คำถาม</p>
          <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-900 dark:text-white break-words">
            {item.question_text}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            className={`rounded-xl border p-4 space-y-2 ${
              reverted
                ? 'border-emerald-300 dark:border-emerald-500/50 bg-emerald-50/70 dark:bg-emerald-500/10 ring-1 ring-emerald-500/20'
                : 'border-rose-200 dark:border-rose-500/35 bg-rose-50/60 dark:bg-rose-500/10'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs font-semibold ${
                  reverted ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'
                }`}
              >
                เฉลยเดิมจากหนังสือ
              </span>
              {bookIdx !== null && (
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                    reverted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-rose-100 dark:bg-rose-500/25 text-rose-800 dark:text-rose-200'
                  }`}
                >
                  ตัวเลือก {bookIdx + 1} ({getChoiceLetter(bookIdx)})
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-900 dark:text-white break-words">
              {bookOptionText}
            </p>
            {reverted && (
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                ✓ กำลังใช้งานคำตอบนี้ (book_verified)
              </p>
            )}
          </div>

          <div
            className={`rounded-xl border p-4 space-y-2 ${
              reverted
                ? 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 opacity-65'
                : 'border-amber-300 dark:border-amber-500/45 bg-amber-50/70 dark:bg-amber-500/10 ring-1 ring-amber-500/20'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">เฉลยที่ AI แก้ให้</span>
              {aiIdx !== null && (
                <span className="rounded-md bg-amber-100 dark:bg-amber-500/25 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-900 dark:text-amber-200">
                  ตัวเลือก {aiIdx + 1} ({getChoiceLetter(aiIdx)})
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-900 dark:text-white break-words">
              {aiOptionText}
            </p>
            {!reverted && (
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">ค่าที่เลือกใช้งานอยู่ปัจจุบัน</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 dark:border-orange-500/30 bg-amber-50/60 dark:bg-orange-500/10 p-4 space-y-1.5">
          <p className="text-xs font-semibold text-amber-900 dark:text-orange-300">
            เหตุผลที่ AI มองว่าเฉลยหนังสือผิด และเลือกคำตอบใหม่แทน
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-orange-100 break-words">
            {item.override_reason || 'ไม่มีรายละเอียดเหตุผลเพิ่มเติม'}
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="override-explanation-input"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            {reverted
              ? 'แก้ไขคำอธิบายเฉลยสำหรับเฉลยตามหนังสือ (ปรับแก้แล้วบันทึกได้ทันที)'
              : 'คำอธิบายเฉลยที่จะแสดงให้ผู้สอบเห็น (ปรับแก้ก่อนยืนยันได้)'}
          </label>
          <textarea
            id="override-explanation-input"
            ref={explanationInputRef}
            rows={3}
            value={explanationDraft}
            onChange={(e) => setExplanationDraft(e.target.value)}
            placeholder="พิมพ์คำอธิบายเฉลย 1–3 ประโยคที่กระชับ ชัดเจน..."
            className={`w-full rounded-xl border bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-900 dark:text-white outline-none transition-colors ${
              reverted
                ? 'border-emerald-400 dark:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/30'
                : 'border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500'
            }`}
          />
        </div>

        {errorMsg && (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs font-medium text-rose-700 dark:text-rose-300"
          >
            {errorMsg}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800 pt-4">
          {reverted ? (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveRevertedExplanation}
                className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-5 text-xs font-semibold text-white cursor-pointer transition-colors"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึกคำอธิบายและปิดหน้าต่าง'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={saving || bookIdx === null}
                onClick={handleRevertToBook}
                className="h-10 rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 disabled:opacity-40 px-4 text-xs font-semibold text-emerald-800 dark:text-emerald-300 transition-colors cursor-pointer"
              >
                {saving ? 'กำลังสลับเฉลย...' : 'ย้อนกลับไปใช้เฉลยตามหนังสือ'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmAi}
                className="h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-5 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                {saving ? 'กำลังบันทึก...' : 'ยืนยันใช้เฉลย AI'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
