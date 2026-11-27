import { CheckCircleIcon, CloseIcon, InfoCircleIcon } from '../../../shared/components/AdminIcons'

function LockIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

export default function ExamReviewCard({ question, questionNumber, totalQuestions, selectedIdx, status }) {
  const isUnanswered = status === 'unanswered'
  const isCorrect = status === 'correct'

  return (
    <article className="bg-white dark:bg-[#181818] rounded-2xl border border-zinc-200 dark:border-[#272727] p-5 sm:p-7 space-y-4 min-w-0 transition-colors duration-300">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-[#272727]">
        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/70 dark:border-indigo-500/20 px-2.5 py-1 rounded-md font-mono tabular-nums">
          ข้อที่ {questionNumber.toLocaleString()} / {totalQuestions.toLocaleString()}
        </span>

        {isUnanswered ? (
          <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-[#1F1F1F] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-[#313131] inline-flex items-center gap-1.5">
            <LockIcon className="w-3.5 h-3.5" />
            <span>ยังไม่ได้ทำ (ซ่อนเฉลย)</span>
          </span>
        ) : isCorrect ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25 inline-flex items-center gap-1.5">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            <span>ตอบถูกต้อง</span>
          </span>
        ) : (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/25 inline-flex items-center gap-1.5">
            <CloseIcon className="w-3.5 h-3.5" />
            <span>ตอบผิด</span>
          </span>
        )}
      </div>

      <h3 className="text-zinc-900 dark:text-zinc-100 font-semibold text-base sm:text-lg leading-[1.75] max-w-[68ch] break-words [word-break:break-word]">
        {question.question_text}
      </h3>

      {question.image_url && (
        <div className="bg-zinc-50 dark:bg-[#1F1F1F] p-3 rounded-xl border border-zinc-200 dark:border-[#272727] flex justify-center overflow-hidden">
          <img
            src={question.image_url}
            alt="รูปประกอบโจทย์"
            className="max-w-full max-h-72 object-contain rounded-lg"
            loading="lazy"
          />
        </div>
      )}

      {isUnanswered ? (
        <div className="space-y-3">
          <div className="space-y-2">
            {question.displayOptions?.map((optText, optIdx) => (
              <div
                key={optIdx}
                className="p-3 rounded-xl border border-zinc-200 dark:border-[#272727] bg-zinc-50/70 dark:bg-[#1F1F1F]/70 text-zinc-600 dark:text-zinc-400 flex items-start gap-3"
              >
                <span className="w-6 h-6 rounded-md bg-zinc-200/80 dark:bg-[#272727] text-zinc-600 dark:text-zinc-400 text-xs font-mono tabular-nums font-semibold flex items-center justify-center shrink-0 mt-0.5">
                  {optIdx + 1}
                </span>
                <span className="text-sm leading-[1.7] break-words flex-1">{optText}</span>
              </div>
            ))}
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-[#1F1F1F] border border-zinc-200 dark:border-[#272727] text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <LockIcon className="w-4 h-4 shrink-0" />
            <span className="leading-relaxed">
              ยังไม่ได้ทำข้อนี้ ระบบซ่อนเฉลยและคำอธิบายไว้เพื่อไม่ให้สปอยล์สำหรับการฝึกทำรอบถัดไป
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {question.displayOptions?.map((optText, optIdx) => {
              const isCorrectOpt = optIdx === question.displayCorrectOption
              const isSelectedOpt = optIdx === selectedIdx

              let cardStyle =
                'border-zinc-200/80 dark:border-[#272727] bg-zinc-50/50 dark:bg-[#1F1F1F]/50 text-zinc-500 dark:text-zinc-400'
              let badgeStyle =
                'bg-zinc-100 dark:bg-[#272727] text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-[#313131]'

              if (isCorrectOpt) {
                cardStyle =
                  'border-emerald-500 dark:border-emerald-500/50 bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 font-semibold ring-1 ring-emerald-500/25'
                badgeStyle = 'bg-emerald-600 text-white font-semibold border border-emerald-600'
              } else if (isSelectedOpt) {
                cardStyle =
                  'border-rose-300 dark:border-rose-500/40 bg-rose-50/80 dark:bg-rose-500/10 text-rose-900 dark:text-rose-200 font-medium'
                badgeStyle = 'bg-rose-600 text-white font-semibold border border-rose-600'
              }

              return (
                <div
                  key={optIdx}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 min-w-0 ${cardStyle}`}
                >
                  <span
                    className={`w-6 h-6 rounded-md text-xs font-mono tabular-nums flex items-center justify-center shrink-0 mt-0.5 ${badgeStyle}`}
                  >
                    {optIdx + 1}
                  </span>
                  <span className="text-sm leading-[1.7] break-words flex-1 min-w-0">{optText}</span>
                  {isCorrectOpt && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5">
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      <span>เฉลย</span>
                    </span>
                  )}
                  {isSelectedOpt && !isCorrectOpt && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                      <CloseIcon className="w-3.5 h-3.5" />
                      <span>คำตอบคุณ</span>
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {(question.explanation || question.explanation_image_url) && (
            <div className="p-4 sm:p-5 bg-amber-50/80 dark:bg-[#131209] border border-amber-200 dark:border-amber-500/25 rounded-xl text-zinc-800 dark:text-zinc-200 space-y-2">
              <div className="font-semibold text-amber-900 dark:text-amber-300 text-sm flex items-center gap-2">
                <InfoCircleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>คำอธิบายเฉลย</span>
              </div>
              {question.explanation && (
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-[1.75] whitespace-pre-wrap break-words max-w-[68ch]">
                  {question.explanation}
                </p>
              )}
              {question.explanation_image_url && (
                <div className="mt-2 bg-white dark:bg-[#181818] p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-500/20 flex justify-center overflow-hidden">
                  <img
                    src={question.explanation_image_url}
                    alt="รูปประกอบเฉลย"
                    className="max-w-full max-h-64 object-contain rounded-lg"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </article>
  )
}
