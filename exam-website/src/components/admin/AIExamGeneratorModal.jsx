import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { generateExamQuestions } from '../../lib/aiService'
import { getGeminiApiKey } from '../../lib/geminiApiKey'
import FileUploadDropzone from './ai/FileUploadDropzone'
import GeneratorSettings from './ai/GeneratorSettings'
import ExamPreviewTable from './ai/ExamPreviewTable'
import AIKeyRequiredModal from './AIKeyRequiredModal'

const promptPresets = [
  'หลีกเลี่ยงข้อถูกทุกข้อ/ผิดทุกข้อ',
  'สร้างตัวลวงที่ใกล้เคียงความจริง',
  'เน้นโจทย์แนวสถานการณ์สมมติ',
  'เน้นจุดสำคัญที่น่าจะออกสอบบ่อย',
  'มีเฉลยอธิบายละเอียดทุกตัวเลือก'
]

export default function AIExamGeneratorModal({ isOpen, onClose, categories, categoryId, currentUserId, onSuccess, onNotify, onGoToSettings }) {
  const [selectedCategory, setSelectedCategory] = useState(categoryId || categories?.[0]?.id || '')
  const [files, setFiles] = useState([])
  const [questionCount, setQuestionCount] = useState(10)
  const [promptHint, setPromptHint] = useState('')
  const [difficulty, setDifficulty] = useState('balanced')
  const [language, setLanguage] = useState('th_tech')
  const [distributionMode, setDistributionMode] = useState('importance')
  const [questions, setQuestions] = useState([])
  const [step, setStep] = useState('setup')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')
  const [fileError, setFileError] = useState('')
  const [showKeyRequired, setShowKeyRequired] = useState(false)

  if (!isOpen) return null

  const notify = (type, title, description) => onNotify?.(type, title, description)
  const selectedCategoryName = categories?.find((category) => category.id === selectedCategory)?.name || ''

  const handleFilesChange = (nextFiles, error) => {
    setFiles(nextFiles)
    setFileError(error)
    if (error || nextFiles.length > 0) setShowKeyRequired(false)
  }

  const requireApiKey = () => {
    setShowKeyRequired(true)
  }

  const handleGenerate = async (event) => {
    event.preventDefault()
    try {
      if (!getGeminiApiKey()) {
        requireApiKey()
        return
      }
    } catch (error) {
      setFileError(error.message)
      requireApiKey()
      return
    }
    if (fileError) return notify('warning', 'ไฟล์ไม่ถูกต้อง', fileError)
    setLoading(true)
    try {
      const generated = await generateExamQuestions({ files, questionCount, categoryName: selectedCategoryName, promptHint, difficulty, language, distributionMode, onProgress: setProgress })
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
    if (questions.some((item) => !item.question_text.trim() || item.options.some((option) => !option.trim()))) return notify('warning', 'ข้อมูลไม่ครบ', 'กรุณาตรวจสอบโจทย์และตัวเลือกให้ครบทุกข้อ')
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
    setDifficulty('balanced')
    setLanguage('th_tech')
    setDistributionMode('importance')
    setStep('setup')
    setProgress('')
    setFileError('')
    setShowKeyRequired(false)
    onClose()
  }

  return (
    <div
      role="presentation"
      onClick={handleClose}
      className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-xs flex justify-end"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-exam-generator-title"
        onClick={(event) => event.stopPropagation()}
        className="h-full w-full max-w-4xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col overflow-y-auto relative animate-slideLeft"
      >
          <header className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 z-10 bg-slate-900/95 backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-lg shrink-0">✨</span>
              <div className="min-w-0">
                <h2 id="ai-exam-generator-title" className="text-base font-black text-white uppercase tracking-wider truncate">AI Exam Generator</h2>
                <p className="text-xs text-slate-400 mt-1">{step === 'setup' ? 'สร้างข้อสอบจากสไลด์หรือเอกสาร' : 'ตรวจสอบและแก้ไขก่อนบันทึก'}</p>
              </div>
            </div>
            <button type="button" onClick={handleClose} className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 cursor-pointer shrink-0">✕</button>
          </header>
          <div className="p-6 space-y-6 flex-1">
            {step === 'setup' ? (
              <form onSubmit={handleGenerate} className="space-y-5">
                <FileUploadDropzone files={files} onFilesChange={handleFilesChange} onRequireApiKey={requireApiKey} />
                {fileError && <p className="text-xs font-bold text-red-400">{fileError}</p>}
                <GeneratorSettings
                  categories={categories}
                  selectedCategory={selectedCategory}
                  questionCount={questionCount}
                  difficulty={difficulty}
                  language={language}
                  distributionMode={distributionMode}
                  filesLength={files.length}
                  promptHint={promptHint}
                  promptPresets={promptPresets}
                  onCategoryChange={setSelectedCategory}
                  onQuestionCountChange={setQuestionCount}
                  onDifficultyChange={setDifficulty}
                  onLanguageChange={setLanguage}
                  onDistributionChange={setDistributionMode}
                  onPromptHintChange={setPromptHint}
                />
                {loading && <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm text-indigo-200">⏳ {progress || 'กำลังประมวลผล...'}</div>}
                <button type="submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 p-3 font-bold text-white disabled:opacity-50 cursor-pointer">{loading ? 'กำลังสร้างข้อสอบ...' : '✨ สร้างข้อสอบด้วย AI'}</button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm font-bold text-white">ตรวจทานแล้ว {questions.length} ข้อ <span className="text-xs font-normal text-slate-400">(แหล่งที่มาใช้ตรวจสอบเท่านั้น จะไม่ถูกบันทึก)</span></div><button type="button" onClick={() => setStep('setup')} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 cursor-pointer">← สร้างใหม่</button></div>
                <ExamPreviewTable questions={questions} onChangeQuestion={updateQuestion} onChangeOption={updateOption} onRemoveQuestion={(index) => setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
                <div className="flex justify-end gap-3 border-t border-slate-800 pt-4"><button type="button" onClick={handleClose} className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-slate-300 cursor-pointer">ยกเลิก</button><button type="button" onClick={handleSave} disabled={saving || questions.length === 0} className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50 cursor-pointer">{saving ? 'กำลังบันทึก...' : `ยืนยันนำเข้า ${questions.length} ข้อ`}</button></div>
              </div>
            )}
          </div>
      </section>
      {showKeyRequired && (
        <AIKeyRequiredModal
          onClose={() => setShowKeyRequired(false)}
          onGoToSettings={onGoToSettings}
        />
      )}
    </div>
  )
}
