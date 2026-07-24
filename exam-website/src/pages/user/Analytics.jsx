import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Navbar from '../../components/common/Navbar'
import LoadingScreen from '../../components/common/LoadingScreen'
import EmptyState from '../../components/common/EmptyState'

export default function Analytics() {
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState([])
  const [subjectStats, setSubjectStats] = useState([])
  
  // KPI Stats
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [totalSessions, setTotalSessions] = useState(0)
  const [overallAccuracy, setOverallAccuracy] = useState(0)
  const [resolvedRate, setResolvedRate] = useState(0)

  useEffect(() => {
    fetchAnalyticsData()
  }, [])

  async function fetchAnalyticsData() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // 1. ดึงประวัติการสอบทั้งหมด (Exam Sessions)
      const { data: sessionData, error: sessionErr } = await supabase
        .from('exam_sessions')
        .select(`
          *,
          categories ( name )
        `)
        .eq('user_id', session.user.id)
        .order('completed_at', { ascending: false })

      if (sessionErr) throw sessionErr
      const validSessions = sessionData || []
      setSessions(validSessions)

      // 2. ดึงข้อมูลคลังข้อผิดพลาด เพื่อคำนวณอัตราการทบทวน
      const { data: mistakeData, error: mistakeErr } = await supabase
        .from('mistake_bank')
        .select('id, is_resolved')
        .eq('user_id', session.user.id)

      if (mistakeErr) throw mistakeErr

      // --- คำนวณ Zone 1: KPI Summary ---
      const totalSess = validSessions.length
      setTotalSessions(totalSess)

      let totalQ = 0
      let totalScore = 0
      validSessions.forEach(s => {
        totalQ += (s.total_questions || 0)
        totalScore += (s.score || 0)
      })
      setTotalQuestions(totalQ)

      const acc = totalQ > 0 ? ((totalScore / totalQ) * 100).toFixed(1) : 0
      setOverallAccuracy(acc)

      const mistakes = mistakeData || []
      const totalMistakes = mistakes.length
      const resolvedMistakes = mistakes.filter(m => m.is_resolved).length
      const resRate = totalMistakes > 0 ? ((resolvedMistakes / totalMistakes) * 100).toFixed(1) : 100
      setResolvedRate(resRate)

      // --- คำนวณ Zone 2: Subject Performance ---
      const catMap = {}
      validSessions.forEach(s => {
        const catName = s.categories?.name || 'หมวดวิชาทั่วไป'
        if (!catMap[catName]) {
          catMap[catName] = { name: catName, sessions: 0, questions: 0, score: 0 }
        }
        catMap[catName].sessions += 1
        catMap[catName].questions += (s.total_questions || 0)
        catMap[catName].score += (s.score || 0)
      })

      const computedSubjects = Object.values(catMap).map(sub => {
        const subAcc = sub.questions > 0 ? ((sub.score / sub.questions) * 100).toFixed(1) : 0
        return { ...sub, accuracy: Number(subAcc) }
      }).sort((a, b) => b.questions - a.questions) // เรียงจากวิชาที่ทำข้อสอบเยอะสุดไปน้อยสุด

      setSubjectStats(computedSubjects)

    } catch (err) {
      alert('ดึงข้อมูลสถิติไม่สำเร็จ: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/70 font-sans text-slate-800 pb-24 overflow-x-hidden">
      <Navbar showNavPills={true} />

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white py-10 sm:py-16 border-b border-slate-700 shadow-inner">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white mb-2 sm:mb-3">
            สถิติและความคืบหน้าการสอบของคุณ 🎯
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            ติดตามจำนวนข้อสอบที่ทำไปทั้งหมด วิเคราะห์จุดแข็ง-จุดอ่อนในแต่ละวิชา และทบทวนประวัติคะแนนสอบย้อนหลังเพื่อเตรียมความพร้อมสู่ความสำเร็จครับ
          </p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 mt-6 sm:mt-8 space-y-8 sm:space-y-12 min-w-0">
        
        {loading ? (
          <LoadingScreen text="กำลังคำนวณสถิติและวิเคราะห์ข้อมูลการสอบของคุณ..." />
        ) : sessions.length === 0 ? (
          <EmptyState 
            icon="📊"
            title="ยังไม่มีประวัติการทำข้อสอบ"
            description="คุณยังไม่ได้เข้าทำข้อสอบในระบบเลย เริ่มต้นทำชุดข้อสอบแรกของคุณเพื่อเปิดใช้งานระบบสถิติวิเคราะห์ครับ"
            actionText="ไปเลือกวิชาและเริ่มทำข้อสอบ"
            onAction={() => window.location.href = '/'}
          />
        ) : (
          <>
            {/* ---------------------------------------------------------------------
                ZONE 1: แผงตัวเลขภาพรวม (KPI Cards - ตาราง 2x2 หรือ 4 คอลัมน์)
            --------------------------------------------------------------------- */}
            <section className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h2 className="font-extrabold text-base sm:text-lg text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-5 bg-red-600 rounded-full inline-block"></span>
                  <span>ภาพรวมความคืบหน้า (Key Metrics)</span>
                </h2>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 min-w-0">
                {/* KPI 1: จำนวนข้อที่ทำไป */}
                <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-xs font-bold text-slate-400 truncate">โจทย์ที่ฝึกทำไปแล้ว</span>
                    <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-base shrink-0">📝</span>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight">{totalQuestions.toLocaleString()}</div>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium truncate">ข้อสอบทั้งหมดที่ผ่านมือ</p>
                  </div>
                </div>

                {/* KPI 2: จำนวนรอบที่เข้าสอบ */}
                <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-xs font-bold text-slate-400 truncate">รอบการเข้าสอบ</span>
                    <span className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-base shrink-0">🏆</span>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight">{totalSessions.toLocaleString()}</div>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium truncate">ครั้งที่ทำแบบทดสอบเสร็จ</p>
                  </div>
                </div>

                {/* KPI 3: ความแม่นยำรวม */}
                <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-xs font-bold text-slate-400 truncate">ความแม่นยำรวม</span>
                    <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-base shrink-0">🎯</span>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight">{overallAccuracy}%</div>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium truncate">อัตราตอบถูกเฉลี่ยทุกวิชา</p>
                  </div>
                </div>

                {/* KPI 4: อัตราเคลียร์ข้อผิดพลาด */}
                <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-xs font-bold text-slate-400 truncate">อัตราเคลียร์จุดอ่อน</span>
                    <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-base shrink-0">💡</span>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-4xl font-black text-slate-900 font-mono tracking-tight">{resolvedRate}%</div>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium truncate">ทบทวนข้อผิดในคลังแล้ว</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ---------------------------------------------------------------------
                ZONE 2: วิเคราะห์จุดแข็ง - จุดอ่อน แยกตามหมวดวิชา
            --------------------------------------------------------------------- */}
            <section className="space-y-4 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <h2 className="font-extrabold text-base sm:text-lg text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-5 bg-teal-600 rounded-full inline-block"></span>
                  <span>ประสิทธิภาพแยกตามหมวดวิชา (Subject Performance)</span>
                </h2>
                <span className="text-xs text-slate-400 font-medium">เรียงตามจำนวนข้อที่ทำเยอะสุด</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 min-w-0">
                {subjectStats.map((sub, idx) => {
                  let badgeStyle = 'bg-slate-100 text-slate-600 border-slate-200'
                  let barColor = 'from-slate-400 to-slate-500'
                  let statusText = 'ทั่วไป'

                  if (sub.accuracy >= 80) {
                    badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    barColor = 'from-teal-500 to-emerald-500'
                    statusText = '🔥 จุดแข็ง (ทำได้ดีมาก)'
                  } else if (sub.accuracy >= 60) {
                    badgeStyle = 'bg-teal-50 text-teal-700 border-teal-200'
                    barColor = 'from-cyan-500 to-teal-500'
                    statusText = '✨ มาตรฐาน (ผ่านเกณฑ์)'
                  } else {
                    badgeStyle = 'bg-red-50 text-red-700 border-red-200'
                    barColor = 'from-red-500 to-rose-500'
                    statusText = '⚠️ ควรทบทวนเพิ่ม'
                  }

                  return (
                    <div key={idx} className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4 min-w-0">
                      <div className="flex items-start justify-between gap-3 min-w-0">
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] font-bold text-slate-400 font-mono block mb-0.5">SUBJECT #{idx + 1}</span>
                          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">{sub.name}</h3>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${badgeStyle}`}>
                          {statusText}
                        </span>
                      </div>

                      {/* หลอด Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-500">ความแม่นยำ (Accuracy)</span>
                          <span className="font-mono text-slate-900">{sub.accuracy}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
                          <div 
                            className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-1000`}
                            style={{ width: `${Math.max(5, sub.accuracy)}%` }}
                          />
                        </div>
                      </div>

                      {/* ข้อมูลรายละเอียดด้านล่าง */}
                      <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <span className="block text-[10px] text-slate-400 font-bold">เข้าสอบ</span>
                          <span className="font-extrabold text-slate-800 font-mono">{sub.sessions} รอบ</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <span className="block text-[10px] text-slate-400 font-bold">ทำไปแล้ว</span>
                          <span className="font-extrabold text-slate-800 font-mono">{sub.questions} ข้อ</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-xl">
                          <span className="block text-[10px] text-slate-400 font-bold">คะแนนรวม</span>
                          <span className="font-extrabold text-teal-600 font-mono">{sub.score} แต้ม</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ---------------------------------------------------------------------
                ZONE 3: ไทม์ไลน์ประวัติการสอบย้อนหลัง (Recent Exam Logs)
            --------------------------------------------------------------------- */}
            <section className="space-y-4 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <h2 className="font-extrabold text-base sm:text-lg text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-5 bg-indigo-600 rounded-full inline-block"></span>
                  <span>ประวัติการสอบล่าสุด (Recent Exam Logs)</span>
                </h2>
                <span className="text-xs text-slate-400 font-mono">ทั้งหมด {sessions.length} รายการ</span>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden min-w-0">
                <div className="divide-y divide-slate-100 min-w-0">
                  {sessions.map((sess) => {
                    const totalQ = sess.total_questions || 0
                    const sc = sess.score || 0
                    const pct = totalQ > 0 ? Math.round((sc / totalQ) * 100) : 0
                    
                    let scoreBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    if (pct < 50) scoreBadge = 'bg-red-50 text-red-700 border-red-200'
                    else if (pct < 80) scoreBadge = 'bg-amber-50 text-amber-800 border-amber-200'

                    return (
                      <div key={sess.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-lg shrink-0 mt-0.5 sm:mt-0">
                            📑
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                              {sess.categories?.name || 'หมวดวิชาทั่วไป'}
                            </h4>
                            <span className="text-xs text-slate-400 font-mono block mt-0.5">
                              📅 {new Date(sess.completed_at).toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
                            </span>
                          </div>
                        </div>

                        {/* ป้ายแสดงผลคะแนน */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 shrink-0">
                          <div className="text-xs font-bold text-slate-500 sm:hidden">ผลคะแนนที่ได้:</div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-medium hidden sm:inline">คะแนน:</span>
                            <span className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black font-mono border flex items-center gap-1.5 ${scoreBadge}`}>
                              <span>{sc}/{totalQ}</span>
                              <span className="text-[10px] opacity-80">({pct}%)</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          </>
        )}

      </main>
    </div>
  )
}