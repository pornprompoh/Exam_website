import { AlertTriangleIcon, CheckCircleIcon, CloseIcon, InfoCircleIcon } from '../../../shared/components/AdminIcons'

export default function MistakeCard({ item, index, onRequestResolve }) {
  const q = item.questions
  const userAnswerIdx = item.user_answer !== null ? Number(item.user_answer) : null
  const correctIdx = Number(q.correct_option)

  return (
    <article className="bg-white dark:bg-[#181818] rounded-2xl border border-zinc-200 dark:border-[#272727] overflow-hidden transition-colors duration-300 min-w-0">
      <div className="bg-zinc-50 dark:bg-[#1F1F1F] px-5 py-3 border-b border-zinc-200 dark:border-[#272727] flex flex-wrap items-center justify-between gap-2 text-xs min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shrink-0" />
          <span className="text-zinc-900 dark:text-zinc-100 font-semibold truncate">
            {q.categories?.name || 'หมวดวิชาทั่วไป'}
          </span>
          <span className="text-zinc-300 dark:text-zinc-600 shrink-0">/</span>
          <span className="font-mono tabular-nums font-medium text-zinc-500 dark:text-zinc-400 shrink-0">
            #{(index + 1).toLocaleString()}
          </span>
        </div>
        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono tabular-nums shrink-0">
          {new Date(item.created_at).toLocaleDateString('th-TH', {
            year: '2-digit',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}{' '}
          น.
        </span>
      </div>

      <div className="p-5 sm:p-7 space-y-5 min-w-0">
        <h3 className="text-zinc-900 dark:text-zinc-100 font-semibold text-base sm:text-lg leading-[1.75] max-w-[68ch] break-words [word-break:break-word] min-w-0">
          {q.question_text}
        </h3>

        {q.image_url && (
          <div className="bg-zinc-50 dark:bg-[#1F1F1F] p-3 rounded-xl border border-zinc-200 dark:border-[#272727] flex justify-center overflow-hidden">
            <img
              src={q.image_url}
              alt="รูปโจทย์"
              className="max-w-full max-h-72 object-contain rounded-lg"
              loading="lazy"
            />
          </div>
        )}

        <div className="space-y-2.5 min-w-0">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            ตัวเลือกทั้งหมดและจุดที่ควรทบทวน
          </div>

          {q.options?.map((optText, optIdx) => {
            const isUserChoice = userAnswerIdx === optIdx
            const isCorrectChoice = correctIdx === optIdx

            let cardStyle =
              'bg-zinc-50/70 dark:bg-[#1F1F1F]/70 border-zinc-200 dark:border-[#272727] text-zinc-600 dark:text-zinc-400'
            let badgeStyle =
              'bg-zinc-200/80 dark:bg-[#272727] text-zinc-700 dark:text-zinc-300 border border-zinc-300/70 dark:border-[#313131]'
            let statusBadge = null

            if (isCorrectChoice) {
              cardStyle =
                'bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-500 dark:border-emerald-500/50 text-emerald-950 dark:text-emerald-200 font-semibold ring-1 ring-emerald-500/25'
              badgeStyle = 'bg-emerald-600 text-white font-semibold border border-emerald-600'
              statusBadge = (
                <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-xs font-semibold px-2 py-0.5 rounded-md ml-auto shrink-0">
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  <span>คำตอบที่ถูกต้อง</span>
                </span>
              )
            } else if (isUserChoice) {
              cardStyle =
                'bg-rose-50/80 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-200 font-medium'
              badgeStyle = 'bg-rose-600 text-white font-semibold border border-rose-600'
              statusBadge = (
                <span className="inline-flex items-center gap-1 bg-rose-600 text-white text-xs font-semibold px-2 py-0.5 rounded-md ml-auto shrink-0">
                  <CloseIcon className="w-3.5 h-3.5" />
                  <span>คำตอบที่เคยเลือก</span>
                </span>
              )
            }

            return (
              <div
                key={optIdx}
                className={`p-3.5 rounded-xl border transition-all flex flex-wrap sm:flex-nowrap items-start gap-3 min-w-0 ${cardStyle}`}
              >
                <span
                  className={`w-6 h-6 rounded-md text-xs font-mono tabular-nums flex items-center justify-center shrink-0 mt-0.5 ${badgeStyle}`}
                >
                  {optIdx + 1}
                </span>
                <span className="text-sm leading-[1.7] break-words [word-break:break-word] flex-1 min-w-0">
                  {optText}
                </span>
                {statusBadge}
              </div>
            )
          })}

          {userAnswerIdx === null && (
            <div className="p-3 bg-amber-50/80 dark:bg-[#131209] border border-amber-200 dark:border-amber-500/25 rounded-xl text-xs font-medium text-amber-900 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>ข้อนี้คุณไม่ได้เลือกคำตอบ (อาจหมดเวลาหรือเว้นว่างไว้)</span>
            </div>
          )}
        </div>

        {(q.explanation || q.explanation_image_url) && (
          <div className="p-4 sm:p-5 bg-amber-50/80 dark:bg-[#131209] border border-amber-200 dark:border-amber-500/25 rounded-xl text-zinc-800 dark:text-zinc-200 min-w-0 space-y-2">
            <div className="font-semibold text-amber-900 dark:text-amber-300 text-sm flex items-center gap-2">
              <InfoCircleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>คำอธิบายเฉลยเพิ่มเติม</span>
            </div>
            {q.explanation && (
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-[1.75] break-words [word-break:break-word] max-w-[68ch] min-w-0">
                {q.explanation}
              </p>
            )}
            {q.explanation_image_url && (
              <div className="mt-2 bg-white dark:bg-[#181818] p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-500/20 flex justify-center overflow-hidden">
                <img
                  src={q.explanation_image_url}
                  alt="รูปเฉลย"
                  className="max-w-full max-h-64 object-contain rounded-lg"
                  loading="lazy"
                />
              </div>
            )}
          </div>
        )}

        <div className="pt-4 border-t border-zinc-100 dark:border-[#272727] flex justify-end">
          <button
            type="button"
            onClick={() => onRequestResolve(item)}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-premium cursor-pointer inline-flex items-center justify-center gap-2 shrink-0"
          >
            <CheckCircleIcon className="w-4 h-4" />
            <span>ทบทวนเข้าใจแล้ว (นำออกจากคลัง)</span>
          </button>
        </div>
      </div>
    </article>
  )
}
