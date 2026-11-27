/* eslint-disable react-hooks/set-state-in-effect, react-hooks/immutability */
import { useState, useEffect } from 'react'
import { CloseIcon, PlusIcon } from '../../../shared/components/AdminIcons'
import { saveQuestionWithImages } from '../services/questionService'

export default function QuestionForm({
  selectedCat,
  currentUserId,
  editingQuestion,
  onCancelEdit,
  onSaveSuccess,
  showModal
}) {
  const [questionText, setQuestionText] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctOption, setCorrectOption] = useState(0)
  const [explanation, setExplanation] = useState('')
  const [isRandomized, setIsRandomized] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [imageFile, setImageFile] = useState(null)
  const [expImageFile, setExpImageFile] = useState(null)
  const [existingImageUrl, setExistingImageUrl] = useState(null)
  const [existingExpImageUrl, setExistingExpImageUrl] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editingQuestion) {
      setQuestionText(editingQuestion.question_text || '')
      setOptions(editingQuestion.options || ['', '', '', ''])
      setCorrectOption(Number(editingQuestion.correct_option) || 0)
      setExplanation(editingQuestion.explanation || '')
      setIsRandomized(editingQuestion.is_options_randomized ?? true)
      setIsActive(editingQuestion.is_active ?? true)
      setExistingImageUrl(editingQuestion.image_url)
      setExistingExpImageUrl(editingQuestion.explanation_image_url)
      setImageFile(null)
      setExpImageFile(null)
    } else {
      handleResetForm()
    }
  }, [editingQuestion])

  const handleResetForm = () => {
    setQuestionText('')
    setOptions(['', '', '', ''])
    setCorrectOption(0)
    setExplanation('')
    setIsRandomized(true)
    setIsActive(true)
    setExistingImageUrl(null)
    setExistingExpImageUrl(null)
    setImageFile(null)
    setExpImageFile(null)
  }

  const handleOptionChange = (index, value) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const addOption = () => {
    if (options.length < 6) setOptions([...options, ''])
  }

  const removeOption = (indexToRemove) => {
    if (options.length <= 2) {
      return showModal('warning', 'ลบไม่ได้', 'ข้อสอบต้องมีตัวเลือกคำตอบอย่างน้อย 2 ข้อครับ')
    }
    const newOptions = options.filter((_, idx) => idx !== indexToRemove)
    setOptions(newOptions)
    if (correctOption === indexToRemove) setCorrectOption(0)
    else if (correctOption > indexToRemove) setCorrectOption(correctOption - 1)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedCat) return showModal('warning', 'ยังไม่ได้เลือกวิชา', 'กรุณาเลือกหมวดหมู่วิชาก่อนบันทึกครับ')
    if (!questionText.trim()) return showModal('warning', 'ข้อมูลไม่ครบ', 'กรุณากรอกโจทย์คำถามก่อนบันทึกครับ')
    if (options.some((opt) => !opt.trim())) {
      return showModal('warning', 'ข้อมูลไม่ครบ', 'กรุณากรอกตัวเลือกคำตอบให้ครบถ้วนทุกข้อครับ')
    }

    setSaving(true)
    try {
      await saveQuestionWithImages({
        editingQuestion,
        categoryId: selectedCat,
        currentUserId,
        questionText,
        options,
        correctOption,
        explanation,
        isRandomized,
        isActive,
        imageFile,
        expImageFile,
        existingImageUrl,
        existingExpImageUrl
      })

      if (editingQuestion) {
        showModal('success', 'บันทึกสำเร็จ', 'อัปเดตการแก้ไขข้อสอบเรียบร้อยแล้ว')
        onCancelEdit()
      } else {
        showModal('success', 'สร้างข้อสอบสำเร็จ', 'เพิ่มโจทย์ข้อสอบใหม่ลงในคลังเรียบร้อยแล้ว')
        handleResetForm()
      }

      onSaveSuccess()
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาดในการบันทึก', err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          โจทย์คำถาม <span className="text-rose-500">*</span>
        </label>
        <textarea
          rows="4"
          required
          placeholder="พิมพ์โจทย์คำถามที่นี่..."
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors resize-y leading-relaxed"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          รูปประกอบโจทย์{' '}
          {existingImageUrl && <span className="text-emerald-600 dark:text-emerald-400 font-medium">(มีรูปเดิมอยู่แล้ว)</span>}
        </label>
        {existingImageUrl && (
          <div className="mb-2.5 relative inline-block">
            <img
              src={existingImageUrl}
              alt="รูปเดิม"
              className="h-20 w-auto rounded-lg border border-slate-200 dark:border-slate-700 object-cover"
            />
            <button
              type="button"
              onClick={() => setExistingImageUrl(null)}
              aria-label="ลบรูปประกอบเดิม"
              className="absolute -top-2 -right-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full w-5 h-5 flex items-center justify-center shadow cursor-pointer"
            >
              <CloseIcon className="w-3 h-3" />
            </button>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files[0])}
          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
        />
      </div>

      <div className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            ตัวเลือกคำตอบ ({options.length} ตัวเลือก) <span className="text-rose-500">*</span>
          </label>
          {options.length < 6 && (
            <button
              type="button"
              onClick={addOption}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>เพิ่มตัวเลือก</span>
            </button>
          )}
        </div>

        <div className="space-y-2">
          {options.map((opt, idx) => {
            const isCorrect = correctOption === idx
            return (
              <div
                key={idx}
                className={`flex items-center gap-2.5 p-1.5 rounded-xl border transition-colors ${
                  isCorrect
                    ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/5'
                    : 'border-transparent'
                }`}
              >
                <input
                  type="radio"
                  name="correctOption"
                  checked={isCorrect}
                  onChange={() => setCorrectOption(idx)}
                  aria-label={`กำหนดตัวเลือกที่ ${idx + 1} เป็นคำตอบที่ถูกต้อง`}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer shrink-0 ml-1"
                />
                <input
                  type="text"
                  required
                  placeholder={`ตัวเลือกที่ ${idx + 1}`}
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  className="w-full min-w-0 h-9 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(idx)}
                    aria-label={`ลบตัวเลือกที่ ${idx + 1}`}
                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                  >
                    <CloseIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          คลิกปุ่มวงกลมหน้าตัวเลือกเพื่อกำหนดเป็นคำตอบที่ถูกต้อง
        </p>
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
          คำอธิบายเฉลยละเอียด (ถ้ามี)
        </label>
        <textarea
          rows="3"
          placeholder="อธิบายเหตุผลของคำตอบข้อนี้..."
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors resize-y"
        />
      </div>

      <div className="space-y-2.5 pt-2">
        <label htmlFor="randomize" className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            id="randomize"
            checked={isRandomized}
            onChange={(e) => setIsRandomized(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-indigo-600 rounded cursor-pointer shrink-0"
          />
          <span className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
            สลับตำแหน่งตัวเลือก (Randomize Options) เมื่อผู้เข้าสอบทำข้อนี้
          </span>
        </label>

        <label htmlFor="activeStatus" className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            id="activeStatus"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-emerald-600 rounded cursor-pointer shrink-0"
          />
          <span className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
            เปิดใช้งานข้อสอบทันที (หากนำออกจะเก็บไว้ในสถานะฉบับร่าง)
          </span>
        </label>
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row gap-2.5">
        <button
          type="button"
          onClick={() => {
            handleResetForm()
            onCancelEdit()
          }}
          className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={saving || !selectedCat}
          className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
        >
          {saving ? 'กำลังบันทึก...' : editingQuestion ? 'บันทึกการแก้ไข' : 'บันทึกข้อสอบลงคลัง'}
        </button>
      </div>
    </form>
  )
}
