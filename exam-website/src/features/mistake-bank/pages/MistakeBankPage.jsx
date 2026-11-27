import { useState } from 'react'
import Navbar from '../../../shared/components/Navbar'
import LoadingScreen from '../../../shared/components/LoadingScreen'
import EmptyState from '../../../shared/components/EmptyState'
import ConfirmModal from '../../../shared/components/ConfirmModal'
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
    <div className="min-h-screen bg-slate-50/70 font-sans text-slate-800 pb-24 overflow-x-hidden">
      <ConfirmModal
        isOpen={!!modalTarget}
        type="success"
        title="ทบทวนข้อนี้เข้าใจแล้วใช่ไหม?"
        description={
          <>
            ข้อสอบนี้จะถูกลบออกจากคลังข้อผิดพลาดของคุณ และจะไม่แสดงในรายการทบทวนอีก<br />
            คุณสามารถกลับมาฝึกทำข้อสอบวิชานี้ใหม่ได้เสมอที่หน้าแรกครับ
          </>
        }
        cancelText="← เก็บไว้ทบทวนต่อ"
        confirmText="✨ เข้าใจแล้ว นำออกเลย"
        onClose={() => setModalTarget(null)}
        onConfirm={handleConfirmResolve}
      />

      <Navbar showNavPills={true} />

      <div className="max-w-5xl mx-auto px-3 sm:px-6 mt-6 sm:mt-8 min-w-0">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8 min-w-0">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <span className="text-base sm:text-lg">🔍</span>
            <span className="font-extrabold text-slate-800 text-xs sm:text-sm">กรองตามหมวดวิชา:</span>
          </div>

          <div className="w-full sm:w-auto sm:max-w-xs min-w-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3.5 py-2 sm:py-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all cursor-pointer truncate pr-8"
            >
              <option value="ALL">💡 แสดงทั้งหมด ({mistakes.length} ข้อ)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>📖 {cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <LoadingScreen text="กำลังเปิดสมุดคลังข้อผิดพลาด..." />
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">
            ดึงข้อมูลคลังข้อผิดไม่สำเร็จ: {error.message}
          </div>
        ) : filteredMistakes.length === 0 ? (
          <EmptyState
            icon="🎉"
            title="สุดยอดมาก! คลังข้อผิดว่างเปล่า"
            description="คุณยังไม่มีข้อที่ทำผิดในหมวดนี้ หรือคุณได้ทำการทบทวนและทำความเข้าใจจนครบหมดแล้วครับ"
            actionText="กลับไปเลือกวิชาสอบ"
            onAction={() => { window.location.href = '/' }}
          />
        ) : (
          <div className="space-y-5 sm:space-y-6 min-w-0">
            {filteredMistakes.map((item, idx) => (
              <MistakeCard key={item.id} item={item} index={idx} onRequestResolve={setModalTarget} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
