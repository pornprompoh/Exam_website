import { useState } from 'react'
import { getGeminiApiKey } from '../../../../shared/lib/geminiApiKey'
import AdminModalShell from '../../../../shared/components/AdminModalShell'
import { AlertTriangleIcon, SparklesIcon } from '../../../../shared/components/AdminIcons'
import FileUploadDropzone from '../../shared/components/FileUploadDropzone'
import ExamPreviewTable from '../../shared/components/ExamPreviewTable'
import AIKeyRequiredModal from '../../shared/components/AIKeyRequiredModal'
import { GENERATOR_PROMPT_PRESETS } from '../prompts/examGeneratorPrompt'
import { generateExamQuestions, saveGeneratedQuestions } from '../services/examGeneratorService'
import GeneratorSettings from './GeneratorSettings'

export default function AIExamGeneratorModal({
  isOpen,
  onClose,
  categories,
  categoryId,
  currentUserId,
  onSuccess,
  onNotify,
  onGoToSettings
}) {
  const [selectedCategory, setSelectedCategory] = useState(categoryId || categories?.[0]?.id || '')
  const [files, setFiles] = useState([])
  const [questionCount, setQuestionCount] = useState(10)
  const [promptHint, setPromptHint] = useState('')
  const [difficulty, setDifficulty] = useState('balanced')
  const [language, setLanguage] = useState('th_tech')
  const [distributionMode, setDistributionMode] = useState('importance')
  const [questions, setQuestions] = useState([])
  const [step, setStep] = useState('setup')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState({
    step: 1,
    message: 'กำลังอ่านและสกัดข้อความจากเอกสาร (PDF/TXT)...'
  })
  const [generationError, setGenerationError] = useState('')
  const [saving, setSaving] = useState(false)
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
    setGenerationError('')
    setGenerationProgress({ step: 1, message: 'กำลังอ่านและสกัดข้อความจากเอกสาร (PDF/TXT)...' })
    setIsGenerating(true)
    try {
      const generated = await generateExamQuestions({
        files,
        questionCount,
        categoryName: selectedCategoryName,
        categoryId: selectedCategory,
        promptHint,
        difficulty,
        language,
        distributionMode,
        onProgress: (progressStep, message) => setGenerationProgress({ step: progressStep, message })
      })
      if (generated.length === 0) {
        throw new Error('ข้อสอบที่สร้างซ้ำกับคลังเดิมหรือซ้ำกันเอง จึงถูกตัดออกทั้งหมด กรุณาปรับคำแนะนำหรือใช้เอกสารอื่นแล้วลองใหม่')
      }
      setQuestions(generated)
      setStep('review')
    } catch (error) {
      setGenerationError(error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const saveQuestion = (index, updatedQuestion) => {
    setQuestions((current) => current.map((item, itemIndex) => (itemIndex === index ? updatedQuestion : item)))
  }

  const removeQuestion = (index) => {
    setQuestions((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const handleSave = async () => {
    if (!selectedCategory || questions.length === 0) {
      return notify('warning', 'ข้อมูลไม่ครบ', 'กรุณาเลือกวิชาและต้องมีข้อสอบอย่างน้อย 1 ข้อ')
    }
    if (questions.some((item) => !item.question_text.trim() || item.options.some((option) => !option.trim()))) {
      return notify('warning', 'ข้อมูลไม่ครบ', 'กรุณาตรวจสอบโจทย์และตัวเลือกให้ครบทุกข้อ')
    }
    setSaving(true)
    try {
      const insertedCount = await saveGeneratedQuestions({
        categoryId: selectedCategory,
        questions,
        currentUserId
      })
      notify('success', 'นำเข้าสำเร็จ', `บันทึกข้อสอบ ${insertedCount} ข้อเรียบร้อยแล้ว`)
      onSuccess?.()
      handleClose()
    } catch (error) {
      notify('danger', 'บันทึกไม่สำเร็จ', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setShowKeyRequired(false)
    if (isGenerating) {
      onClose()
      return
    }
    setFiles([])
    setQuestions([])
    setPromptHint('')
    setDifficulty('balanced')
    setLanguage('th_tech')
    setDistributionMode('importance')
    setStep('setup')
    setGenerationProgress({ step: 1, message: 'กำลังอ่านและสกัดข้อความจากเอกสาร (PDF/TXT)...' })
    setGenerationError('')
    setFileError('')
    onClose()
  }

  const footer =
    step === 'setup' ? (
      <div className="flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={handleClose}
          className="h-10 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-colors cursor-pointer"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          form="ai-generator-form"
          disabled={isGenerating}
          className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold text-white transition-colors cursor-pointer inline-flex items-center gap-2"
        >
          <SparklesIcon className="w-4 h-4" />
          <span>{isGenerating ? 'กำลังสร้างข้อสอบ...' : 'สร้างข้อสอบด้วย AI'}</span>
        </button>
      </div>
    ) : (
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={() => setStep('setup')}
          className="h-10 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
        >
          ← สร้างใหม่
        </button>
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="h-10 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || questions.length === 0}
            className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-5 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            {saving ? 'กำลังบันทึก...' : `ยืนยันนำเข้า ${questions.length} ข้อ`}
          </button>
        </div>
      </div>
    )

  return (
    <>
      <AdminModalShell
        isOpen={isOpen}
        onClose={handleClose}
        title="AI สร้างข้อสอบจากเอกสาร"
        subtitle={step === 'setup' ? 'สรุปเนื้อหาจากเอกสาร PDF/TXT และสร้างข้อสอบใหม่อัตโนมัติ' : 'ตรวจสอบและแก้ไขข้อสอบก่อนนำเข้าคลัง'}
        titleId="ai-exam-generator-title"
        icon={<SparklesIcon className="w-4 h-4" />}
        footer={!isGenerating && !generationError ? footer : null}
        maxWidth="max-w-4xl"
      >
        {step === 'setup' ? (
          <form id="ai-generator-form" onSubmit={handleGenerate} className="space-y-5">
            <FileUploadDropzone files={files} onFilesChange={handleFilesChange} onRequireApiKey={requireApiKey} />
            {fileError && (
              <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {fileError}
              </p>
            )}
            <GeneratorSettings
              categories={categories}
              selectedCategory={selectedCategory}
              questionCount={questionCount}
              difficulty={difficulty}
              language={language}
              distributionMode={distributionMode}
              filesLength={files.length}
              promptHint={promptHint}
              promptPresets={GENERATOR_PROMPT_PRESETS}
              onCategoryChange={setSelectedCategory}
              onQuestionCountChange={setQuestionCount}
              onDifficultyChange={setDifficulty}
              onLanguageChange={setLanguage}
              onDistributionChange={setDistributionMode}
              onPromptHintChange={setPromptHint}
            />
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                ตรวจทานแล้ว {questions.length} ข้อ{' '}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  (ข้อมูลแหล่งที่มาใช้ตรวจสอบเท่านั้น จะไม่ถูกบันทึก)
                </span>
              </div>
            </div>
            <ExamPreviewTable
              questions={questions}
              onSaveQuestion={saveQuestion}
              onRemoveQuestion={removeQuestion}
            />
          </div>
        )}

        {isGenerating && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/90 dark:bg-slate-950/90 p-6 text-center backdrop-blur-sm"
          >
            <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <SparklesIcon className="w-6 h-6" />
              <span className="absolute inset-0 animate-spin rounded-2xl border-2 border-indigo-500/50 border-t-transparent" />
            </div>
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 tabular-nums">
              ขั้นตอน {generationProgress.step} / 4
            </p>
            <h3 className="mt-2 max-w-md text-base font-bold leading-relaxed text-slate-900 dark:text-white">
              {generationProgress.message}
            </h3>
            <div
              role="progressbar"
              aria-label="ความคืบหน้าการสร้างข้อสอบ"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={[25, 50, 85, 100][generationProgress.step - 1]}
              className="mt-5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
            >
              <div
                className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400 transition-all duration-500"
                style={{ width: `${[25, 50, 85, 100][generationProgress.step - 1]}%` }}
              />
            </div>
            <p className="mt-5 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              ใช้เวลาประมาณ 15–30 วินาที สามารถคลิกพื้นหลังเพื่อปิดหน้าต่างชั่วคราวได้ ระบบจะทำงานต่อเนื่องอัตโนมัติ
            </p>
          </div>
        )}

        {generationError && !isGenerating && (
          <div
            role="alert"
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/92 dark:bg-slate-950/92 p-6 text-center backdrop-blur-sm"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangleIcon className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">สร้างข้อสอบไม่สำเร็จ</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-rose-700 dark:text-rose-300">{generationError}</p>
            <button
              type="button"
              onClick={() => setGenerationError('')}
              className="mt-5 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-5 text-sm font-semibold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
            >
              กลับไปตรวจสอบและลองอีกครั้ง
            </button>
          </div>
        )}
      </AdminModalShell>

      {showKeyRequired && (
        <AIKeyRequiredModal
          onClose={() => setShowKeyRequired(false)}
          onGoToSettings={onGoToSettings}
        />
      )}
    </>
  )
}
