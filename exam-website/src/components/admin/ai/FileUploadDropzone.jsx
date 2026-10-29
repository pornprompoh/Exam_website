import { getGeminiApiKey } from '../../../lib/geminiApiKey'

export default function FileUploadDropzone({ files, onFilesChange, onRequireApiKey }) {
  const ensureApiKey = () => {
    try {
      if (getGeminiApiKey()) return true
    } catch (error) {
      onFilesChange([], error.message)
      onRequireApiKey?.()
      return false
    }
    onFilesChange([], '')
    onRequireApiKey?.()
    return false
  }

  const handleFiles = (selectedFiles) => {
    const oversized = selectedFiles.find((file) => file.size > 10 * 1024 * 1024)
    if (oversized) {
      onFilesChange([], `ไฟล์ "${oversized.name}" มีขนาดเกิน 10 MB`)
      return
    }
    if (selectedFiles.length > 10) {
      onFilesChange([], 'เลือกไฟล์ได้ไม่เกิน 10 ไฟล์ต่อครั้ง')
      return
    }
    onFilesChange(selectedFiles, '')
  }

  const handleChange = (event) => {
    if (!ensureApiKey()) {
      event.target.value = ''
      return
    }
    handleFiles([...event.target.files])
  }

  const handleInputClick = (event) => {
    if (!ensureApiKey()) event.preventDefault()
  }

  const handleDrop = (event) => {
    event.preventDefault()
    if (!ensureApiKey()) return
    handleFiles([...event.dataTransfer.files])
  }

  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      className="rounded-2xl border border-dashed border-slate-700 p-4 transition-colors hover:border-indigo-500/60"
    >
      <label className="text-xs font-bold text-slate-300">ไฟล์เอกสาร (PDF/TXT สูงสุด 10 ไฟล์, ไฟล์ละไม่เกิน 10 MB)</label>
      <input
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        multiple
        required
        onClick={handleInputClick}
        onChange={handleChange}
        className="mt-2 block w-full rounded-xl bg-slate-950 p-4 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-white"
      />
      <p className="mt-2 text-center text-xs text-slate-500">หรือลากไฟล์มาวางที่นี่</p>
      {files.length > 0 && <p className="mt-2 text-xs text-indigo-300">เลือกแล้ว {files.length} ไฟล์: {files.map((file) => file.name).join(', ')}</p>}
    </div>
  )
}
