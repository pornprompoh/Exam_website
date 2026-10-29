export default function AIKeyRequiredModal({ onClose, onGoToSettings }) {
  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-key-required-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-amber-500/20 bg-slate-900 p-6 text-center shadow-2xl"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-2xl">
          ⚠️
        </div>
        <h2 id="ai-key-required-title" className="text-lg font-black text-white">
          ยังไม่ได้ตั้งค่า Gemini API Key
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          ระบบจำเป็นต้องใช้ API Key ของคุณในการอ่านเอกสารและสร้างข้อสอบ กรุณาไปตั้งค่า Key ก่อนเริ่มใช้งาน
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-700"
          >
            ไว้ภายหลัง
          </button>
          <button
            type="button"
            onClick={onGoToSettings}
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:from-indigo-500 hover:to-violet-500"
          >
            👉 ไปตั้งค่า API Key
          </button>
        </div>
      </section>
    </div>
  )
}
