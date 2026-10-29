import { useState } from 'react'

function createDraft(question) {
  return {
    ...question,
    options: [...question.options]
  }
}

export default function ExamPreviewTable({ questions, onSaveQuestion, onRemoveQuestion }) {
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

    onSaveQuestion(editingIndex, {
      ...draft,
      question_text: draft.question_text.trim(),
      options: draft.options.map((option) => option.trim()),
      explanation: draft.explanation.trim()
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

  const confirmRemove = (index) => {
    if (window.confirm(`ยืนยันลบข้อที่ ${index + 1} ใช่หรือไม่?`)) {
      onRemoveQuestion(index)
      if (editingIndex === index) cancelEditing()
      else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1)
    }
  }

  return (
    <div className="space-y-4">
      {questions.map((item, index) => {
        const isEditing = editingIndex === index
        const displayedQuestion = isEditing ? draft : item

        return (
          <article
            key={`${index}-${item.source_topic}`}
            className={`space-y-4 rounded-2xl border bg-slate-950 p-4 transition-colors ${
              isEditing ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-800'
            }`}
          >
            <header className="flex items-start justify-between gap-3">
              <span className="text-xs font-black text-indigo-300">ข้อที่ {index + 1}</span>
              {isEditing ? (
                <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-bold text-indigo-300">
                  กำลังแก้ไข
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEditing(index, item)}
                    className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-300 transition-colors hover:bg-indigo-500/20"
                  >
                    ✏️ แก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmRemove(index)}
                    className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/20"
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
                  <legend className="mb-2 text-xs font-bold text-slate-400">ตัวเลือกและเฉลย</legend>
                  {displayedQuestion.options.map((option, optionIndex) => (
                    <label key={optionIndex} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${index}`}
                        checked={Number(displayedQuestion.correct_option) === optionIndex}
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
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-700"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={saveEditing}
                    disabled={!draft.question_text.trim() || draft.options.some((option) => !option.trim())}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    💾 บันทึกการแก้ไข
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-white">
                  {item.question_text}
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {item.options.map((option, optionIndex) => {
                    const isCorrect = Number(item.correct_option) === optionIndex
                    return (
                      <li
                        key={optionIndex}
                        className={`flex items-start gap-2 rounded-xl border p-3 text-sm leading-relaxed ${
                          isCorrect
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                            : 'border-slate-800 bg-slate-900/70 text-slate-300'
                        }`}
                      >
                        <span className={`mt-0.5 shrink-0 text-xs font-black ${isCorrect ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {isCorrect ? '✓' : String.fromCharCode(65 + optionIndex)}
                        </span>
                        <span className="whitespace-pre-wrap">{option}</span>
                        {isCorrect && <span className="ml-auto shrink-0 text-[10px] font-bold text-emerald-400">คำตอบ</span>}
                      </li>
                    )
                  })}
                </ul>
                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                  <p className="text-xs font-bold text-slate-400">คำอธิบายเฉลย</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                    {item.explanation || 'ไม่มีคำอธิบาย'}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200">
                  <span className="font-bold">แหล่งที่มา: </span>
                  {item.source_topic || 'ไม่ระบุ'}
                </div>
              </>
            )}
          </article>
        )
      })}
    </div>
  )
}
