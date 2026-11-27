import Navbar from '../../../shared/components/Navbar'
import LoadingScreen from '../../../shared/components/LoadingScreen'
import EmptyState from '../../../shared/components/EmptyState'
import useAnalytics from '../hooks/useAnalytics'
import AnalyticsKpiGrid from '../components/AnalyticsKpiGrid'
import SubjectPerformanceGrid from '../components/SubjectPerformanceGrid'
import RecentExamLogs from '../components/RecentExamLogs'

export default function AnalyticsPage() {
  const { sessions, subjectStats, totalQuestions, totalSessions, overallAccuracy, resolvedRate, loading, error } = useAnalytics()

  return (
    <div className="min-h-screen bg-slate-50/70 font-sans text-slate-800 pb-24 overflow-x-hidden">
      <Navbar showNavPills={true} />

      <main className="max-w-6xl mx-auto px-3 sm:px-6 mt-6 sm:mt-8 space-y-8 sm:space-y-12 min-w-0">
        {loading ? (
          <LoadingScreen text="กำลังคำนวณสถิติและวิเคราะห์ข้อมูลการสอบของคุณ..." />
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
            ดึงข้อมูลสถิติไม่สำเร็จ: {error.message}
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon="📊"
            title="ยังไม่มีประวัติการทำข้อสอบ"
            description="คุณยังไม่ได้เข้าทำข้อสอบในระบบเลย เริ่มต้นทำชุดข้อสอบแรกของคุณเพื่อเปิดใช้งานระบบสถิติวิเคราะห์ครับ"
            actionText="ไปเลือกวิชาและเริ่มทำข้อสอบ"
            onAction={() => { window.location.href = '/' }}
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
