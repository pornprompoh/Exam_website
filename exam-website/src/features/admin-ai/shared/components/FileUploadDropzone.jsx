import { getGeminiApiKey } from '../../../../shared/lib/geminiApiKey'
import { UploadBoltIcon } from '../../../../shared/components/AdminIcons'

export default function FileUploadDropzone({
  files,
  onFilesChange,
  onRequireApiKey,
  accept = '.pdf,.txt,application/pdf,text/plain',
  maxFileSizeMb = 10,
  maxFiles = 10,
  label = 'ไฟล์เอกสาร (PDF หรือ TXT สูงสุด 10 ไฟล์, ไฟล์ละไม่เกิน 10 MB)',
  helperText = 'หรือลากไฟล์มาวางในพื้นที่นี้',
  multiple = true,
  required = true,
  disabled = false,
  validateFiles = null
}) {
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
    if (typeof validateFiles === 'function') {
      const customError = validateFiles(selectedFiles)
      if (customError) {
        onFilesChange([], customError)
        return
      }
      onFilesChange(selectedFiles, '')
      return
    }

    const oversized = selectedFiles.find((file) => file.size > maxFileSizeMb * 1024 * 1024)
    if (oversized) {
      onFilesChange([], `ไฟล์ "${oversized.name}" มีขนาดเกิน ${maxFileSizeMb} MB`)
      return
    }
    if (selectedFiles.length > maxFiles) {
      onFilesChange([], `เลือกไฟล์ได้ไม่เกิน ${maxFiles} ไฟล์ต่อครั้ง`)
      return
    }
    onFilesChange(selectedFiles, '')
  }

  const handleChange = (event) => {
    if (disabled) return
    if (!ensureApiKey()) {
      event.target.value = ''
      return
    }
    handleFiles([...event.target.files])
  }

  const handleInputClick = (event) => {
    if (disabled) {
      event.preventDefault()
      return
    }
    if (!ensureApiKey()) event.preventDefault()
  }

  const handleDrop = (event) => {
    event.preventDefault()
    if (disabled) return
    if (!ensureApiKey()) return
    handleFiles([...event.dataTransfer.files])
  }

  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      className={`rounded-2xl border border-dashed border-zinc-300 dark:border-[#313131] bg-zinc-50 dark:bg-[#1F1F1F] p-4 sm:p-5 transition-colors duration-300 ${
        disabled ? 'opacity-50 pointer-events-none' : 'hover:border-indigo-400 dark:hover:border-indigo-500/60'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <UploadBoltIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
        <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-snug">{label}</label>
      </div>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        required={required}
        disabled={disabled}
        onClick={handleInputClick}
        onChange={handleChange}
        className="mt-3 block w-full rounded-xl bg-white dark:bg-[#181818] border border-zinc-200 dark:border-[#272727] p-3 text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-700 cursor-pointer"
      />
      <p className="mt-2.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{helperText}</p>
      {files.length > 0 && (
        <p className="mt-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 break-words">
          เลือกแล้ว {files.length} ไฟล์: {files.map((file) => file.name).join(', ')}
        </p>
      )}
    </div>
  )
}
