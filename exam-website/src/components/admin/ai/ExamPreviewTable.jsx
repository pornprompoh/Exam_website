import { useState } from 'react'
import { getGeminiModelLabel } from '../../../lib/geminiModels'

function createDraft(question) {
  return {
    ...question,
    options: [...question.options]
  }
}

function resolveStatus(item) {
  if (['pending_answer', 'book_verified', 'ai_overridden', 'ai_solved'].includes(item?.answer_status)) {
    return item.answer_status
  }
  if (item?.correct_option === null || item?.correct_option === undefined) return 'pending_answer'
  if (item?.is_ai_solved) return 'ai_solved'
  return 'book_verified'
}

export default function ExamPreviewTable({
  questions,
  onSaveQuestion,
  onRemoveQuestion,
  selectable = false,
  selectedIds = [],
  onToggleSelect = null,
  showExtractionMeta = false,
  useExternalRemoveConfirm = false,
  onInspectOverride = null
}) {
  const [editingIndex, setEditingIndex] = useState(null)
  const [draft, setDraft] = useState(null)

  const startEditing = (index, question) => {
    setEditingIndex(index)
    setDraft(createDraft(question))
  }

  const cancelEditing = () => {
    setEditingIndex(null)
    setDraft(null)
  }

  const saveEditing = () => {
    if (!draft.question_text.trim() || draft.options.some((option) => !option.trim())) {
      return
    }

    const hasChosenOption =
      draft.correct_option !== null &&
      draft.correct_option !== undefined &&
      draft.correct_option !== '' &&
      Number.isInteger(Number(draft.correct_option))

    const currentStatus = resolveStatus(draft)
    const nextStatus = currentStatus === 'pending_answer' && hasChosenOption
      ? 'book_verified'
      : draft.answer_status

    onSaveQuestion(editingIndex, {
      ...draft,
      question_text: draft.question_text.trim(),
      options: draft.options.map((option) => option.trim()),
      correct_option: hasChosenOption ? Number(draft.correct_option) : null,
      answer_status: nextStatus,
      explanation: (draft.explanation || '').trim()
    })
    cancelEditing()
  }

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const updateDraftOption = (optionIndex, value) => {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option, index) => index === optionIndex ? value : option)
    }))
  }

  const confirmRemove = (index, item) => {
    if (useExternalRemoveConfirm) {
      onRemoveQuestion(index, item)
      if (editingIndex === index) cancelEditing()
      return
    }
    if (window.confirm(`ยืนยันลบข้อที่ ${index + 1} ใช่หรือไม่?`)) {
      onRemoveQuestion(index, item)
      if (editingIndex === index) cancelEditing()
      else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1)
    }
  }

  const renderAnswerStatusBadge = (item) => {
    const status = resolveStatus(item)
    switch (status) {
      case 'book_verified':
        return (
          <span className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-black text-emerald-300">
            ✅ เฉลยหนังสือ (ตรวจแล้ว)
          </span>
        )
      case 'ai_overridden':
        return (
          <button
            type="button"
            onClick={() => onInspectOverride?.(item)}
            className="rounded-full border border-orange-500/50 bg-gradient-to-r from-orange-500/20 to-red-500/20 hover:from-orange-500/35 hover:to-red-500/35 px-3 py-0.5 text-[11px] font-black text-orange-300 transition-all cursor-pointer shadow-xs flex items-center gap-1"
            title="คลิกเพื่อเปรียบเทียบเฉลยหนังสือ vs AI และดูเหตุผล"
          >
            <span>⚠️ AI แก้เฉลย (คลิกดูเหตุผล)</span>
          </button>
        )
      case 'ai_solved':
        return (
          <span className="rounded-full border border-sky-500/40 bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-black text-sky-300">
            🤖 AI เฉลย (ไม่มีเฉลยในไฟล์)
          </span>
        )
      case 'pending_answer':
      default:
        return (
          <span className="rounded-full border border-slate-600 bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-slate-300">
            ⏳ รอจับคู่เฉลย
          </span>
        )
    }
  }

  return (
    <div className="space-y-4">
      {questions.map((item, index) => {
        const isEditing = editingIndex === index
        const displayedQuestion = isEditing ? draft : item
        const itemKey = item.id || `${index}-${item.source_topic || item.source_question_number || ''}`
        const isSelected = selectable && item.id && selectedIds.includes(item.id)
        const status = resolveStatus(item)
        const hasCorrectOption =
          item.correct_option !== null &&
          item.correct_option !== undefined &&
          Number.isInteger(Number(item.correct_option))
        const bookIdx =
          item.book_answer !== null &&
          item.book_answer !== undefined &&
          Number.isInteger(Number(item.book_answer))
            ? Number(item.book_answer)
            : null

        return (
          <article
            key={itemKey}
            className={`space-y-4 rounded-2xl border bg-slate-950 p-4 transition-colors ${
              isEditing
                ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                : status === 'ai_overridden' && showExtractionMeta
                  ? 'border-orange-500/40 bg-orange-950/10'
                  : isSelected
                    ? 'border-sky-500/60 bg-sky-950/10'
                    : 'border-slate-800'
            }`}
          >
            <header className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                {selectable && item.id && (
                  <input
                    type="checkbox"
                    checked={Boolean(isSelected)}
                    onChange={() => onToggleSelect?.(item.id)}
                    aria-label={`เลือกข้อที่ ${index + 1}`}
                    className="h-4 w-4 accent-sky-500 rounded cursor-pointer shrink-0"
                  />
                )}
                <span className="text-xs font-black text-indigo-300">ข้อที่ {index + 1}</span>
                {showExtractionMeta && item.source_question_number && (
                  <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-slate-300">
                    ต้นฉบับ #{item.source_question_number}
                  </span>
                )}
                {showExtractionMeta && item.source_section && (
                  <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-indigo-200 max-w-[200px] truncate" title={item.source_section}>
                    {item.source_section}
                  </span>
                )}
                {showExtractionMeta && item.source_page && (
                  <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-slate-400">
                    หน้า {item.source_page}
                  </span>
                )}
                {showExtractionMeta && renderAnswerStatusBadge(item)}
              </div>

              {isEditing ? (
                <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-bold text-indigo-300">
                  กำลังแก้ไข
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEditing(index, item)}
                    className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-300 transition-colors hover:bg-indigo-500/20 cursor-pointer"
                  >
                    ✏️ แก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmRemove(index, item)}
                    className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/20 cursor-pointer"
                  >
                    ลบข้อนี้
                  </button>
                </div>
              )}
            </header>

            {isEditing ? (
              <>
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-400">โจทย์คำถาม</span>
                  <textarea
                    value={displayedQuestion.question_text}
                    onChange={(event) => updateDraft('question_text', event.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </label>

                <fieldset className="grid gap-2 sm:grid-cols-2">
                  <legend className="mb-2 text-xs font-bold text-slate-400">
                    ตัวเลือกและเฉลย ({displayedQuestion.options.length} ตัวเลือก)
                  </legend>
                  {displayedQuestion.options.map((option, optionIndex) => (
                    <label key={optionIndex} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${itemKey}`}
                        checked={
                          displayedQuestion.correct_option !== null &&
                          displayedQuestion.correct_option !== undefined &&
                          Number(displayedQuestion.correct_option) === optionIndex
                        }
                        onChange={() => updateDraft('correct_option', optionIndex)}
                        aria-label={`กำหนดตัวเลือก ${optionIndex + 1} เป็นคำตอบที่ถูกต้อง`}
                        className="accent-emerald-500"
                      />
                      <input
                        value={option}
                        onChange={(event) => updateDraftOption(optionIndex, event.target.value)}
                        aria-label={`ตัวเลือก ${optionIndex + 1}`}
                        className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm text-white outline-none focus:border-indigo-500"
                      />
                    </label>
                  ))}
                </fieldset>

                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-400">คำอธิบายเฉลย</span>
                  <textarea
                    value={displayedQuestion.explanation || ''}
                    onChange={(event) => updateDraft('explanation', event.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none focus:border-indigo-500"
                  />
                </label>

                <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-700 cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={saveEditing}
                    disabled={!draft.question_text.trim() || draft.options.some((option) => !option.trim())}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    💾 บันทึกการแก้ไข
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-white break-words">
                  {item.question_text}
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {item.options.map((option, optionIndex) => {
                    const isCorrect = hasCorrectOption && Number(item.correct_option) === optionIndex
                    const isOverriddenBookOption =
                      showExtractionMeta &&
                      status === 'ai_overridden' &&
                      bookIdx !== null &&
                      bookIdx === optionIndex &&
                      !isCorrect

                    return (
                      <li
                        key={optionIndex}
                        className={`flex items-start gap-2 rounded-xl border p-3 text-sm leading-relaxed ${
                          isCorrect
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                            : isOverriddenBookOption
                              ? 'border-rose-500/30 bg-rose-500/5 text-rose-200/90'
                              : 'border-slate-800 bg-slate-900/70 text-slate-300'
                        }`}
                      >
                        <span className={`mt-0.5 shrink-0 text-xs font-black ${
                          isCorrect
                            ? 'text-emerald-400'
                            : isOverriddenBookOption
                              ? 'text-rose-400'
                              : 'text-slate-500'
                        }`}>
                          {isCorrect ? '✓' : String.fromCharCode(65 + optionIndex)}
                        </span>
                        <span className="whitespace-pre-wrap break-words">{option}</span>
                        {isCorrect && (
                          <span className="ml-auto shrink-0 text-[10px] font-bold text-emerald-400">
                            {status === 'ai_overridden' ? 'เฉลย AI' : 'คำตอบ'}
                          </span>
                        )}
                        {isOverriddenBookOption && (
                          <span className="ml-auto shrink-0 text-[10px] font-bold text-rose-400">
                            เฉลยหนังสือเดิม
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>

                {showExtractionMeta && status === 'ai_overridden' && (
                  <button
                    type="button"
                    onClick={() => onInspectOverride?.(item)}
                    className="w-full text-left rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/15 p-3 text-xs leading-relaxed text-orange-200 transition-colors cursor-pointer flex items-center justify-between gap-3"
                  >
                    <span className="line-clamp-2">
                      <strong className="text-orange-300">⚖️ เหตุผลที่ AI แก้เฉลย: </strong>
                      {item.override_reason || 'คลิกเพื่อดูการเปรียบเทียบเฉลยหนังสือ vs AI'}
                    </span>
                    <span className="shrink-0 font-black text-orange-300">ตรวจ/ตัดสินใจ →</span>
                  </button>
                )}

                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                  <p className="text-xs font-bold text-slate-400">คำอธิบายเฉลย</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300 break-words">
                    {item.explanation || (status === 'pending_answer' ? 'รอ Pass 2–3 จับคู่และสร้างคำอธิบายเฉลย' : 'ไม่มีคำอธิบาย')}
                  </p>
                </div>

                {showExtractionMeta ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-[11px] text-slate-400">
                    <span><strong className="text-slate-300">ไฟล์:</strong> {item.source_file_name || 'ไม่ระบุ'}</span>
                    {item.source_section && (
                      <span><strong className="text-slate-300">ชุด/บท:</strong> {item.source_section}</span>
                    )}
                    {item.source_page && (
                      <span><strong className="text-slate-300">หน้า:</strong> {item.source_page}</span>
                    )}
                    {item.verified_by_model && (
                      <span className="text-indigo-300"><strong className="text-slate-300">ตรวจโดย:</strong> {getGeminiModelLabel(item.verified_by_model)}</span>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200">
                    <span className="font-bold">แหล่งที่มา: </span>
                    {item.source_topic || 'ไม่ระบุ'}
                  </div>
                )}
              </>
            )}
          </article>
        )
      })}
    </div>
  )
}
