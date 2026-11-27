import { useState } from 'react'
import { clearGeminiApiKey, getGeminiApiKey, saveGeminiApiKey } from '../../../../shared/lib/geminiApiKey'
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS, getGeminiModel, saveGeminiModel } from '../../../../shared/lib/geminiModels'
import { EyeIcon, EyeOffIcon, KeyIcon } from '../../../../shared/components/AdminIcons'

function maskApiKey(apiKey) {
  if (!apiKey) return ''
  if (apiKey.length <= 10) return `${apiKey.slice(0, 3)}...`
  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`
}

export default function AISettingsPage() {
  const [initialState] = useState(() => {
    try {
      const currentKey = getGeminiApiKey()
      return { savedKey: currentKey, isEditing: !currentKey, selectedModel: getGeminiModel(), error: '' }
    } catch (storageError) {
      return { savedKey: '', isEditing: true, selectedModel: DEFAULT_GEMINI_MODEL, error: storageError.message }
    }
  })
  const [savedKey, setSavedKey] = useState(initialState.savedKey)
  const [selectedModel, setSelectedModel] = useState(initialState.selectedModel)
  const [draftKey, setDraftKey] = useState('')
  const [isEditing, setIsEditing] = useState(initialState.isEditing)
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState(initialState.error)
  const [notice, setNotice] = useState('')

  const handleSave = (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    try {
      saveGeminiApiKey(draftKey)
      setSavedKey(getGeminiApiKey())
      setDraftKey('')
      setIsEditing(false)
      setNotice('บันทึก Gemini API Key บนเบราว์เซอร์นี้แล้ว')
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  const handleClear = () => {
    setError('')
    setNotice('')
    try {
      clearGeminiApiKey()
      setSavedKey('')
      setDraftKey('')
      setIsEditing(true)
      setNotice('ลบ Gemini API Key ออกจากเบราว์เซอร์นี้แล้ว')
    } catch (clearError) {
      setError(clearError.message)
    }
  }

  const handleModelChange = (event) => {
    const model = event.target.value
    setError('')
    setNotice('')
    try {
      saveGeminiModel(model)
      setSelectedModel(model)
      setNotice('บันทึกโมเดล Gemini ที่เลือกแล้ว')
    } catch (modelError) {
      setError(modelError.message)
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-200/80 dark:border-indigo-500/25 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              <KeyIcon className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Gemini API Key และโมเดลหลัก</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ใช้สำหรับฟีเจอร์สร้างข้อสอบ ดึงข้อสอบจากไฟล์ และตรวจทานเฉลย
              </p>
            </div>
          </div>

          <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${savedKey ? 'border-emerald-200 dark:border-emerald-500/25 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${savedKey ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {savedKey ? 'ตั้งค่า API Key แล้ว' : 'ยังไม่ได้ตั้งค่า API Key'}
          </span>
        </div>

        {savedKey && !isEditing && (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">คีย์ที่บันทึกไว้ในเบราว์เซอร์นี้</p>
              <p className="mt-1 font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">{maskApiKey(savedKey)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setError(''); setNotice(''); setIsEditing(true) }} className="h-9 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:hover:bg-indigo-500/25 px-3.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer">
                เปลี่ยนคีย์
              </button>
              <button type="button" onClick={handleClear} className="h-9 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 px-3.5 text-xs font-semibold text-rose-700 dark:text-rose-300 transition-colors cursor-pointer">
                ลบคีย์
              </button>
            </div>
          </div>
        )}

        {isEditing && (
          <form onSubmit={handleSave} className="space-y-3">
            <label htmlFor="gemini-api-key" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {savedKey ? 'Gemini API Key ใหม่' : 'Gemini API Key'}
            </label>
            <div className="flex gap-2">
              <input
                id="gemini-api-key"
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                value={draftKey}
                onChange={(event) => setDraftKey(event.target.value)}
                placeholder="วาง API Key ของคุณที่นี่ (AIza...)"
                className="min-w-0 flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 text-sm font-mono text-slate-900 dark:text-white outline-none transition-colors placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                aria-label={showKey ? 'ซ่อน API Key' : 'แสดง API Key'}
                onClick={() => setShowKey((visible) => !visible)}
                className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                {showKey ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
              {savedKey && (
                <button type="button" onClick={() => { setDraftKey(''); setIsEditing(false); setError('') }} className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer">
                  ยกเลิก
                </button>
              )}
              <button type="submit" disabled={!draftKey.trim()} className="h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer">
                บันทึก API Key
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800">
          <label htmlFor="gemini-model" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">โมเดล Gemini เริ่มต้น</label>
          <select id="gemini-model" value={selectedModel} onChange={handleModelChange} className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 text-sm text-slate-900 dark:text-white outline-none transition-colors focus:ring-2 focus:ring-indigo-500 cursor-pointer">
            {GEMINI_MODELS.map((model) => (
              <option key={model.value} value={model.value}>{model.label} — {model.description}</option>
            ))}
          </select>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            ใช้ API Key เดียวกันได้ทุกโมเดล หากโมเดลใดติด Rate Limit สามารถสลับมาใช้โมเดลอื่นได้ทันที
          </p>
        </div>

        {error && <p role="alert" className="rounded-xl border border-rose-200 dark:border-rose-500/25 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50 dark:bg-emerald-500/10 p-3 text-xs font-medium text-emerald-800 dark:text-emerald-300">{notice}</p>}

        <div className="space-y-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          <p>
            API Key จะถูกบันทึกไว้ใน <code className="font-mono text-slate-800 dark:text-slate-200">localStorage</code> ของเบราว์เซอร์นี้เท่านั้น ไม่ส่งไปเก็บในฐานข้อมูล และส่งตรงไปยัง Google Gemini API เมื่อใช้งาน
          </p>
          <p className="text-amber-800 dark:text-amber-300/90">แนะนำให้ใช้งานบนอุปกรณ์ส่วนตัวและจำกัดสิทธิ์คีย์ให้ใช้เฉพาะ Gemini API</p>
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="inline-flex font-semibold text-indigo-600 dark:text-indigo-400 underline underline-offset-4 transition-colors hover:text-indigo-700 dark:hover:text-indigo-300">
            รับ API Key ฟรีได้ที่ Google AI Studio ↗
          </a>
        </div>
      </div>
    </section>
  )
}
