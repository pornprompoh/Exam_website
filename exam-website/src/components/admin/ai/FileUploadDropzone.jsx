export default function FileUploadDropzone({ files, onFilesChange }) {
  const handleChange = (event) => {
    const selectedFiles = [...event.target.files]
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

  return (
    <div>
      <label className="text-xs font-bold text-slate-300">ไฟล์เอกสาร (PDF/TXT สูงสุด 10 ไฟล์, ไฟล์ละไม่เกิน 10 MB)</label>
      <input
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        multiple
        required
        onChange={handleChange}
        className="mt-2 block w-full rounded-xl border border-dashed border-slate-700 bg-slate-950 p-4 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-white"
      />
      {files.length > 0 && <p className="mt-2 text-xs text-indigo-300">เลือกแล้ว {files.length} ไฟล์: {files.map((file) => file.name).join(', ')}</p>}
    </div>
  )
}
