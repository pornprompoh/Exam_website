import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { generateExamQuestions } from '../../lib/aiService'

export default function AIExamGeneratorModal({ isOpen, onClose, categories, categoryId, currentUserId, onSuccess, onNotify }) {
  const [selectedCategory, setSelectedCategory] = useState(categoryId || categories?.[0]?.id || '')
  const [files, setFiles] = useState([])
  const [questionCount, setQuestionCount] = useState(10)
  const [promptHint, setPromptHint] = useState('')
  const [questions, setQuestions] = useState([])
  const [step, setStep] = useState('setup')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')

  if (!isOpen) return null

  const notify = (type, title, description) => onNotify?.(type, title, description)
  const selectedCategoryName = categories?.find((category) => category.id === selectedCategory)?.name || ''

  const handleGenerate = async (event) => {
    event.preventDefault()
    setLoading(true)
    try {
      const generated = await generateExamQuestions({
        files,
        questionCount,
        categoryName: selectedCategoryName,
        promptHint,
        onProgress: setProgress
      })
      setQuestions(generated)
      setStep('review')
    } catch (error) {
      notify('danger', 'สร้างข้อสอบไม่สำเร็จ', error.message)
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  const updateQuestion = (index, field, value) => {
    setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  }

  const updateOption = (questionIndex, optionIndex, value) => {
    setQuestions((current) => current.map((item, itemIndex) => {
      if (itemIndex !== questionIndex) return item
      const options = [...item.options]
      options[optionIndex] = value
      return { ...item, options }
    }))
  }

  const handleSave = async () => {
    if (!selectedCategory || questions.length === 0) return notify('warning', 'ข้อมูลไม่ครบ', 'กรุณาเลือกวิชาและต้องมีข้อสอบอย่างน้อย 1 ข้อ')
    if (questions.some((item) => !item.question_text.trim() || item.options.some((option) => !option.trim()))) {
      return notify('warning', 'ข้อมูลไม่ครบ', 'กรุณาตรวจสอบโจทย์และตัวเลือกให้ครบทุกข้อ')
    }
    setSaving(true)
    try {
      const payload = questions.map((item) => ({
        category_id: selectedCategory,
        question_text: item.question_text.trim(),
        options: item.options.map((option) => option.trim()),
        correct_option: Number(item.correct_option),
        explanation: item.explanation.trim() || null,
        is_options_randomized: true,
        image_url: null,
        explanation_image_url: null,
        is_active: true,
        created_by: currentUserId || null
      }))
      const { error } = await supabase.from('questions').insert(payload)
      if (error) throw error
      notify('success', 'นำเข้าสำเร็จ', `บันทึกข้อสอบ ${payload.length} ข้อเรียบร้อยแล้ว`)
      onSuccess?.()
      handleClose()
    } catch (error) {
      notify('danger', 'บันทึกไม่สำเร็จ', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setFiles([])
    setQuestions([])
    setPromptHint('')
    setStep('setup')
    setProgress('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[1000] overflow-hidden">
      <div onClick={handleClose} className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs" />
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-5xl bg-slate-900 border-l border-slate-800 shadow-2xl overflow-y-auto relative">
          <header className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md">
            <div>
              <h2 className="text-lg font-black text-white">✨ AI Exam Generator</h2>
              <p className="text-xs text-slate-400 mt-1">{step === 'setup' ? 'สร้างข้อสอบจากสไลด์หรือเอกสาร' : 'ตรวจสอบและแก้ไขก่อนบันทึก'}</p>
            </div>
            <button onClick={handleClose} className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 cursor-pointer">✕</button>
          </header>

          <div className="p-6 space-y-6">
            {step === 'setup' ? (
              <form onSubmit={handleGenerate} className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-slate-300">ไฟล์เอกสาร (PDF/TXT สูงสุด 10 ไฟล์, ไฟล์ละไม่เกิน 10 MB)</label>
                  <input type="file" accept=".pdf,.txt,application/pdf,text/plain" multiple required onChange={(event) => setFiles([...event.target.files])} className="mt-2 block w-full rounded-xl border border-dashed border-slate-700 bg-slate-950 p-4 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-white" />
                  {files.length > 0 && <p className="mt-2 text-xs text-indigo-300">เลือกแล้ว {files.length} ไฟล์: {files.map((file) => file.name).join(', ')}</p>}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-bold text-slate-300">หมวดหมู่วิชา
                    <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} required className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-white">
                      <option value="">เลือกหมวดหมู่</option>
                      {categories?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-300">จำนวนข้อสอบ (1-100)
                    <input type="number" min="1" max="100" value={questionCount} onChange={(event) => setQuestionCount(event.target.value)} required className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-white" />
                  </label>
                </div>
                <label className="block text-xs font-bold text-slate-300">Prompt Hint เพิ่มเติม (ไม่บังคับ)
                  <textarea value={promptHint} onChange={(event) => setPromptHint(event.target.value)} rows="4" placeholder="เช่น เน้นความเข้าใจเชิงวิเคราะห์ ระดับยาก..." className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-white placeholder-slate-600" />
                </label>
                {loading && <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm text-indigo-200">⏳ {progress || 'กำลังประมวลผล...'}</div>}
                <button type="submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 p-3 font-bold text-white disabled:opacity-50 cursor-pointer">{loading ? 'กำลังสร้างข้อสอบ...' : '✨ สร้างข้อสอบด้วย AI'}</button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-bold text-white">ตรวจทานแล้ว {questions.length} ข้อ <span className="text-xs font-normal text-slate-400">(แหล่งที่มาใช้ตรวจสอบเท่านั้น จะไม่ถูกบันทึก)</span></div>
                  <button onClick={() => setStep('setup')} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 cursor-pointer">← สร้างใหม่</button>
                </div>
                {questions.map((item, index) => (
                  <div key={`${index}-${item.source_topic}`} className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs font-black text-indigo-300">ข้อที่ {index + 1}</span>
                      <button onClick={() => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-xs text-red-400 hover:text-red-300 cursor-pointer">ลบข้อนี้</button>
                    </div>
                    <input value={item.question_text} onChange={(event) => updateQuestion(index, 'question_text', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-white" placeholder="โจทย์คำถาม" />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {item.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <input type="radio" name={`correct-${index}`} checked={Number(item.correct_option) === optionIndex} onChange={() => updateQuestion(index, 'correct_option', optionIndex)} className="accent-emerald-500" />
                          <input value={option} onChange={(event) => updateOption(index, optionIndex, event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-900 p-2 text-sm text-white" placeholder={`ตัวเลือก ${optionIndex + 1}`} />
                        </div>
                      ))}
                    </div>
                    <textarea value={item.explanation} onChange={(event) => updateQuestion(index, 'explanation', event.target.value)} rows="2" className="w-full rounded-lg border border-slate-800 bg-slate-900 p-2 text-sm text-white" placeholder="คำอธิบายเฉลย" />
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-xs text-amber-200">แหล่งที่มา: {item.source_topic || 'ไม่ระบุ'}</div>
                  </div>
                ))}
                <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                  <button onClick={handleClose} className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-slate-300 cursor-pointer">ยกเลิก</button>
                  <button onClick={handleSave} disabled={saving || questions.length === 0} className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50 cursor-pointer">{saving ? 'กำลังบันทึก...' : `ยืนยันนำเข้า ${questions.length} ข้อ`}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
