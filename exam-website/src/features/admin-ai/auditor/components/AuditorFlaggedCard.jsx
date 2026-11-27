import { getGeminiModelLabel } from '../../../../shared/lib/geminiModels'
import { EditIcon, FlagIcon } from '../../../../shared/components/AdminIcons'

function getChoiceLetter(idx) {
  return String.fromCharCode(65 + idx)
}

export default function AuditorFlaggedCard({
  item,
  index,
  showCategoryBadge,
  categoryName,
  isSelected,
  isEditingManual,
  isItemBusy,
  manualDraft,
  onToggleSelect,
  onManualDraftChange,
  onStartManualEdit,
  onCancelManualEdit,
  onSaveManualEdit,
  onKeepOriginal,
  onAcceptSuggestion
}) {
  const options = Array.isArray(item.options) ? item.options : []
  const currentIdx = Number.isInteger(Number(item.correct_option)) ? Number(item.correct_option) : -1
  const suggestedIdx =
    item.audit_suggested_answer !== null &&
    item.audit_suggested_answer !== undefined &&
    Number.isInteger(Number(item.audit_suggested_answer))
      ? Number(item.audit_suggested_answer)
      : -1

  return (
    <article
      className={`rounded-2xl border bg-white dark:bg-slate-950 p-4 sm:p-5 space-y-3.5 transition-colors ${
        isSelected ? 'border-indigo-500 ring-1 ring-indigo-500/25' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(item.id)}
            className="h-4 w-4 accent-indigo-600 rounded cursor-pointer shrink-0"
          />
          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-300 tabular-nums">
            <FlagIcon className="w-3.5 h-3.5" />
            <span>Flagged #{index + 1}</span>
          </span>
          {showCategoryBadge && categoryName && (
            <span className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              {categoryName}
            </span>
          )}
          {item.audit_model && (
            <span className="rounded-md border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
              {item.audit_model === 'local-precheck'
                ? 'ด่าน 0 Local Pre-Check'
                : getGeminiModelLabel(item.audit_model)}
            </span>
          )}
        </div>
        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">ID: {item.id.slice(0, 8)}</span>
      </div>

      <div className="space-y-2">
        <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-900 dark:text-white break-words">
          {item.question_text}
        </p>
        {item.image_url && (
          <div className="inline-block rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-2">
            <img
              src={item.image_url}
              alt="รูปประกอบโจทย์"
              className="max-h-48 w-auto rounded-lg object-contain"
              loading="lazy"
            />
          </div>
        )}
      </div>

      {!isEditingManual ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {options.map((opt, optIdx) => {
            const isCurrent = optIdx === currentIdx
            const isSuggested = optIdx === suggestedIdx
            return (
              <li
                key={optIdx}
                className={`flex items-start gap-2 rounded-xl border p-2.5 text-xs sm:text-sm leading-relaxed ${
                  isSuggested
                    ? 'border-emerald-300 dark:border-emerald-500/50 bg-emerald-50/80 dark:bg-emerald-500/15 text-emerald-950 dark:text-emerald-100 font-medium'
                    : isCurrent
                      ? 'border-rose-300 dark:border-rose-500/50 bg-rose-50/80 dark:bg-rose-500/15 text-rose-950 dark:text-rose-100'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span
                  className={`mt-0.5 shrink-0 text-xs font-bold ${
                    isSuggested
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : isCurrent
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {getChoiceLetter(optIdx)}
                </span>
                <span className="whitespace-pre-wrap break-words flex-1">{opt}</span>
                {isCurrent && (
                  <span className="ml-auto shrink-0 rounded-md bg-rose-100 dark:bg-rose-500/25 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800 dark:text-rose-200">
                    เฉลยปัจจุบัน
                  </span>
                )}
                {isSuggested && (
                  <span className="ml-auto shrink-0 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    AI แนะนำ
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/40 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 space-y-3">
          <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300">แก้ไขเฉลยและคำอธิบายด้วยตนเอง</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((opt, optIdx) => (
              <label
                key={optIdx}
                className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-xs cursor-pointer transition-colors ${
                  Number(manualDraft.correctOption) === optIdx
                    ? 'border-emerald-400 dark:border-emerald-500/60 bg-emerald-50 dark:bg-emerald-500/15 text-slate-900 dark:text-white font-semibold'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name={`manual-correct-${item.id}`}
                  checked={Number(manualDraft.correctOption) === optIdx}
                  onChange={() => onManualDraftChange((d) => ({ ...d, correctOption: optIdx }))}
                  className="mt-0.5 accent-emerald-600 cursor-pointer"
                />
                <span className="break-words">
                  <strong>{getChoiceLetter(optIdx)}.</strong> {opt}
                </span>
              </label>
            ))}
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">คำอธิบายเฉลย</span>
            <textarea
              rows={3}
              value={manualDraft.explanation}
              onChange={(e) => onManualDraftChange((d) => ({ ...d, explanation: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={isItemBusy}
              onClick={onCancelManualEdit}
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={isItemBusy}
              onClick={() => onSaveManualEdit(item)}
              className="h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 text-xs font-semibold text-white cursor-pointer"
            >
              {isItemBusy ? 'กำลังบันทึก...' : 'บันทึกและตั้งสถานะ verified'}
            </button>
          </div>
        </div>
      )}

      {/* Audit Reason */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 p-3 space-y-1">
        <p className="text-[11px] font-bold text-amber-900 dark:text-amber-300">เหตุผลที่ตรวจพบความผิดปกติ</p>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-800 dark:text-amber-100 break-words">
          {item.audit_reason || 'ไม่มีรายละเอียดเหตุผล'}
        </p>
      </div>

      {/* Explanation Comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">คำอธิบายเดิมในคลัง</p>
          <p className="whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300 break-words">
            {item.explanation || '(ไม่มีคำอธิบายเดิม)'}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/50 dark:bg-emerald-500/5 p-3 space-y-1">
          <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
            คำอธิบายใหม่ (จะแทนที่เมื่ออนุมัติ AI)
          </p>
          <p className="whitespace-pre-wrap leading-relaxed text-emerald-950 dark:text-emerald-100/90 break-words">
            {item.audit_suggested_explanation || '(ไม่มีคำอธิบายแนะนำ — กดแก้ไขเองเพื่อระบุ)'}
          </p>
        </div>
      </div>

      {!isEditingManual && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-3">
          <button
            type="button"
            disabled={isItemBusy}
            onClick={() => onStartManualEdit(item)}
            className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 disabled:opacity-40 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <EditIcon className="w-3.5 h-3.5" />
            <span>แก้ไขเอง</span>
          </button>
          <button
            type="button"
            disabled={isItemBusy}
            onClick={() => onKeepOriginal(item)}
            className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            คงเฉลยเดิม
          </button>
          <button
            type="button"
            disabled={isItemBusy || suggestedIdx < 0}
            onClick={() => onAcceptSuggestion(item)}
            className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 px-4 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            {isItemBusy ? 'กำลังบันทึก...' : 'ใช้เฉลยที่ AI แนะนำ'}
          </button>
        </div>
      )}
    </article>
  )
}
