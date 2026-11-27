import { useState } from 'react'
import { getGeminiModelLabel } from '../../../../shared/lib/geminiModels'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  EditIcon,
  SparklesIcon,
  TrashIcon
} from '../../../../shared/components/AdminIcons'

function createDraft(question) {
  return { ...question, options: [...question.options] }
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
    if (!draft.question_text.trim() || draft.options.some((option) => !option.trim())) return
    const hasChosenOption =
      draft.correct_option !== null &&
      draft.correct_option !== undefined &&
      draft.correct_option !== '' &&
      Number.isInteger(Number(draft.correct_option))

    const currentStatus = resolveStatus(draft)
    const nextStatus = currentStatus === 'pending_answer' && hasChosenOption ? 'book_verified' : draft.answer_status

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

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }))

  const updateDraftOption = (optionIndex, value) => {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option, index) => (index === optionIndex ? value : option))
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
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            <span>เฉลยหนังสือ</span>
          </span>
        )
      case 'ai_overridden':
        return (
          <button
            type="button"
            onClick={() => onInspectOverride?.(item)}
            className="inline-flex items-center gap-1 rounded-md border border-amber-300 dark:border-amber-500/45 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300 transition-colors duration-300 cursor-pointer"
            title="คลิกเพื่อเปรียบเทียบเฉลยหนังสือกับเฉลย AI"
          >
            <AlertTriangleIcon className="w-3.5 h-3.5" />
            <span>AI แก้เฉลย (ดูเหตุผล)</span>
          </button>
        )
      case 'ai_solved':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 dark:border-indigo-500/35 bg-indigo-50 dark:bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            <SparklesIcon className="w-3.5 h-3.5" />
            <span>AI เฉลย</span>
          </span>
        )
      default:
        return (
          <span className="rounded-md border border-zinc-200 dark:border-[#313131] bg-zinc-100 dark:bg-[#272727] px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            รอจับคู่เฉลย
          </span>
        )
    }
  }

  return (
    <div className="space-y-3">
      {questions.map((item, index) => {
        const isEditing = editingIndex === index
        const displayedQuestion = isEditing ? draft : item
        const itemKey = item.id || `${index}-${item.source_topic || item.source_question_number || ''}`
        const isSelected = selectable && item.id && selectedIds.includes(item.id)
        const status = resolveStatus(item)
        const hasCorrectOption =
          item.correct_option !== null && item.correct_option !== undefined && Number.isInteger(Number(item.correct_option))
        const bookIdx =
          item.book_answer !== null && item.book_answer !== undefined && Number.isInteger(Number(item.book_answer))
            ? Number(item.book_answer)
            : null

        return (
          <article
            key={itemKey}
            className={`space-y-3.5 rounded-2xl border p-4 transition-colors duration-300 ${
              isEditing
                ? 'border-indigo-500 bg-white dark:bg-[#181818] ring-2 ring-indigo-500/20'
                : status === 'ai_overridden' && showExtractionMeta
                  ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50/35 dark:bg-[#131209]'
                  : isSelected
                    ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-500/10'
                    : 'border-zinc-200 dark:border-[#272727] bg-white dark:bg-[#181818]'
            }`}
          >
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                {selectable && item.id && (
                  <input
                    type="checkbox"
                    checked={Boolean(isSelected)}
                    onChange={() => onToggleSelect?.(item.id)}
                    aria-label={`เลือกข้อที่ ${index + 1}`}
                    className="h-4 w-4 accent-indigo-600 rounded cursor-pointer shrink-0 mr-1"
                  />
                )}
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
                  ข้อที่ {index + 1}
                </span>
                {showExtractionMeta && item.source_question_number && (
                  <span className="rounded-md border border-zinc-200 dark:border-[#272727] bg-zinc-100 dark:bg-[#1F1F1F] px-2 py-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 tabular-nums">
                    ต้นฉบับ #{item.source_question_number}
                  </span>
                )}
                {showExtractionMeta && item.source_section && (
                  <span
                    className="rounded-md border border-zinc-200 dark:border-[#272727] bg-zinc-100 dark:bg-[#1F1F1F] px-2 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 max-w-48 truncate"
                    title={item.source_section}
                  >
                    {item.source_section}
                  </span>
                )}
                {showExtractionMeta && item.source_page && (
                  <span className="rounded-md border border-zinc-200 dark:border-[#272727] bg-zinc-100 dark:bg-[#1F1F1F] px-2 py-0.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                    หน้า {item.source_page}
                  </span>
                )}
                {showExtractionMeta && renderAnswerStatusBadge(item)}
              </div>

              {isEditing ? (
                <span className="rounded-md border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  กำลังแก้ไข
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => startEditing(index, item)}
                    className="h-8 rounded-lg border border-zinc-200 dark:border-[#272727] bg-zinc-50 hover:bg-zinc-100 dark:bg-[#1F1F1F] dark:hover:bg-[#272727] px-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer inline-flex items-center gap-1"
                  >
                    <EditIcon className="w-3.5 h-3.5" />
                    <span>แก้ไข</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmRemove(index, item)}
                    aria-label={`ลบข้อที่ ${index + 1}`}
                    className="h-8 w-8 rounded-lg text-zinc-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors duration-300 cursor-pointer inline-flex items-center justify-center"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </header>

            {isEditing ? (
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">โจทย์คำถาม</span>
                  <textarea
                    value={displayedQuestion.question_text}
                    onChange={(e) => updateDraft('question_text', e.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full rounded-xl border border-zinc-200 dark:border-[#313131] bg-zinc-50 dark:bg-[#1F1F1F] p-3 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>

                <fieldset className="grid gap-2 sm:grid-cols-2">
                  <legend className="mb-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
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
                        className="accent-emerald-600 cursor-pointer"
                      />
                      <input
                        value={option}
                        onChange={(e) => updateDraftOption(optionIndex, e.target.value)}
                        aria-label={`ตัวเลือก ${optionIndex + 1}`}
                        className="min-w-0 flex-1 h-9 rounded-lg border border-zinc-200 dark:border-[#313131] bg-zinc-50 dark:bg-[#1F1F1F] px-2.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </label>
                  ))}
                </fieldset>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">คำอธิบายเฉลย</span>
                  <textarea
                    value={displayedQuestion.explanation || ''}
                    onChange={(e) => updateDraft('explanation', e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-zinc-200 dark:border-[#313131] bg-zinc-50 dark:bg-[#1F1F1F] p-3 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </label>

                <div className="flex justify-end gap-2 border-t border-zinc-200 dark:border-[#272727] pt-3">
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="h-9 rounded-xl border border-zinc-200 dark:border-[#313131] bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1F1F1F] dark:hover:bg-[#272727] px-3.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-colors duration-300 cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={saveEditing}
                    disabled={!draft.question_text.trim() || draft.options.some((o) => !o.trim())}
                    className="h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 text-xs font-semibold text-white transition-all duration-300 ease-premium active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    บันทึกการแก้ไข
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-zinc-900 dark:text-zinc-100 break-words">
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
                        className={`flex items-start gap-2 rounded-xl border p-2.5 text-xs sm:text-sm leading-relaxed ${
                          isCorrect
                            ? 'border-emerald-200 dark:border-emerald-500/35 bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 font-medium'
                            : isOverriddenBookOption
                              ? 'border-rose-200 dark:border-rose-500/35 bg-rose-50/70 dark:bg-rose-500/10 text-rose-900 dark:text-rose-200'
                              : 'border-zinc-200 dark:border-[#272727] bg-zinc-50 dark:bg-[#1F1F1F] text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        <span
                          className={`mt-0.5 shrink-0 text-xs font-bold tabular-nums ${
                            isCorrect
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : isOverriddenBookOption
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-zinc-400 dark:text-zinc-500'
                          }`}
                        >
                          {isCorrect ? '✓' : String.fromCharCode(65 + optionIndex)}
                        </span>
                        <span className="whitespace-pre-wrap break-words flex-1">{option}</span>
                        {isCorrect && (
                          <span className="ml-auto shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            {status === 'ai_overridden' ? 'เฉลย AI' : 'คำตอบ'}
                          </span>
                        )}
                        {isOverriddenBookOption && (
                          <span className="ml-auto shrink-0 text-xs font-semibold text-rose-600 dark:text-rose-400">
                            เฉลยเดิม
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
                    className="w-full text-left rounded-xl border border-amber-300 dark:border-amber-500/35 bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-500/10 dark:hover:bg-amber-500/15 p-3 text-xs leading-relaxed text-amber-950 dark:text-amber-200 transition-colors duration-300 cursor-pointer flex items-center justify-between gap-3"
                  >
                    <span className="line-clamp-2">
                      <strong className="font-semibold text-amber-900 dark:text-amber-300">เหตุผลที่ AI แก้เฉลย: </strong>
                      {item.override_reason || 'คลิกเพื่อเปรียบเทียบเฉลยหนังสือกับเฉลย AI'}
                    </span>
                    <span className="shrink-0 font-semibold text-amber-800 dark:text-amber-300">เปรียบเทียบ →</span>
                  </button>
                )}

                <div className="space-y-1 rounded-xl border border-zinc-200 dark:border-[#272727] bg-zinc-50 dark:bg-[#1F1F1F] p-3">
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">คำอธิบายเฉลย</p>
                  <p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 break-words">
                    {item.explanation ||
                      (status === 'pending_answer' ? 'รอ Pass 2 และ Pass 3 จับคู่และสร้างคำอธิบายเฉลย' : 'ไม่มีคำอธิบาย')}
                  </p>
                </div>

                {showExtractionMeta ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-zinc-200 dark:border-[#272727] bg-zinc-50/70 dark:bg-[#1F1F1F]/70 px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      <strong className="text-zinc-700 dark:text-zinc-300">ไฟล์:</strong> {item.source_file_name || 'ไม่ระบุ'}
                    </span>
                    {item.source_section && (
                      <span>
                        <strong className="text-zinc-700 dark:text-zinc-300">ชุด/บท:</strong> {item.source_section}
                      </span>
                    )}
                    {item.source_page && (
                      <span className="tabular-nums">
                        <strong className="text-zinc-700 dark:text-zinc-300">หน้า:</strong> {item.source_page}
                      </span>
                    )}
                    {item.verified_by_model && (
                      <span className="text-indigo-700 dark:text-indigo-300">
                        <strong className="text-zinc-700 dark:text-zinc-300">ตรวจโดย:</strong>{' '}
                        {getGeminiModelLabel(item.verified_by_model)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-zinc-200 dark:border-[#272727] bg-zinc-50 dark:bg-[#1F1F1F] px-3 py-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">แหล่งที่มา: </span>
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
