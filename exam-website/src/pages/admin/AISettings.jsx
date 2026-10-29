import { useState } from 'react'
import {
  clearGeminiApiKey,
  getGeminiApiKey,
  saveGeminiApiKey
} from '../../lib/geminiApiKey'
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODELS,
  getGeminiModel,
  saveGeminiModel
} from '../../lib/geminiModels'

function maskApiKey(apiKey) {
  if (!apiKey) return ''
  if (apiKey.length <= 10) return `${apiKey.slice(0, 3)}...`
  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`
}

export default function AISettings() {
  const [initialState] = useState(() => {
    try {
      const currentKey = getGeminiApiKey()
      return {
        savedKey: currentKey,
        isEditing: !currentKey,
        selectedModel: getGeminiModel(),
        error: ''
      }
    } catch (storageError) {
      return {
        savedKey: '',
        isEditing: true,
        selectedModel: DEFAULT_GEMINI_MODEL,
        error: storageError.message
      }
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
      const currentKey = getGeminiApiKey()
      setSavedKey(currentKey)
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
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-xl text-indigo-300">
              ⚙️
            </span>
            <div>
              <h2 className="text-lg font-black text-white">ตั้งค่า AI (Gemini API Key)</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">
                ใช้ API Key ของคุณเพื่อสร้างข้อสอบจากเอกสาร
              </p>
            </div>
          </div>
          <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
            savedKey
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
          }`}>
            <span aria-hidden="true">{savedKey ? '🟢' : '🟡'}</span>
            {savedKey ? 'ตั้งค่า API Key แล้ว' : 'ยังไม่ได้ตั้งค่า API Key'}
          </span>
        </div>

        {savedKey && !isEditing && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400">คีย์ที่บันทึกไว้ในเบราว์เซอร์นี้</p>
              <p className="mt-1 font-mono text-sm text-emerald-300">{maskApiKey(savedKey)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setError('')
                setNotice('')
                setIsEditing(true)
              }}
              className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-sm font-bold text-indigo-300 transition-colors hover:bg-indigo-500/20"
            >
              เปลี่ยนคีย์
            </button>
          </div>
        )}

        {isEditing && (
          <form onSubmit={handleSave} className="mt-6 space-y-4">
            <label htmlFor="gemini-api-key" className="block text-sm font-bold text-slate-200">
              {savedKey ? 'Gemini API Key ใหม่' : 'Gemini API Key'}
            </label>
            <div className="flex gap-2">
              <input
                id="gemini-api-key"
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                value={draftKey}
                onChange={(event) => setDraftKey(event.target.value)}
                placeholder="วาง API Key ของคุณที่นี่"
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-indigo-500"
              />
              <button
                type="button"
                aria-label={showKey ? 'ซ่อน API Key' : 'แสดง API Key'}
                onClick={() => setShowKey((visible) => !visible)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 text-lg text-slate-300 transition-colors hover:bg-slate-700"
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {savedKey && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftKey('')
                    setIsEditing(false)
                    setError('')
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-bold text-slate-300 transition-colors hover:bg-slate-700"
                >
                  ยกเลิก
                </button>
              )}
              <button
                type="submit"
                disabled={!draftKey.trim()}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:from-indigo-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                บันทึก API Key
              </button>
            </div>
          </form>
        )}

        {savedKey && !isEditing && (
          <button
            type="button"
            onClick={handleClear}
            className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-bold text-red-300 transition-colors hover:bg-red-500/20"
          >
            ลบ/ล้างคีย์
          </button>
        )}

        <div className="mt-6 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <label htmlFor="gemini-model" className="block text-sm font-bold text-slate-200">
            โมเดล Gemini
          </label>
          <select
            id="gemini-model"
            value={selectedModel}
            onChange={handleModelChange}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-indigo-500"
          >
            {GEMINI_MODELS.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label} — {model.description}
              </option>
            ))}
          </select>
          <p className="text-xs leading-relaxed text-slate-400">
            ใช้ API Key เดียวกันได้ทุกโมเดล หากโมเดลใดติด Rate Limit สามารถสลับมาใช้โมเดลอื่นเพื่อทำงานต่อได้ทันที
          </p>
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</p>}

        <div className="mt-6 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-relaxed text-slate-400">
          <p>
            API Key จะถูกบันทึกไว้ใน localStorage ของเบราว์เซอร์นี้เท่านั้น ไม่ส่งไปเก็บในเซิร์ฟเวอร์หรือฐานข้อมูลของระบบ และจะถูกส่งตรงไปยัง Google Gemini API เมื่อสร้างข้อสอบ
          </p>
          <p className="text-xs text-amber-300/90">
            เพื่อความปลอดภัย ให้ใช้เฉพาะอุปกรณ์ส่วนตัวและจำกัด API Key ให้ใช้งานกับ Gemini API เท่านั้น ผู้ที่เข้าถึงเบราว์เซอร์หรือโปรไฟล์เครื่องนี้อาจเข้าถึงคีย์ได้
          </p>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex font-bold text-indigo-300 underline decoration-indigo-500/40 underline-offset-4 transition-colors hover:text-indigo-200"
          >
            🔗 รับ API Key ฟรีได้ที่ Google AI Studio ↗
          </a>
        </div>
      </div>
    </section>
  )
}
