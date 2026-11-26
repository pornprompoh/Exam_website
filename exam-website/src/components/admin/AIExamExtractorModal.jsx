import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { getGeminiApiKey } from '../../lib/geminiApiKey'
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS, getGeminiModel } from '../../lib/geminiModels'
import {
  MAX_EXTRACTOR_FILES,
  MAX_EXTRACTOR_PDF_SIZE_MB,
  validateExtractorFiles
} from '../../lib/pdfExtractor'
import {
  inspectExtractionFiles,
  runVerbatimExamExtraction
} from '../../lib/aiExtractorService'
import {
  clearCategoryStagingItems,
  clearExtractionCheckpoint,
  deleteStagingItems,
  fetchCategoryStagingItems,
  publishStagingItems,
  updateStagingItem
} from '../../lib/stagingQuestionService'
import FileUploadDropzone from './ai/FileUploadDropzone'
import ExamPreviewTable from './ai/ExamPreviewTable'
import AIKeyRequiredModal from './AIKeyRequiredModal'
import ConfirmModal from '../common/ConfirmModal'

function formatModeLabel(mode) {
  if (mode === 'vision') return 'Vision (ภาพสแกน/รูปภาพ)'
  if (mode === 'mixed') return 'Mixed (Text + Vision)'
  return 'Text (ข้อความ PDF)'
}

export default function AIExamExtractorModal({
  isOpen,
  onClose,
  categories,
  categoryId,
  currentUserId,
  initialTab = 'extract',
  onSuccess,
  onNotify,
  onGoToSettings,
  onStagingCountChange
}) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [selectedCategory, setSelectedCategory] = useState(categoryId || categories?.[0]?.id || '')

  // Upload & Inspection state
  const [files, setFiles] = useState([])
  const [fileError, setFileError] = useState('')
  const [inspecting, setInspecting] = useState(false)
  const [fileProfile, setFileProfile] = useState(null)

  // Auto-First + Manual Override settings
  const [pagesPerBatchInput, setPagesPerBatchInput] = useState('')
  const [startPageInput, setStartPageInput] = useState('')
  const [endPageInput, setEndPageInput] = useState('')

  // Extraction run state
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState('')
  const [progress, setProgress] = useState(null)
  const [showDetailsPanel, setShowDetailsPanel] = useState(false)
  const [detailsSubTab, setDetailsSubTab] = useState('skipped_items')
  const abortControllerRef = useRef(null)

  // Staging Review & Publishing state
  const [stagingItems, setStagingItems] = useState([])
  const [loadingStaging, setLoadingStaging] = useState(false)
  const [stagingError, setStagingError] = useState('')
  const [selectedStagingIds, setSelectedStagingIds] = useState([])
  const [stagingSearch, setStagingSearch] = useState('')
  const [stagingFilter, setStagingFilter] = useState('all') // 'all' | 'ai_solved' | 'doc_solved'
  const [publishing, setPublishing] = useState(false)

  // Confirmation & Key modals
  const [showKeyRequired, setShowKeyRequired] = useState(false)
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    type: 'danger',
    title: '',
    description: '',
    confirmText: 'ยืนยัน',
    onConfirm: null
  })

  const notify = useCallback((type, title, description) => {
    onNotify?.(type, title, description)
  }, [onNotify])

  const selectedCategoryName = categories?.find((c) => c.id === selectedCategory)?.name || ''
  const currentModelValue = (() => {
    try {
      return getGeminiModel() || DEFAULT_GEMINI_MODEL
    } catch {
      return DEFAULT_GEMINI_MODEL
    }
  })()
  const currentModelLabel = GEMINI_MODELS.find((m) => m.value === currentModelValue)?.label || currentModelValue

  const loadStagingItems = useCallback(async (catId) => {
    if (!catId) {
      setStagingItems([])
      onStagingCountChange?.(0)
      return
    }
    setLoadingStaging(true)
    setStagingError('')
    try {
      const items = await fetchCategoryStagingItems(catId)
      setStagingItems(items)
      setSelectedStagingIds((prev) => prev.filter((id) => items.some((item) => item.id === id)))
      onStagingCountChange?.(items.length)
    } catch (error) {
      setStagingError(error.message)
    } finally {
      setLoadingStaging(false)
    }
  }, [onStagingCountChange])

  // Load staging items when modal opens or category changes (async inside Promise to avoid sync setState in effect)
  useEffect(() => {
    if (!isOpen || !selectedCategory) return undefined
    let active = true
    Promise.resolve().then(async () => {
      if (!active) return
      await loadStagingItems(selectedCategory)
    })
    return () => {
      active = false
    }
  }, [isOpen, selectedCategory, loadStagingItems])

  // Cleanup abort controller if unmounted
  useEffect(() => () => {
    abortControllerRef.current?.abort()
  }, [])

  const filteredStagingItems = useMemo(() => {
    const query = stagingSearch.trim().toLowerCase()
    return stagingItems.filter((item) => {
      if (stagingFilter === 'ai_solved' && !item.is_ai_solved) return false
      if (stagingFilter === 'doc_solved' && item.is_ai_solved) return false
      if (!query) return true
      return (
        (item.question_text || '').toLowerCase().includes(query) ||
        (item.source_file_name || '').toLowerCase().includes(query) ||
        String(item.source_question_number || '').toLowerCase().includes(query) ||
        (item.explanation || '').toLowerCase().includes(query)
      )
    })
  }, [stagingItems, stagingSearch, stagingFilter])

  const aiSolvedCount = useMemo(
    () => stagingItems.filter((item) => item.is_ai_solved).length,
    [stagingItems]
  )
  const docSolvedCount = stagingItems.length - aiSolvedCount

  if (!isOpen) return null

  const openConfirm = ({ type = 'danger', title, description, confirmText = 'ยืนยัน', onConfirm }) => {
    setConfirmState({ isOpen: true, type, title, description, confirmText, onConfirm })
  }

  const closeConfirm = () => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }))
  }

  const validateUploadedFiles = (selectedFiles) => {
    try {
      validateExtractorFiles(selectedFiles)
      return ''
    } catch (error) {
      return error.message
    }
  }

  const handleFilesChange = async (nextFiles, error) => {
    setFiles(nextFiles)
    setFileError(error)
    setFileProfile(null)
    setExtractionError('')
    setProgress(null)
    if (error || nextFiles.length === 0) return

    setInspecting(true)
    try {
      const profile = await inspectExtractionFiles(nextFiles, selectedCategory)
      setFileProfile(profile)
    } catch (inspectErr) {
      setFileError(inspectErr.message)
    } finally {
      setInspecting(false)
    }
  }

  const handleCategoryChange = async (newCatId) => {
    setSelectedCategory(newCatId)
    setSelectedStagingIds([])
    if (files.length > 0 && newCatId) {
      setInspecting(true)
      try {
        const profile = await inspectExtractionFiles(files, newCatId)
        setFileProfile(profile)
      } catch (inspectErr) {
        setFileError(inspectErr.message)
      } finally {
        setInspecting(false)
      }
    }
  }

  const handleResetCheckpoint = () => {
    if (!fileProfile?.fingerprint || !selectedCategory) return
    openConfirm({
      type: 'warning',
      title: 'ล้าง Checkpoint เพื่อเริ่มอ่านใหม่ตั้งแต่ต้น?',
      description: `ระบบจะลบประวัติหน้าที่อ่านถึงหน้า ${fileProfile.checkpoint?.last_completed_page || 0} ของไฟล์นี้ (ข้อสอบที่บันทึกเข้า Staging ไปแล้วจะยังอยู่และถูกตรวจกันซ้ำอัตโนมัติ)`,
      confirmText: '🔄 ล้าง Checkpoint',
      onConfirm: async () => {
        await clearExtractionCheckpoint(selectedCategory, fileProfile.fingerprint)
        setFileProfile((prev) => (prev ? { ...prev, checkpoint: null } : prev))
        setProgress(null)
        notify('info', 'ล้าง Checkpoint แล้ว', 'พร้อมเริ่มสกัดข้อสอบใหม่ตั้งแต่หน้าแรกครับ')
      }
    })
  }

  const handleStartExtraction = async ({ resumeFromCheckpoint = true } = {}) => {
    try {
      if (!getGeminiApiKey()) {
        setShowKeyRequired(true)
        return
      }
    } catch (error) {
      setFileError(error.message)
      setShowKeyRequired(true)
      return
    }

    if (!selectedCategory) {
      return notify('warning', 'ยังไม่ได้เลือกวิชา', 'กรุณาเลือกหมวดหมู่วิชาก่อนเริ่มสกัดข้อสอบครับ')
    }
    if (files.length === 0 || fileError) {
      return notify('warning', 'กรุณาเลือกไฟล์ที่ถูกต้อง', fileError || 'กรุณาอัปโหลดไฟล์ PDF หรือรูปภาพก่อนเริ่มสกัดครับ')
    }

    const parsedBatch = pagesPerBatchInput.trim() ? parseInt(pagesPerBatchInput, 10) : null
    if (parsedBatch !== null && (Number.isNaN(parsedBatch) || parsedBatch < 1 || parsedBatch > 30)) {
      return notify('warning', 'จำนวนหน้าต่อรอบไม่ถูกต้อง', 'กรุณาระบุจำนวนหน้าต่อรอบระหว่าง 1 ถึง 30 หน้า (หรือเว้นว่างเพื่อใช้ค่าอัตโนมัติ)')
    }

    const parsedStart = startPageInput.trim() ? parseInt(startPageInput, 10) : null
    const parsedEnd = endPageInput.trim() ? parseInt(endPageInput, 10) : null
    if (parsedStart !== null && (Number.isNaN(parsedStart) || parsedStart < 1)) {
      return notify('warning', 'หน้าเริ่มต้นไม่ถูกต้อง', 'กรุณาระบุเลขหน้าเริ่มต้นตั้งแต่ 1 ขึ้นไป')
    }
    if (parsedEnd !== null && parsedStart !== null && parsedEnd < parsedStart) {
      return notify('warning', 'ช่วงหน้าไม่ถูกต้อง', 'หน้าสิ้นสุดต้องมากกว่าหรือเท่ากับหน้าเริ่มต้นครับ')
    }

    setExtractionError('')
    setIsExtracting(true)
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const result = await runVerbatimExamExtraction({
        files,
        categoryId: selectedCategory,
        categoryName: selectedCategoryName,
        currentUserId,
        pagesPerBatchOverride: parsedBatch,
        startPage: parsedStart,
        endPage: parsedEnd,
        resumeFromCheckpoint,
        signal: controller.signal,
        onProgress: (nextProgress) => {
          setProgress(nextProgress)
        },
        onStagingUpdated: () => {
          loadStagingItems(selectedCategory)
        }
      })

      // Refresh staging list & checkpoint info after completion or pause
      await loadStagingItems(selectedCategory)
      if (files.length > 0) {
        const refreshedProfile = await inspectExtractionFiles(files, selectedCategory).catch(() => null)
        if (refreshedProfile) setFileProfile(refreshedProfile)
      }

      if (result.completed) {
        notify(
          'success',
          'สกัดข้อสอบเสร็จสมบูรณ์!',
          `บันทึกข้อสอบเข้า Staging แล้ว ${result.stats.savedToStaging} ข้อ (ข้ามซ้ำ ${result.stats.duplicateExactMatch} ข้อ, ข้ามรูปภาพ/ไม่ใช่ปรนัย ${result.stats.skippedImageQuestions + result.stats.skippedNonMcqQuestions} ข้อ)`
        )
      }
    } catch (error) {
      setExtractionError(error.message)
      await loadStagingItems(selectedCategory)
      if (files.length > 0) {
        const refreshedProfile = await inspectExtractionFiles(files, selectedCategory).catch(() => null)
        if (refreshedProfile) setFileProfile(refreshedProfile)
      }
    } finally {
      setIsExtracting(false)
      abortControllerRef.current = null
    }
  }

  const handlePauseExtraction = () => {
    abortControllerRef.current?.abort()
  }

  // Staging item CRUD handlers
  const handleSaveStagingQuestion = async (filteredIndex, updatedQuestion) => {
    const target = filteredStagingItems[filteredIndex]
    if (!target?.id) return
    try {
      const saved = await updateStagingItem(target.id, {
        ...updatedQuestion,
        // Once admin manually edits and saves, clear AI-solved warning if answer was reviewed
        is_ai_solved: updatedQuestion.is_ai_solved
      })
      setStagingItems((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))
    } catch (error) {
      notify('danger', 'บันทึกการแก้ไข Draft ไม่สำเร็จ', error.message)
    }
  }

  const handleRequestRemoveSingleStaging = (filteredIndex, item) => {
    const target = item || filteredStagingItems[filteredIndex]
    if (!target?.id) return
    openConfirm({
      type: 'danger',
      title: 'ยืนยันลบข้อสอบ Draft ข้อนี้?',
      description: `ข้อสอบข้อนี้จะถูกลบออกจากตาราง Staging ถาวรครับ`,
      confirmText: '🗑️ ลบข้อนี้',
      onConfirm: async () => {
        try {
          await deleteStagingItems([target.id])
          setStagingItems((prev) => {
            const next = prev.filter((row) => row.id !== target.id)
            onStagingCountChange?.(next.length)
            return next
          })
          setSelectedStagingIds((prev) => prev.filter((id) => id !== target.id))
        } catch (error) {
          notify('danger', 'ลบ Draft ไม่สำเร็จ', error.message)
        }
      }
    })
  }

  const handleToggleSelectStaging = (id) => {
    setSelectedStagingIds((prev) => (
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    ))
  }

  const allVisibleSelected =
    filteredStagingItems.length > 0 &&
    filteredStagingItems.every((item) => selectedStagingIds.includes(item.id))

  const handleToggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(filteredStagingItems.map((i) => i.id))
      setSelectedStagingIds((prev) => prev.filter((id) => !visibleSet.has(id)))
    } else {
      setSelectedStagingIds((prev) => [...new Set([...prev, ...filteredStagingItems.map((i) => i.id)])])
    }
  }

  const handleDeleteSelectedStaging = () => {
    if (selectedStagingIds.length === 0) return
    openConfirm({
      type: 'danger',
      title: `ยืนยันลบข้อสอบ Draft ที่เลือก ${selectedStagingIds.length} ข้อ?`,
      description: 'ข้อสอบที่เลือกทั้งหมดจะถูกลบออกจากตาราง Staging ทันทีครับ',
      confirmText: `🗑️ ลบ ${selectedStagingIds.length} ข้อ`,
      onConfirm: async () => {
        try {
          await deleteStagingItems(selectedStagingIds)
          const removedSet = new Set(selectedStagingIds)
          setStagingItems((prev) => {
            const next = prev.filter((row) => !removedSet.has(row.id))
            onStagingCountChange?.(next.length)
            return next
          })
          setSelectedStagingIds([])
          notify('success', 'ลบ Draft สำเร็จ', `ลบข้อสอบ Draft จำนวน ${removedSet.size} ข้อเรียบร้อยแล้ว`)
        } catch (error) {
          notify('danger', 'ลบ Draft ไม่สำเร็จ', error.message)
        }
      }
    })
  }

  const handleClearAllCategoryDrafts = () => {
    if (!selectedCategory || stagingItems.length === 0) return
    openConfirm({
      type: 'danger',
      title: `ล้าง Draft ทั้งหมดของวิชา "${selectedCategoryName}"?`,
      description: `จะลบข้อสอบ Draft ค้างอยู่ทั้งหมด ${stagingItems.length} ข้อ รวมถึง Checkpoint ของหมวดหมู่นี้ออกจากระบบถาวร (ไม่กระทบข้อสอบหลักที่เผยแพร่แล้ว)`,
      confirmText: `🧹 ล้าง Draft ทั้งหมด (${stagingItems.length} ข้อ)`,
      onConfirm: async () => {
        try {
          await clearCategoryStagingItems(selectedCategory, { clearCheckpoints: true })
          setStagingItems([])
          setSelectedStagingIds([])
          setFileProfile((prev) => (prev ? { ...prev, checkpoint: null } : prev))
          onStagingCountChange?.(0)
          notify('success', 'ล้าง Draft ทั้งหมดแล้ว', `เคลียร์ข้อสอบ Draft ของวิชา "${selectedCategoryName}" เรียบร้อยแล้ว`)
        } catch (error) {
          notify('danger', 'ล้าง Draft ไม่สำเร็จ', error.message)
        }
      }
    })
  }

  const executePublish = async (itemsToPublish) => {
    if (!selectedCategory || itemsToPublish.length === 0) return
    setPublishing(true)
    try {
      const result = await publishStagingItems({
        categoryId: selectedCategory,
        items: itemsToPublish,
        currentUserId
      })
      await loadStagingItems(selectedCategory)
      setSelectedStagingIds([])
      onSuccess?.()

      if (result.publishedCount === 0 && result.skippedDuplicatesCount > 0) {
        notify(
          'warning',
          'ไม่พบข้อสอบใหม่สำหรับเผยแพร่',
          `ข้อสอบทั้ง ${result.skippedDuplicatesCount} ข้อซ้ำกับคลังข้อสอบหลัก (Exact Match) จึงถูกคัดออกอัตโนมัติ`
        )
      } else {
        const dupText = result.skippedDuplicatesCount > 0
          ? ` (และคัดออกเพราะซ้ำกับคลังหลักอีก ${result.skippedDuplicatesCount} ข้อ)`
          : ''
        notify(
          'success',
          'เผยแพร่ข้อสอบสำเร็จ!',
          `ย้ายข้อสอบจำนวน ${result.publishedCount} ข้อเข้าสู่คลังข้อสอบหลักและลบออกจาก Staging แล้ว${dupText}`
        )
      }
    } catch (error) {
      notify('danger', 'เผยแพร่ข้อสอบไม่สำเร็จ', error.message)
    } finally {
      setPublishing(false)
    }
  }

  const handlePublishSelected = () => {
    const selectedItems = stagingItems.filter((item) => selectedStagingIds.includes(item.id))
    if (selectedItems.length === 0) return
    executePublish(selectedItems)
  }

  const handlePublishAll = () => {
    if (stagingItems.length === 0) return
    executePublish(stagingItems)
  }

  const handleSafeClose = () => {
    setShowKeyRequired(false)
    if (isExtracting) {
      openConfirm({
        type: 'warning',
        title: 'หยุดพักและปิดหน้าต่างใช่หรือไม่?',
        description: 'ข้อสอบทุกข้อที่สกัดได้ก่อนหน้านี้ถูกบันทึกลงตาราง Staging และ Checkpoint แล้ว คุณสามารถกลับมาอ่านต่อจากจุดเดิมได้ทุกเมื่อครับ',
        confirmText: '⏸️ หยุดพักและปิดหน้าต่าง',
        onConfirm: () => {
          abortControllerRef.current?.abort()
          onClose()
        }
      })
      return
    }
    onClose()
  }

  const stats = progress?.stats || fileProfile?.checkpoint?.stats || null
  const totalPages = stats?.totalPages || fileProfile?.totalPages || 0
  const completedPages = Math.min(
    totalPages,
    progress?.currentEndPage || stats?.processedPages || fileProfile?.checkpoint?.last_completed_page || 0
  )
  const progressPercent = totalPages > 0 ? Math.min(100, Math.round((completedPages / totalPages) * 100)) : 0
  const hasResumableCheckpoint =
    Boolean(fileProfile?.checkpoint) &&
    Number(fileProfile.checkpoint.last_completed_page || 0) > 0 &&
    Number(fileProfile.checkpoint.last_completed_page || 0) < Number(fileProfile.totalPages || 0)

  return (
    <div
      role="presentation"
      onClick={handleSafeClose}
      className="fixed inset-0 z-[1000] bg-black/65 backdrop-blur-xs flex justify-end"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-exam-extractor-title"
        onClick={(event) => event.stopPropagation()}
        className="h-full w-full max-w-5xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden relative animate-slideLeft"
      >
        {/* Header */}
        <header className="p-5 sm:p-6 border-b border-slate-800 sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-11 h-11 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/25 flex items-center justify-center text-xl shrink-0">
                📄
              </span>
              <div className="min-w-0">
                <h2 id="ai-exam-extractor-title" className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                  AI ดึงข้อสอบจากไฟล์ (Verbatim Extractor)
                </h2>
                <p className="text-xs text-slate-400 truncate">
                  สกัดข้อสอบปรนัย 4–5 ตัวเลือกตามต้นฉบับ รองรับ PDF 300+ หน้า (Text/สแกน) & รูปภาพ · เก็บพักใน Staging ก่อนเผยแพร่
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onGoToSettings}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] font-bold text-slate-300 hover:border-indigo-500/50 hover:text-white transition-colors cursor-pointer"
                title="เปลี่ยนโมเดลหรือ API Key"
              >
                <span>🤖</span>
                <span>{currentModelLabel}</span>
              </button>
              <button
                type="button"
                onClick={handleSafeClose}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 font-bold flex items-center justify-center cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-2xl border border-slate-800 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('extract')}
                className={`rounded-xl px-4 py-2 text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'extract'
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📤 สกัดข้อสอบจากไฟล์
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('staging')}
                className={`rounded-xl px-4 py-2 text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'staging'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>📝 ตรวจสอบ Draft ใน Staging</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-mono font-black ${
                  activeTab === 'staging'
                    ? 'bg-slate-950/20 text-slate-950'
                    : stagingItems.length > 0
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-slate-800 text-slate-400'
                }`}>
                  {stagingItems.length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-slate-400 shrink-0">หมวดหมู่:</span>
              <select
                value={selectedCategory}
                disabled={isExtracting}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="max-w-xs truncate rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white outline-none focus:border-sky-500 disabled:opacity-50 cursor-pointer"
              >
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    📖 {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-6">
          {activeTab === 'extract' ? (
            <div className="space-y-5">
              {/* Upload Dropzone */}
              <FileUploadDropzone
                files={files}
                onFilesChange={handleFilesChange}
                onRequireApiKey={() => setShowKeyRequired(true)}
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                maxFileSizeMb={MAX_EXTRACTOR_PDF_SIZE_MB}
                maxFiles={MAX_EXTRACTOR_FILES}
                label={`ไฟล์ข้อสอบต้นฉบับ (PDF ขนาดใหญ่ 300+ หน้า สูงสุด ${MAX_EXTRACTOR_PDF_SIZE_MB} MB หรือรูปภาพ JPG/PNG/WebP สูงสุด ${MAX_EXTRACTOR_FILES} รูป)`}
                helperText="รองรับทั้ง PDF ข้อความ, PDF ภาพสแกน และไฟล์ที่มีข้อความปนภาพสแกน · ประมวลผลทีละ Chunk เพื่อประหยัด RAM"
                disabled={isExtracting}
                validateFiles={validateUploadedFiles}
              />

              {fileError && (
                <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-300">
                  ⚠️ {fileError}
                </p>
              )}

              {inspecting && (
                <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 text-xs font-bold text-sky-300 flex items-center gap-2.5">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                  <span>กำลังวิเคราะห์โครงสร้างไฟล์และตรวจสอบ Checkpoint เดิม...</span>
                </div>
              )}

              {/* File Profile + Checkpoint Detection Banner */}
              {fileProfile && !inspecting && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs font-black text-white truncate">
                        📎 {fileProfile.sourceFileName}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span className="rounded-lg bg-slate-900 border border-slate-800 px-2 py-0.5 font-bold text-sky-300">
                          ทั้งหมด {fileProfile.totalPages} {fileProfile.isPdf ? 'หน้า' : 'รูป'}
                        </span>
                        <span className="rounded-lg bg-slate-900 border border-slate-800 px-2 py-0.5 font-bold text-indigo-300">
                          {formatModeLabel(fileProfile.dominantMode)}
                        </span>
                        <span className="text-slate-500">
                          {fileProfile.recommended.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {fileProfile.checkpoint && Number(fileProfile.checkpoint.last_completed_page || 0) > 0 && (
                    <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-black text-amber-300">
                          🔖 พบ Checkpoint เดิมของไฟล์นี้ในวิชา "{selectedCategoryName}"
                        </p>
                        <p className="text-xs text-amber-100/90 leading-relaxed">
                          {hasResumableCheckpoint
                            ? `อ่านสำเร็จไปแล้วถึงหน้า ${fileProfile.checkpoint.last_completed_page} / ${fileProfile.totalPages} หน้า · กดเริ่มระบบจะข้ามหน้าที่อ่านแล้วและเริ่มอ่านต่อจากหน้า ${fileProfile.checkpoint.last_completed_page + 1} ทันที`
                            : `ไฟล์นี้อ่านครบถึงหน้า ${fileProfile.checkpoint.last_completed_page} / ${fileProfile.totalPages} หน้าแล้ว หากต้องการสกัดใหม่ตั้งแต่ต้นให้กดล้าง Checkpoint`}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isExtracting}
                        onClick={handleResetCheckpoint}
                        className="shrink-0 rounded-xl border border-amber-400/40 bg-slate-950/70 hover:bg-slate-900 px-3.5 py-2 text-xs font-bold text-amber-300 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        🔄 ล้าง Checkpoint เพื่อเริ่มอ่านใหม่ตั้งแต่ต้น
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Settings: Auto-First + Manual Override + Optional Page Range */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
                    ⚙️ การตั้งค่ารอบการประมวลผล (Auto-First + Manual Override)
                  </h3>
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                    {pagesPerBatchInput.trim()
                      ? `กำหนดเอง: ${pagesPerBatchInput} หน้า/รอบ`
                      : `อัตโนมัติ: ${fileProfile?.recommended?.pagesPerBatch || 'ปรับตามไฟล์'} หน้า/รอบ + หน่วงเวลาอัตโนมัติ`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-400">
                      จำนวนหน้าต่อรอบ (Pages per batch)
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={30}
                        disabled={isExtracting}
                        value={pagesPerBatchInput}
                        onChange={(e) => setPagesPerBatchInput(e.target.value)}
                        placeholder={`อัตโนมัติ (${fileProfile?.recommended?.pagesPerBatch || 'Auto'})`}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-sky-500 disabled:opacity-50"
                      />
                      {pagesPerBatchInput && (
                        <button
                          type="button"
                          disabled={isExtracting}
                          onClick={() => setPagesPerBatchInput('')}
                          className="shrink-0 rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-2.5 text-[11px] font-bold text-slate-300 hover:text-white cursor-pointer"
                        >
                          Auto
                        </button>
                      )}
                    </div>
                  </label>

                  <label className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-400">
                      หน้าเริ่มต้น (ไม่บังคับ)
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={fileProfile?.totalPages || undefined}
                      disabled={isExtracting}
                      value={startPageInput}
                      onChange={(e) => setStartPageInput(e.target.value)}
                      placeholder="1 (เริ่มตั้งแต่ต้น)"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-sky-500 disabled:opacity-50"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-400">
                      หน้าสิ้นสุด (ไม่บังคับ)
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={fileProfile?.totalPages || undefined}
                      disabled={isExtracting}
                      value={endPageInput}
                      onChange={(e) => setEndPageInput(e.target.value)}
                      placeholder={fileProfile?.totalPages ? `${fileProfile.totalPages} (ถึงหน้าสุดท้าย)` : 'ถึงหน้าสุดท้าย'}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-sky-500 disabled:opacity-50"
                    />
                  </label>
                </div>

                <p className="text-[11px] leading-relaxed text-slate-500">
                  ระบบจะข้ามหน้าปก/คำนำ/สารบัญ/หน้าว่างอัตโนมัติ, ตัดข้อที่มีรูปภาพและข้อที่ไม่ใช่ปรนัย 4–5 ตัวเลือกออก, ตัดเลขข้อและคำนำหน้าตัวเลือกให้รองรับระบบสุ่มช้อยส์ 100%, ตรวจซ้ำแบบ Exact Match กับคลังเดิม + Staging และบันทึกลง Staging ทันทีหลังจบแต่ละ Chunk
                </p>
              </div>

              {/* Primary Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                {!isExtracting ? (
                  <button
                    type="button"
                    disabled={files.length === 0 || inspecting || !selectedCategory}
                    onClick={() => handleStartExtraction({ resumeFromCheckpoint: true })}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-40 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-sky-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>{hasResumableCheckpoint ? '▶️' : '🚀'}</span>
                    <span>
                      {hasResumableCheckpoint
                        ? `อ่านต่อจากหน้า ${fileProfile.checkpoint.last_completed_page + 1} / ${fileProfile.totalPages}`
                        : 'เริ่มสกัดข้อสอบเข้าสู่ Staging'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePauseExtraction}
                    className="flex-1 rounded-2xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 px-5 py-3.5 text-sm font-black text-amber-300 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>⏸️</span>
                    <span>หยุดพักชั่วคราว (บันทึก Checkpoint แล้วกลับมาต่อได้)</span>
                  </button>
                )}

                {stagingItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('staging')}
                    className="rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-3.5 text-xs font-black text-amber-300 transition-colors cursor-pointer shrink-0"
                  >
                    📝 เปิดตรวจ Draft ({stagingItems.length} ข้อ) →
                  </button>
                )}
              </div>

              {/* Real-Time Progress & Metrics Dashboard */}
              {(progress || stats) && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isExtracting ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent shrink-0" />
                      ) : (
                        <span className="text-base shrink-0">
                          {progress?.status === 'completed' ? '✅' : progress?.status === 'paused' ? '⏸️' : progress?.status === 'error' ? '⚠️' : '📊'}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white">
                          {progress?.currentStartPage > 0
                            ? `หน้า ${progress.currentStartPage}–${progress.currentEndPage} จากทั้งหมด ${totalPages} หน้า (${progressPercent}%)`
                            : `ความคืบหน้า: ${completedPages} / ${totalPages} หน้า (${progressPercent}%)`}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {progress?.statusMessage || 'ข้อมูลสรุปล่าสุดจาก Checkpoint'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {progress?.currentMode && (
                        <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-bold text-indigo-300">
                          โหมด: {progress.currentMode === 'vision' ? 'Vision' : progress.currentMode === 'mixed' ? 'Text + Vision' : 'Text'}
                        </span>
                      )}
                      {progress?.adaptiveDelayMs > 0 && isExtracting && (
                        <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-mono text-slate-400">
                          Pacing: {(progress.adaptiveDelayMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressPercent}
                    className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        progress?.status === 'error'
                          ? 'bg-red-500'
                          : progress?.status === 'paused'
                            ? 'bg-amber-500'
                            : 'bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {extractionError && (
                    <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs leading-relaxed text-red-200">
                      <p className="font-bold text-red-300 mb-1">⚠️ เกิดข้อผิดพลาดระหว่างประมวลผล (บันทึก Checkpoint ไว้แล้ว)</p>
                      <p>{extractionError}</p>
                    </div>
                  )}

                  {/* Metrics Grid */}
                  {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <p className="text-[11px] font-bold text-slate-400">หน้าที่ข้ามอัตโนมัติ</p>
                        <p className="mt-1 text-lg font-black font-mono text-slate-200">{stats.skippedFrontMatterPages || 0}</p>
                        <p className="text-[10px] text-slate-500">คำนำ/สารบัญ/หน้าว่าง</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                        <p className="text-[11px] font-bold text-slate-400">ดึงได้ทั้งหมด</p>
                        <p className="mt-1 text-lg font-black font-mono text-sky-300">{stats.extractedTotal || 0}</p>
                        <p className="text-[10px] text-slate-500">ปรนัย 4–5 ตัวเลือก</p>
                      </div>
                      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                        <p className="text-[11px] font-bold text-emerald-300">เข้า Staging แล้ว</p>
                        <p className="mt-1 text-lg font-black font-mono text-emerald-400">{stats.savedToStaging || 0}</p>
                        <p className="text-[10px] text-emerald-300/70">บันทึกปลอดภัยใน DB</p>
                      </div>
                      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                        <p className="text-[11px] font-bold text-amber-300">คัดออกเพราะซ้ำ</p>
                        <p className="mt-1 text-lg font-black font-mono text-amber-400">{stats.duplicateExactMatch || 0}</p>
                        <p className="text-[10px] text-amber-300/70">Exact Match</p>
                      </div>
                      <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3 col-span-2 sm:col-span-1">
                        <p className="text-[11px] font-bold text-rose-300">ข้อที่ข้าม</p>
                        <p className="mt-1 text-lg font-black font-mono text-rose-400">
                          {(stats.skippedImageQuestions || 0) + (stats.skippedNonMcqQuestions || 0)}
                        </p>
                        <p className="text-[10px] text-rose-300/70">
                          รูป {stats.skippedImageQuestions || 0} · อื่นๆ {stats.skippedNonMcqQuestions || 0}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Extra badges for mapped answer keys & partial recoveries */}
                  {stats && (stats.answerKeysMapped > 0 || stats.partialRecoveries > 0) && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {stats.answerKeysMapped > 0 && (
                        <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-300">
                          🔑 จับคู่เฉลยท้ายบท/ท้ายไฟล์สำเร็จ {stats.answerKeysMapped} ข้อ
                        </span>
                      )}
                      {stats.partialRecoveries > 0 && (
                        <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 font-bold text-sky-300">
                          🩹 กู้คืน Partial JSON สำเร็จ {stats.partialRecoveries} รอบ
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expandable Skipped / Duplicate Detail Report */}
                  {stats && (
                    <div className="border-t border-slate-800 pt-3">
                      <button
                        type="button"
                        onClick={() => setShowDetailsPanel((v) => !v)}
                        className="text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <span>{showDetailsPanel ? '▾' : '▸'}</span>
                        <span>
                          ดูรายละเอียดรายการที่ถูกคัดออก / ข้าม ({(stats.skippedItemsLog?.length || 0) + (stats.duplicateItemsLog?.length || 0) + (stats.skippedPagesLog?.length || 0)} รายการ)
                        </span>
                      </button>

                      {showDetailsPanel && (
                        <div className="mt-3 space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setDetailsSubTab('skipped_items')}
                              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer ${
                                detailsSubTab === 'skipped_items'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : 'bg-slate-900 text-slate-400 border border-slate-800'
                              }`}
                            >
                              ข้อที่ข้าม ({stats.skippedItemsLog?.length || 0})
                            </button>
                            <button
                              type="button"
                              onClick={() => setDetailsSubTab('duplicates')}
                              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer ${
                                detailsSubTab === 'duplicates'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-slate-900 text-slate-400 border border-slate-800'
                              }`}
                            >
                              คัดออกเพราะซ้ำ ({stats.duplicateItemsLog?.length || 0})
                            </button>
                            <button
                              type="button"
                              onClick={() => setDetailsSubTab('skipped_pages')}
                              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer ${
                                detailsSubTab === 'skipped_pages'
                                  ? 'bg-slate-700 text-white border border-slate-600'
                                  : 'bg-slate-900 text-slate-400 border border-slate-800'
                              }`}
                            >
                              หน้าที่ข้ามอัตโนมัติ ({stats.skippedPagesLog?.length || 0})
                            </button>
                          </div>

                          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2 text-xs">
                            {detailsSubTab === 'skipped_items' && (
                              (stats.skippedItemsLog || []).length === 0 ? (
                                <p className="text-slate-500">ไม่มีข้อสอบที่ถูกข้าม</p>
                              ) : (
                                stats.skippedItemsLog.map((entry, idx) => (
                                  <div key={idx} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 pb-1.5 last:border-0">
                                    <span className="font-bold text-rose-300">
                                      ข้อ #{entry.source_question_number} (หน้า {entry.source_page})
                                    </span>
                                    <span className="text-slate-300">
                                      {entry.reason === 'has_image' ? '🖼️ มีรูปภาพ' : '📋 ไม่ใช่ปรนัย 4–5 ตัวเลือก'} — {entry.detail}
                                    </span>
                                  </div>
                                ))
                              )
                            )}

                            {detailsSubTab === 'duplicates' && (
                              (stats.duplicateItemsLog || []).length === 0 ? (
                                <p className="text-slate-500">ไม่มีข้อสอบที่ถูกคัดออกเพราะซ้ำ</p>
                              ) : (
                                stats.duplicateItemsLog.map((entry, idx) => (
                                  <div key={idx} className="border-b border-slate-800/70 pb-1.5 last:border-0">
                                    <span className="font-bold text-amber-300 mr-2">
                                      ข้อ #{entry.source_question_number} (หน้า {entry.source_page}):
                                    </span>
                                    <span className="text-slate-300">{entry.question_preview}</span>
                                  </div>
                                ))
                              )
                            )}

                            {detailsSubTab === 'skipped_pages' && (
                              (stats.skippedPagesLog || []).length === 0 ? (
                                <p className="text-slate-500">ไม่มีหน้าที่ถูกข้ามอัตโนมัติ</p>
                              ) : (
                                stats.skippedPagesLog.map((entry, idx) => (
                                  <div key={idx} className="flex items-center justify-between gap-2 border-b border-slate-800/70 pb-1.5 last:border-0">
                                    <span className="font-bold text-slate-200">หน้า {entry.page}</span>
                                    <span className="text-slate-400">{entry.detail || entry.reason}</span>
                                  </div>
                                ))
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: STAGING DRAFT REVIEW & FLEXIBLE PUBLISHING */
            <div className="space-y-4">
              {stagingError && (
                <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-bold text-red-200">
                  ⚠️ {stagingError}
                </div>
              )}

              {/* Filter & Search Bar */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    type="search"
                    value={stagingSearch}
                    onChange={(e) => setStagingSearch(e.target.value)}
                    placeholder="ค้นหาโจทย์, เลขข้อต้นฉบับ, ชื่อไฟล์ หรือคำอธิบายใน Draft..."
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-sky-500"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setStagingFilter('all')}
                      className={`rounded-xl px-3 py-2 text-xs font-bold cursor-pointer border ${
                        stagingFilter === 'all'
                          ? 'bg-sky-600 text-white border-sky-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      ทั้งหมด ({stagingItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStagingFilter('ai_solved')}
                      className={`rounded-xl px-3 py-2 text-xs font-bold cursor-pointer border ${
                        stagingFilter === 'ai_solved'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      🤖 AI เฉลย ({aiSolvedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStagingFilter('doc_solved')}
                      className={`rounded-xl px-3 py-2 text-xs font-bold cursor-pointer border ${
                        stagingFilter === 'doc_solved'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      📄 เฉลยจากเอกสาร ({docSolvedCount})
                    </button>
                  </div>
                </div>

                {/* Flexible Publishing & Bulk Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-800">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      disabled={filteredStagingItems.length === 0}
                      onChange={handleToggleSelectAllVisible}
                      className="h-4 w-4 accent-sky-500 rounded cursor-pointer"
                    />
                    <span>เลือกทั้งหมดที่แสดง ({selectedStagingIds.length}/{stagingItems.length})</span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={selectedStagingIds.length === 0 || publishing}
                      onClick={handleDeleteSelectedStaging}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 px-3 py-2 text-xs font-bold text-red-300 transition-colors cursor-pointer"
                    >
                      🗑️ ลบที่เลือก ({selectedStagingIds.length})
                    </button>

                    <button
                      type="button"
                      disabled={stagingItems.length === 0 || publishing}
                      onClick={handleClearAllCategoryDrafts}
                      className="rounded-xl border border-rose-500/30 bg-rose-950/60 hover:bg-rose-900/60 disabled:opacity-40 px-3 py-2 text-xs font-bold text-rose-300 transition-colors cursor-pointer"
                    >
                      🧹 ล้าง Draft ทั้งหมดของหมวดหมู่นี้
                    </button>

                    <button
                      type="button"
                      disabled={selectedStagingIds.length === 0 || publishing}
                      onClick={handlePublishSelected}
                      className="rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 px-4 py-2 text-xs font-black text-white transition-colors cursor-pointer"
                    >
                      {publishing ? '⏳ กำลังเผยแพร่...' : `🚀 เผยแพร่ที่เลือก (${selectedStagingIds.length})`}
                    </button>

                    <button
                      type="button"
                      disabled={stagingItems.length === 0 || publishing}
                      onClick={handlePublishAll}
                      className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 px-4 py-2 text-xs font-black text-white shadow transition-all cursor-pointer"
                    >
                      {publishing ? '⏳ กำลังเผยแพร่...' : `✨ เผยแพร่ทั้งหมด (${stagingItems.length} ข้อ)`}
                    </button>
                  </div>
                </div>
              </div>

              {/* Staging Preview List */}
              {loadingStaging ? (
                <div className="py-12 text-center text-xs font-bold text-slate-400">
                  ⏳ กำลังโหลดข้อสอบ Draft จากตาราง Staging...
                </div>
              ) : filteredStagingItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 p-10 text-center space-y-2">
                  <p className="text-2xl">📭</p>
                  <p className="text-sm font-black text-white">
                    {stagingItems.length === 0
                      ? `ยังไม่มีข้อสอบ Draft ค้างอยู่ในวิชา "${selectedCategoryName}"`
                      : 'ไม่พบข้อสอบ Draft ที่ตรงกับคำค้นหาหรือตัวกรอง'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {stagingItems.length === 0
                      ? 'สลับไปที่แท็บ "สกัดข้อสอบจากไฟล์" เพื่ออัปโหลด PDF หรือรูปภาพข้อสอบได้เลยครับ'
                      : 'ลองเปลี่ยนตัวกรองหรือล้างคำค้นหาดูครับ'}
                  </p>
                </div>
              ) : (
                <ExamPreviewTable
                  questions={filteredStagingItems}
                  onSaveQuestion={handleSaveStagingQuestion}
                  onRemoveQuestion={handleRequestRemoveSingleStaging}
                  selectable={true}
                  selectedIds={selectedStagingIds}
                  onToggleSelect={handleToggleSelectStaging}
                  showExtractionMeta={true}
                  useExternalRemoveConfirm={true}
                />
              )}
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

      <div className="relative z-[1100]">
        <ConfirmModal
          isOpen={confirmState.isOpen}
          type={confirmState.type}
          theme="dark"
          title={confirmState.title}
          description={confirmState.description}
          confirmText={confirmState.confirmText}
          cancelText="← ยกเลิก"
          onClose={closeConfirm}
          onConfirm={() => confirmState.onConfirm?.()}
        />
      </div>
    </div>
  )
}
