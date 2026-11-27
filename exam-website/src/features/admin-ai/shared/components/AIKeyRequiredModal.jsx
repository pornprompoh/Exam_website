import { KeyIcon } from '../../../../shared/components/AdminIcons'

export default function AIKeyRequiredModal({ onClose, onGoToSettings }) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 dark:bg-black/75 p-4 backdrop-blur-xs animate-fadeIn"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-key-required-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center shadow-2xl animate-scaleUp"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <KeyIcon className="w-5 h-5" />
        </div>
        <h2 id="ai-key-required-title" className="text-base font-bold text-slate-900 dark:text-white">
          ยังไม่ได้ตั้งค่า Gemini API Key
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          กรุณาตั้งค่า Gemini API Key ของคุณก่อนใช้งานฟีเจอร์ AI อ่านเอกสาร สกัดข้อสอบ หรือตรวจทานเฉลย
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            ไว้ภายหลัง
          </button>
          <button
            type="button"
            onClick={onGoToSettings}
            className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            ไปตั้งค่า API Key
          </button>
        </div>
      </section>
    </div>
  )
}
