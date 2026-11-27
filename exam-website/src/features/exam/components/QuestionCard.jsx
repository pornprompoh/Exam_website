import { CheckCircleIcon, CloseIcon, InfoCircleIcon } from '../../../shared/components/AdminIcons'

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

export default function QuestionCard({
  currentQ,
  currentIdx,
  questionsLength,
  examPhase,
  userAnswers,
  isLastQuestion,
  isAllAnswered,
  saving,
  onSelectOption,
  onPrevious,
  onNext,
  onSubmit
}) {
  const selectedAnswer = userAnswers[currentQ.id]

  return (
    <section className="lg:col-span-3 order-1 space-y-6 min-w-0">
      <div className="bg-white dark:bg-[#181818] p-5 sm:p-8 lg:p-10 rounded-2xl border border-zinc-200 dark:border-[#272727] min-w-0 transition-colors duration-300">
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-6 pb-4 border-b border-zinc-100 dark:border-[#272727]">
          <span className="text-xs font-semibold font-mono tabular-nums text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/70 dark:border-indigo-500/20 px-3 py-1 rounded-md shrink-0">
            ข้อที่ {(currentIdx + 1).toLocaleString()} / {questionsLength.toLocaleString()}
          </span>
          {examPhase === 'submitted' && (
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-md flex items-center gap-1.5 shrink-0 border ${
                selectedAnswer === currentQ.displayCorrectOption
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25'
                  : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/25'
              }`}
            >
              {selectedAnswer === currentQ.displayCorrectOption ? (
                <>
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  <span>ตอบถูกต้อง</span>
                </>
              ) : (
                <>
                  <CloseIcon className="w-3.5 h-3.5" />
                  <span>ตอบผิดหรือไม่ได้ตอบ</span>
                </>
              )}
            </span>
          )}
        </div>

        <h2 className="text-zinc-900 dark:text-zinc-100 font-semibold text-base sm:text-lg md:text-xl mb-6 leading-[1.75] break-words [word-break:break-word] max-w-[68ch] min-w-0">
          {currentQ.question_text}
        </h2>

        {currentQ.image_url && (
          <div className="mb-6 sm:mb-8 bg-zinc-50 dark:bg-[#1F1F1F] p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-[#272727] flex justify-center overflow-hidden">
            <img
              src={currentQ.image_url}
              alt="รูปประกอบโจทย์"
              className="max-w-full max-h-80 object-contain rounded-lg"
              loading="lazy"
            />
          </div>
        )}

        <div className="space-y-3 min-w-0" role="radiogroup" aria-label="ตัวเลือกคำตอบ">
          {currentQ.displayOptions?.map((optionText, optIdx) => {
            const isSelected = selectedAnswer === optIdx
            const isCorrectOption = currentQ.displayCorrectOption === optIdx

            let cardStyle =
              'border-zinc-200 dark:border-[#272727] hover:border-indigo-400 dark:hover:border-indigo-500/60 bg-white dark:bg-[#181818] hover:bg-zinc-50 dark:hover:bg-[#1F1F1F] text-zinc-800 dark:text-zinc-200'
            let badgeStyle =
              'bg-zinc-100 dark:bg-[#272727] text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-[#313131]'

            if (examPhase === 'submitted') {
              if (isCorrectOption) {
                cardStyle =
                  'border-emerald-500 dark:border-emerald-500/60 bg-emerald-50/70 dark:bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 font-semibold ring-1 ring-emerald-500/30'
                badgeStyle = 'bg-emerald-600 text-white border-emerald-600 font-semibold'
              } else if (isSelected) {
                cardStyle =
                  'border-rose-300 dark:border-rose-500/40 bg-rose-50/70 dark:bg-rose-500/10 text-rose-900 dark:text-rose-200 font-medium'
                badgeStyle = 'bg-rose-600 text-white border-rose-600 font-semibold'
              } else {
                cardStyle =
                  'border-zinc-200/70 dark:border-[#272727] bg-zinc-50/50 dark:bg-[#1F1F1F]/50 text-zinc-400 dark:text-zinc-500 opacity-70'
              }
            } else if (isSelected) {
              cardStyle =
                'border-indigo-600 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-500/10 text-zinc-900 dark:text-zinc-100 font-medium ring-1 ring-indigo-600/25 dark:ring-indigo-500/30'
              badgeStyle = 'bg-indigo-600 text-white border-indigo-600 font-semibold'
            }

            return (
              <button
                key={optIdx}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={examPhase !== 'testing'}
                onClick={() => onSelectOption(currentQ.id, optIdx)}
                className={`w-full text-left min-h-14 p-3.5 sm:p-4 rounded-xl border transition-all duration-300 ease-premium flex items-start gap-3.5 min-w-0 ${
                  examPhase === 'testing'
                    ? 'cursor-pointer active:scale-[0.995]'
                    : 'cursor-default'
                } ${cardStyle}`}
              >
                <span
                  className={`w-7 h-7 rounded-lg text-xs font-mono tabular-nums font-semibold flex items-center justify-center shrink-0 mt-0.5 border transition-colors ${badgeStyle}`}
                >
                  {optIdx + 1}
                </span>
                <span className="text-sm sm:text-base leading-[1.7] break-words [word-break:break-word] flex-1 min-w-0 pt-0.5">
                  {optionText}
                </span>
                {examPhase === 'submitted' && isCorrectOption && (
                  <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-1 shrink-0" />
                )}
                {examPhase === 'submitted' && isSelected && !isCorrectOption && (
                  <CloseIcon className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-1 shrink-0" />
                )}
              </button>
            )
          })}
        </div>

        {examPhase === 'submitted' && (currentQ.explanation || currentQ.explanation_image_url) && (
          <div className="mt-6 sm:mt-8 p-5 sm:p-6 bg-amber-50/80 dark:bg-[#131209] border border-amber-200 dark:border-amber-500/25 rounded-2xl text-zinc-800 dark:text-zinc-200 animate-fadeIn min-w-0">
            <div className="font-semibold text-amber-900 dark:text-amber-300 text-sm flex items-center gap-2 mb-2.5">
              <InfoCircleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>คำอธิบายเฉลยละเอียด</span>
            </div>
            {currentQ.explanation && (
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-[1.75] break-words [word-break:break-word] max-w-[68ch] mb-3 min-w-0">
                {currentQ.explanation}
              </p>
            )}
            {currentQ.explanation_image_url && (
              <div className="mt-3 bg-white dark:bg-[#181818] p-2.5 sm:p-3 rounded-xl border border-amber-200/80 dark:border-amber-500/20 flex justify-center overflow-hidden">
                <img
                  src={currentQ.explanation_image_url}
                  alt="รูปประกอบเฉลย"
                  className="max-w-full max-h-72 object-contain rounded-lg"
                  loading="lazy"
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-8 pt-5 border-t border-zinc-100 dark:border-[#272727] flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onPrevious}
            disabled={currentIdx === 0}
            className="flex-1 sm:flex-none py-2.5 px-4 sm:px-5 rounded-xl border border-zinc-200 dark:border-[#313131] bg-white dark:bg-[#1F1F1F] hover:bg-zinc-50 dark:hover:bg-[#272727] active:scale-[0.98] disabled:opacity-35 disabled:hover:bg-white dark:disabled:hover:bg-[#1F1F1F] text-zinc-700 dark:text-zinc-200 font-semibold text-sm transition-all duration-300 ease-premium cursor-pointer disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 shrink-0"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>ข้อก่อนหน้า</span>
          </button>

          {!isLastQuestion ? (
            <button
              type="button"
              onClick={onNext}
              className="flex-1 sm:flex-none py-2.5 px-5 sm:px-6 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white active:scale-[0.98] text-white dark:text-zinc-900 font-semibold rounded-xl text-sm transition-all duration-300 ease-premium cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>ข้อถัดไป</span>
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          ) : (
            examPhase === 'testing' && (
              <button
                type="button"
                onClick={onSubmit}
                disabled={saving}
                className="w-full sm:w-auto py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-premium cursor-pointer inline-flex items-center justify-center gap-2 shrink-0 order-first sm:order-none"
              >
                <CheckCircleIcon className="w-4 h-4" />
                <span>{isAllAnswered ? 'ส่งข้อสอบและตรวจคะแนน' : 'ส่งข้อสอบเลย (ดูเฉลย)'}</span>
              </button>
            )
          )}
        </div>
      </div>
    </section>
  )
}
