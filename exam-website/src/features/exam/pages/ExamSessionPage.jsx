import { useParams, useSearchParams } from 'react-router-dom'
import LoadingScreen from '../../../shared/components/LoadingScreen'
import useExamSession from '../hooks/useExamSession'
import { formatExamTime } from '../utils/examShuffleUtils'
import ExamSetupView from '../components/ExamSetupView'
import ExamGuardModals from '../components/ExamGuardModals'
import ExamHeader from '../components/ExamHeader'
import QuestionCard from '../components/QuestionCard'
import ExamNavigator from '../components/ExamNavigator'
import ExamReviewList from '../components/ExamReviewList'

export default function ExamSessionPage() {
  const { categoryId } = useParams()
  const [searchParams] = useSearchParams()
  const categoryName = searchParams.get('title') || 'ทดสอบข้อสอบ'

  const exam = useExamSession(categoryId)

  if (exam.loading || exam.startingExam) {
    return (
      <LoadingScreen
        text={exam.startingExam ? exam.startProgressText || 'กำลังสุ่มและโหลดข้อสอบ...' : exam.loadingText}
      />
    )
  }

  if (exam.examPhase === 'setup') {
    return (
      <ExamSetupView
        categoryName={categoryName}
        totalBankCount={exam.totalBankCount}
        selectedCount={exam.selectedCount}
        customCountInput={exam.customCountInput}
        selectedTimeLimit={exam.selectedTimeLimit}
        customTimeInput={exam.customTimeInput}
        pendingAutosave={exam.pendingAutosave}
        onSelectCountBtn={exam.handleSelectCountBtn}
        onCustomCountChange={exam.handleCustomCountChange}
        onSelectTimeLimit={(val) => {
          if (val === -1) {
            exam.setSelectedTimeLimit(-1)
            exam.setCustomTimeInput((prev) => prev || '15')
          } else {
            exam.setSelectedTimeLimit(val)
            exam.setCustomTimeInput('')
          }
        }}
        onCustomTimeChange={exam.handleCustomTimeChange}
        onResumeAutosave={exam.handleResumeAutosave}
        onDiscardAutosave={exam.handleDiscardAutosave}
        onStartExam={exam.handleStartExamSession}
      />
    )
  }

  const currentQ = exam.questions[exam.currentIdx]
  const isLastQuestion = exam.currentIdx === exam.questions.length - 1
  const answeredCount = Object.keys(exam.userAnswers).length
  const unansweredCount = Math.max(0, exam.questions.length - answeredCount)
  const isAllAnswered = answeredCount === exam.questions.length
  const timePercent = exam.totalTimeSeconds > 0 ? (exam.timeLeft / exam.totalTimeSeconds) * 100 : 100
  const isTimeCritical = exam.totalTimeSeconds > 0 && timePercent <= 20

  return (
    <div className="min-h-screen bg-slate-50/70 pb-24 font-sans text-slate-800 relative overflow-x-hidden">
      <ExamGuardModals
        answeredCount={answeredCount}
        unansweredCount={unansweredCount}
        questionsLength={exam.questions.length}
        showExitZeroModal={exam.showExitZeroModal}
        onCloseExitZero={() => exam.setShowExitZeroModal(false)}
        onConfirmExitZero={exam.handleConfirmExitZero}
        showExitProgressModal={exam.showExitProgressModal}
        onCloseExitProgress={() => exam.setShowExitProgressModal(false)}
        onConfirmExitProgress={exam.handleConfirmExitProgress}
        showZeroSubmitModal={exam.showZeroSubmitModal}
        onCloseZeroSubmit={() => exam.setShowZeroSubmitModal(false)}
        showPartialSubmitModal={exam.showPartialSubmitModal}
        onClosePartialSubmit={() => exam.setShowPartialSubmitModal(false)}
        onConfirmPartialSubmit={() => exam.executeSubmitExam(false)}
        showTimeOutModal={exam.showTimeOutModal}
        onCloseTimeOut={() => exam.setShowTimeOutModal(false)}
      />

      <ExamHeader
        categoryName={categoryName}
        questionsLength={exam.questions.length}
        examPhase={exam.examPhase}
        score={exam.score}
        answeredCount={answeredCount}
        isAllAnswered={isAllAnswered}
        totalTimeSeconds={exam.totalTimeSeconds}
        timeLeft={exam.timeLeft}
        timePercent={timePercent}
        isTimeCritical={isTimeCritical}
        formatTime={formatExamTime}
        onBackNavigation={exam.handleBackNavigation}
      />

      {exam.examPhase === 'submitted' ? (
        <ExamReviewList
          questions={exam.questions}
          userAnswers={exam.userAnswers}
          score={exam.score}
          answeredCount={answeredCount}
          categoryName={categoryName}
          onRestartExam={exam.handleRestartExam}
          onGoHome={exam.goHome}
        />
      ) : (
        <div className="max-w-6xl mx-auto px-3 sm:px-6 mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8 min-w-0">
          {currentQ && (
            <QuestionCard
              currentQ={currentQ}
              currentIdx={exam.currentIdx}
              questionsLength={exam.questions.length}
              examPhase={exam.examPhase}
              userAnswers={exam.userAnswers}
              isLastQuestion={isLastQuestion}
              isAllAnswered={isAllAnswered}
              saving={exam.saving}
              onSelectOption={exam.handleSelectOption}
              onPrevious={() => exam.setCurrentIdx((prev) => Math.max(0, prev - 1))}
              onNext={() => exam.setCurrentIdx((prev) => Math.min(exam.questions.length - 1, prev + 1))}
              onSubmit={exam.handleRequestSubmit}
            />
          )}

          <ExamNavigator
            questions={exam.questions}
            userAnswers={exam.userAnswers}
            currentIdx={exam.currentIdx}
            examPhase={exam.examPhase}
            answeredCount={answeredCount}
            saving={exam.saving}
            onSelectQuestion={exam.setCurrentIdx}
            onSubmitExam={exam.handleRequestSubmit}
          />
        </div>
      )}
    </div>
  )
}
