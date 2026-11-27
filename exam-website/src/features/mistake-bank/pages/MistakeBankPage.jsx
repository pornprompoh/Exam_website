import { useState } from 'react'
import Navbar from '../../../shared/components/Navbar'
import LoadingScreen from '../../../shared/components/LoadingScreen'
import EmptyState from '../../../shared/components/EmptyState'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import { AlertTriangleIcon, CheckCircleIcon, FlagIcon, SearchIcon } from '../../../shared/components/AdminIcons'
import useMistakeBank from '../hooks/useMistakeBank'
import MistakeCard from '../components/MistakeCard'

export default function MistakeBankPage() {
  const { mistakes, categories, loading, error, resolveMistake } = useMistakeBank()
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [modalTarget, setModalTarget] = useState(null)

  async function handleConfirmResolve() {
    if (!modalTarget) return
    try {
      await resolveMistake(modalTarget)
      setModalTarget(null)
    } catch (err) {
      alert('ไม่สามารถอัปเดตสถานะได้: ' + err.message)
    }
  }

  const filteredMistakes = mistakes.filter((m) => {
    if (selectedCategory === 'ALL') return true
    return String(m.questions?.category_id) === String(selectedCategory)
  })

  return (
    <div className="min-h-dvh bg-[#f8f8f9] dark:bg-[#000000] font-sans text-zinc-900 dark:text-zinc-100 pb-24 overflow-x-hidden transition-colors duration-300">
      <ConfirmModal
        isOpen={!!modalTarget}
        type="success"
        title="ทบทวนข้อนี้เข้าใจแล้วใช่หรือไม่?"
        description={
          <>
            ข้อสอบนี้จะถูกนำออกจากคลังข้อผิดพลาดของคุณ และจะไม่แสดงในรายการทบทวนอีก
            <br />
            คุณสามารถกลับมาฝึกทำข้อสอบวิชานี้ใหม่ได้เสมอที่หน้าหลัก
          </>
        }
        cancelText="เก็บไว้ทบทวนต่อ"
        confirmText="เข้าใจแล้ว นำออกเลย"
        onClose={() => setModalTarget(null)}
        onConfirm={handleConfirmResolve}
      />

      <Navbar showNavPills={true} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-7 space-y-5 min-w-0">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200/70 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <FlagIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
                คลังข้อผิดพลาด
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                ทบทวนข้อสอบที่เคยตอบผิดและนำออกเมื่อทำความเข้าใจเรียบร้อยแล้ว
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-white dark:bg-[#181818] px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-[#272727] flex items-center gap-1.5">
              <span>รอทบทวน</span>
              <strong className="text-rose-600 dark:text-rose-400 font-mono tabular-nums text-sm font-semibold">
                {mistakes.length.toLocaleString()}
              </strong>
              <span>ข้อ</span>
            </div>
          </div>
        </header>

        <div className="bg-white dark:bg-[#181818] p-4 rounded-2xl border border-zinc-200 dark:border-[#272727] flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 transition-colors duration-300">
          <label htmlFor="mistake-category-filter" className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <SearchIcon className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <span>กรองตามหมวดวิชา</span>
          </label>

          <div className="w-full sm:w-auto sm:min-w-64 sm:max-w-xs min-w-0">
            <select
              id="mistake-category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-[#1F1F1F] hover:bg-zinc-100/70 dark:hover:bg-[#272727] rounded-xl border border-zinc-200 dark:border-[#313131] text-zinc-800 dark:text-zinc-200 text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer truncate pr-8"
            >
              <option value="ALL">แสดงทั้งหมด ({mistakes.length.toLocaleString()} ข้อ)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <LoadingScreen text="กำลังเปิดคลังข้อผิดพลาด..." />
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 dark:border-rose-500/25 bg-rose-50 dark:bg-rose-500/10 p-5 text-sm font-medium text-rose-700 dark:text-rose-300 flex items-start gap-2.5"
          >
            <AlertTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
            <span>ดึงข้อมูลคลังข้อผิดไม่สำเร็จ: {error.message}</span>
          </div>
        ) : filteredMistakes.length === 0 ? (
          <EmptyState
            icon={<CheckCircleIcon className="w-5 h-5" />}
            title="คลังข้อผิดพลาดว่างเปล่า"
            description="คุณยังไม่มีข้อที่ทำผิดในหมวดนี้ หรือได้ทบทวนและทำความเข้าใจครบทั้งหมดแล้ว"
            actionText="กลับไปเลือกวิชาสอบ"
            onAction={() => {
              window.location.href = '/'
            }}
          />
        ) : (
          <div className="space-y-5 min-w-0">
            {filteredMistakes.map((item, idx) => (
              <MistakeCard key={item.id} item={item} index={idx} onRequestResolve={setModalTarget} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
