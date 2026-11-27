import Navbar from '../../../shared/components/Navbar'
import LoadingScreen from '../../../shared/components/LoadingScreen'
import EmptyState from '../../../shared/components/EmptyState'
import { AlertTriangleIcon } from '../../../shared/components/AdminIcons'
import useAnalytics from '../hooks/useAnalytics'
import AnalyticsKpiGrid from '../components/AnalyticsKpiGrid'
import SubjectPerformanceGrid from '../components/SubjectPerformanceGrid'
import RecentExamLogs from '../components/RecentExamLogs'

function ChartBarIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d="M3 3v18h18" />
      <rect x="7" y="10" width="3" height="7" rx="0.5" />
      <rect x="12.5" y="6" width="3" height="11" rx="0.5" />
      <rect x="18" y="13" width="3" height="4" rx="0.5" />
    </svg>
  )
}

export default function AnalyticsPage() {
  const { sessions, subjectStats, totalQuestions, totalSessions, overallAccuracy, resolvedRate, loading, error } = useAnalytics()

  return (
    <div className="min-h-dvh bg-[#f8f8f9] dark:bg-[#000000] font-sans text-zinc-900 dark:text-zinc-100 pb-24 overflow-x-hidden transition-colors duration-300">
      <Navbar showNavPills={true} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-7 space-y-6 sm:space-y-8 min-w-0">
        <header className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/70 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <ChartBarIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
              สถิติและวิเคราะห์ผลการสอบ
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
              ติดตามความคืบหน้า ความแม่นยำรายวิชา และประวัติการทำข้อสอบล่าสุดของคุณ
            </p>
          </div>
        </header>

        {loading ? (
          <LoadingScreen text="กำลังคำนวณสถิติและวิเคราะห์ข้อมูลการสอบของคุณ..." />
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 dark:border-rose-500/25 bg-rose-50 dark:bg-rose-500/10 p-5 text-sm font-medium text-rose-700 dark:text-rose-300 flex items-start gap-2.5"
          >
            <AlertTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
            <span>ดึงข้อมูลสถิติไม่สำเร็จ: {error.message}</span>
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<ChartBarIcon className="w-5 h-5" />}
            title="ยังไม่มีประวัติการทำข้อสอบ"
            description="คุณยังไม่ได้เข้าทำข้อสอบในระบบ เริ่มต้นทำชุดข้อสอบแรกของคุณเพื่อเปิดดูสถิติและวิเคราะห์ผล"
            actionText="ไปเลือกวิชาและเริ่มทำข้อสอบ"
            onAction={() => {
              window.location.href = '/'
            }}
          />
        ) : (
          <>
            <AnalyticsKpiGrid
              totalQuestions={totalQuestions}
              totalSessions={totalSessions}
              overallAccuracy={overallAccuracy}
              resolvedRate={resolvedRate}
            />
            <SubjectPerformanceGrid subjectStats={subjectStats} />
            <RecentExamLogs sessions={sessions} />
          </>
        )}
      </main>
    </div>
  )
}
