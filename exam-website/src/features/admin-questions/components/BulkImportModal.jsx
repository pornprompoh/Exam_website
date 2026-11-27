import { useState } from 'react'
import { useModal } from '../../../shared/context/ModalContext'
import AdminModalShell from '../../../shared/components/AdminModalShell'
import { UploadBoltIcon } from '../../../shared/components/AdminIcons'
import { BULK_IMPORT_MAGIC_PROMPT, parseBulkImportText } from '../utils/bulkImportParser'
import { insertBulkQuestions } from '../services/questionService'

export default function BulkImportModal({ isOpen, onClose, categoryId, currentUserId, onSuccess }) {
  const [bulkInputText, setBulkInputText] = useState('')
  const [parsedQuestions, setParsedQuestions] = useState([])
  const [bulkStep, setBulkStep] = useState('input')
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [saving, setSaving] = useState(false)

  const { showModal } = useModal()

  if (!isOpen) return null

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(BULK_IMPORT_MAGIC_PROMPT)
      setCopiedPrompt(true)
      setTimeout(() => setCopiedPrompt(false), 2500)
    } catch (error) {
      console.error('Copy prompt failed:', error)
      showModal({
        type: 'warning',
        title: 'คัดลอกไม่สำเร็จ',
        description: 'เบราว์เซอร์ไม่รองรับการคัดลอกอัตโนมัติ กรุณาคลุมข้อความแล้วคัดลอกด้วยตนเอง'
      })
    }
  }

  const handleParseBulkText = (e) => {
    if (e) e.preventDefault()

    const newParsedList = parseBulkImportText(bulkInputText)
    if (newParsedList.length === 0) {
      return showModal({
        type: 'danger',
        title: 'ฟอร์แมตข้อความไม่ถูกต้อง',
        description: 'ไม่พบข้อมูลข้อสอบ กรุณาตรวจสอบว่ามีเครื่องหมาย --- คั่นระหว่างข้อและมีตัวเลือก A. B. C. D. ครบถ้วน'
      })
    }

    setParsedQuestions(newParsedList)
    setBulkStep('preview')
  }

  const handleConfirmBulkSave = async (asActive = true) => {
    if (!categoryId) {
      return showModal({
        type: 'warning',
        title: 'ยังไม่ได้เลือกวิชา',
        description: 'กรุณาเลือกหมวดหมู่วิชาสอบที่ต้องการนำเข้าก่อน'
      })
    }
    setSaving(true)

    try {
      await insertBulkQuestions({
        categoryId,
        currentUserId,
        parsedQuestions,
        asActive
      })

      const statusText = asActive ? 'เปิดใช้งานทันที' : 'ฉบับร่าง (ซ่อนจากผู้สอบ)'
      showModal({
        type: 'success',
        title: 'นำเข้าข้อสอบสำเร็จ',
        description: `บันทึกข้อสอบจำนวน ${parsedQuestions.length} ข้อในสถานะ "${statusText}" เรียบร้อยแล้ว`
      })

      setTimeout(() => {
        handleClose()
        if (onSuccess) onSuccess()
      }, 1500)
    } catch (err) {
      showModal({
        type: 'danger',
        title: 'นำเข้าไม่สำเร็จ',
        description: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setBulkInputText('')
    setParsedQuestions([])
    setBulkStep('input')
    onClose()
  }

  const footer =
    bulkStep === 'input' ? (
      <div className="flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={handleClose}
          className="h-10 px-4 rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-[#272727] dark:hover:bg-[#313131] text-zinc-700 dark:text-zinc-200 text-sm font-semibold transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          form="bulk-import-form"
          className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
        >
          ประมวลผลและตรวจสอบ
        </button>
      </div>
    ) : (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={() => setBulkStep('input')}
          className="h-10 px-4 bg-zinc-200 hover:bg-zinc-300 dark:bg-[#272727] dark:hover:bg-[#313131] text-zinc-700 dark:text-zinc-200 font-semibold rounded-xl text-sm transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
        >
          ← กลับไปแก้ไขข้อความ
        </button>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={() => handleConfirmBulkSave(false)}
            disabled={saving}
            className="h-10 px-4 bg-white hover:bg-zinc-100 dark:bg-[#181818] dark:hover:bg-[#272727] border border-zinc-200 dark:border-[#313131] disabled:opacity-50 text-zinc-700 dark:text-zinc-200 font-semibold rounded-xl text-sm transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
          >
            บันทึกเป็นฉบับร่าง
          </button>

          <button
            type="button"
            onClick={() => handleConfirmBulkSave(true)}
            disabled={saving}
            className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
          >
            {saving ? 'กำลังบันทึก...' : `เผยแพร่ทันที (${parsedQuestions.length} ข้อ)`}
          </button>
        </div>
      </div>
    )

  return (
    <AdminModalShell
      isOpen={isOpen}
      onClose={handleClose}
      title="นำเข้าข้อสอบชุดใหญ่ (วางข้อความ)"
      titleId="bulk-import-title"
      icon={<UploadBoltIcon className="w-4 h-4" />}
      footer={footer}
      maxWidth="max-w-4xl"
    >
      {bulkStep === 'input' ? (
        <div className="space-y-5">
          <div className="bg-zinc-50 dark:bg-[#1F1F1F] p-4 rounded-2xl border border-zinc-200 dark:border-[#272727] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                1. คัดลอกคำสั่งช่วยจัดฟอร์แมตสำหรับ AI
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mt-0.5">
                นำไปวางพร้อมรูปภาพข้อสอบใน Gemini หรือ ChatGPT เพื่อแปลงเป็นข้อความที่ระบบอ่านได้
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold rounded-xl text-xs transition-all duration-300 ease-premium shrink-0 cursor-pointer"
            >
              {copiedPrompt ? '✓ คัดลอกแล้ว' : 'คัดลอกคำสั่ง Prompt'}
            </button>
          </div>

          <form id="bulk-import-form" onSubmit={handleParseBulkText} className="space-y-2">
            <label htmlFor="bulk-textarea" className="block font-semibold text-zinc-700 dark:text-zinc-300 text-xs">
              2. วางข้อความข้อสอบที่จัดฟอร์แมตแล้ว (คั่นแต่ละข้อด้วย ---)
            </label>
            <textarea
              id="bulk-textarea"
              required
              value={bulkInputText}
              onChange={(e) => setBulkInputText(e.target.value)}
              placeholder={'1. ข้อใดคือ...\nA. ...\nB. ...\nC. ...\nD. ...\nANS: A\n---'}
              className="w-full min-h-72 bg-zinc-50 dark:bg-[#1F1F1F] border border-zinc-200 dark:border-[#272727] rounded-xl p-4 text-sm text-zinc-900 dark:text-zinc-100 font-mono placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />
          </form>
        </div>
      ) : (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm tabular-nums">
              ตรวจสอบรายการที่แปลงได้ ({parsedQuestions.length} ข้อ)
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">เลือกรูปแบบการบันทึกที่แถบด้านล่าง</span>
          </div>

          <div className="space-y-3">
            {parsedQuestions.map((pq, idx) => (
              <article
                key={idx}
                className="bg-zinc-50 dark:bg-[#1F1F1F] border border-zinc-200 dark:border-[#272727] rounded-2xl p-4 space-y-3 min-w-0"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="px-2 py-0.5 bg-zinc-200 dark:bg-[#272727] text-zinc-700 dark:text-zinc-300 rounded-md text-xs font-semibold tabular-nums shrink-0">
                    #{idx + 1}
                  </span>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 break-words [word-break:break-word] leading-relaxed">
                    {pq.question_text}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:pl-9">
                  {pq.options.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className={`text-xs p-2.5 rounded-xl border ${
                        oIdx === pq.correct_option
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300 font-semibold'
                          : 'bg-white dark:bg-[#181818] border-zinc-200 dark:border-[#272727] text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <span className="mr-2 font-bold">{['A', 'B', 'C', 'D'][oIdx]}.</span>
                      <span className="break-words">{opt}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </AdminModalShell>
  )
}
