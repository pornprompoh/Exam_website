import { KeyIcon } from '../../../../shared/components/AdminIcons'

export default function AIKeyRequiredModal({ onClose, onGoToSettings }) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-80 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs animate-fadeIn"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-key-required-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-[#272727] bg-white dark:bg-[#181818] p-6 text-center shadow-2xl animate-scaleUp"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <KeyIcon className="w-5 h-5" />
        </div>
        <h2 id="ai-key-required-title" className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          ยังไม่ได้ตั้งค่า Gemini API Key
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          กรุณาตั้งค่า Gemini API Key ก่อนใช้งานเครื่องมือ AI สร้างข้อสอบ ดึงข้อสอบจากไฟล์ หรือตรวจทานเฉลย
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-zinc-200 dark:border-[#313131] bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1F1F1F] dark:hover:bg-[#272727] px-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200 transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
          >
            ไว้ภายหลัง
          </button>
          <button
            type="button"
            onClick={onGoToSettings}
            className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 text-sm font-semibold text-white transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
          >
            ไปตั้งค่า API Key
          </button>
        </div>
      </section>
    </div>
  )
}
