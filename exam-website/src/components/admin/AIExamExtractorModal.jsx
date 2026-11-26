import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { getGeminiApiKey } from '../../lib/geminiApiKey'
import {
  DEFAULT_STANDARD_MODEL,
  GEMINI_STANDARD_MODELS,
  getGeminiModelLabel,
  resolveHybridModelPair
} from '../../lib/geminiModels'
import {
  MAX_EXTRACTOR_FILES,
  MAX_EXTRACTOR_PDF_SIZE_MB,
  validateExtractorFiles
} from '../../lib/pdfExtractor'
import {
  inspectExtractionFiles,
  runDeferredAnswerPipeline,
  runVerbatimExamExtraction
} from '../../lib/aiExtractorService'
import {
  clearCategoryStagingItems,
  clearExtractionCheckpoint,
  deleteStagingItems,
  fetchCategoryStagingSnapshot,
  publishStagingItems,
  resolveItemAnswerStatus,
  resolveStagingOverrideDecision,
  updateStagingItem
} from '../../lib/stagingQuestionService'
import FileUploadDropzone from './ai/FileUploadDropzone'
import ExamPreviewTable from './ai/ExamPreviewTable'
import OverrideReasonModal from './ai/OverrideReasonModal'
import AIKeyRequiredModal from './AIKeyRequiredModal'
import ConfirmModal from '../common/ConfirmModal'

function formatModeLabel(mode) {
  if (mode === 'vision') return 'Vision (ภาพสแกน/รูปภาพ)'
  if (mode === 'mixed') return 'Mixed (Text + Vision)'
  return 'Text (ข้อความ PDF)'
}

const PIPELINE_STEPS = [
  { pass: 1, label: 'ขั้น 1/3', title: 'สกัดโจทย์และเฉลย (Flash Lite)' },
  { pass: 2, label: 'ขั้น 2/3', title: 'จับคู่เฉลยหนังสือทั้งไฟล์' },
  { pass: 3, label: 'ขั้น 3/3', title: 'ตรวจเฉลยและฟันธง (Hybrid)' }
]

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

  // Auto-First + Manual Override + Two-Stage Hybrid Model Settings
  const [pagesPerBatchInput, setPagesPerBatchInput] = useState('')
  const [startPageInput, setStartPageInput] = useState('')
  const [endPageInput, setEndPageInput] = useState('')
  const [modelRoutingMode, setModelRoutingMode] = useState('hybrid') // 'hybrid' | 'lite_only'
  const [selectedDeepModel, setSelectedDeepModel] = useState(() => {
    const pair = resolveHybridModelPair()
    return pair.deepModel || DEFAULT_STANDARD_MODEL
  })

  // Extraction & 3-Pass run state
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState('')
  const [progress, setProgress] = useState(null)
  const [showDetailsPanel, setShowDetailsPanel] = useState(false)
  const [detailsSubTab, setDetailsSubTab] = useState('skipped_items')
  const abortControllerRef = useRef(null)

  // Staging Review & Real-Time Exact Counter Sync state
  const [stagingItems, setStagingItems] = useState([])
  const [exactStagingCount, setExactStagingCount] = useState(0)
  const [loadingStaging, setLoadingStaging] = useState(false)
  const [stagingError, setStagingError] = useState('')
  const [selectedStagingIds, setSelectedStagingIds] = useState([])
  const [stagingSearch, setStagingSearch] = useState('')
  // 'all' | 'ai_overridden' | 'ai_solved' | 'book_verified' | 'pending_answer'
  const [stagingFilter, setStagingFilter] = useState('all')
  const [publishing, setPublishing] = useState(false)
  const [inspectedOverrideItem, setInspectedOverrideItem] = useState(null)

  // Monotonic sequence token prevents stale overlapping async fetches from corrupting live Draft counts
  const loadSeqRef = useRef(0)

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
  const { liteModel, deepModel } = resolveHybridModelPair(selectedDeepModel)

  const syncStagingSnapshot = useCallback(async (catId, { silent = false } = {}) => {
    const seq = ++loadSeqRef.current
    if (!catId) {
      setStagingItems([])
      setExactStagingCount(0)
      if (!categoryId) onStagingCountChange?.(0)
      return { items: [], exactCount: 0 }
    }

    if (!silent) setLoadingStaging(true)
    setStagingError('')
    try {
      const snapshot = await fetchCategoryStagingSnapshot(catId)
      if (seq !== loadSeqRef.current) return snapshot
      setStagingItems(snapshot.items)
      setExactStagingCount(snapshot.exactCount)
      setSelectedStagingIds((prev) => prev.filter((id) => snapshot.items.some((item) => item.id === id)))
      if (catId === categoryId) {
        onStagingCountChange?.(snapshot.exactCount)
      }
      return snapshot
    } catch (error) {
      if (seq === loadSeqRef.current) setStagingError(error.message)
      return { items: [], exactCount: 0 }
    } finally {
      if (seq === loadSeqRef.current && !silent) setLoadingStaging(false)
    }
  }, [categoryId, onStagingCountChange])

  // Real-time incremental sync callback called after EVERY Pass 1 chunk, Pass 2 match, and Pass 3 batch
  const handleLiveStagingUpdated = useCallback(async (payload = {}) => {
    if (typeof payload?.exactCount === 'number') {
      setExactStagingCount(payload.exactCount)
      if (selectedCategory === categoryId) {
        onStagingCountChange?.(payload.exactCount)
      }
    }
    if (Array.isArray(payload?.insertedRows) && payload.insertedRows.length > 0) {
      setStagingItems((prev) => {
        const existingIds = new Set(prev.map((row) => row.id))
        const fresh = payload.insertedRows.filter((row) => row?.id && !existingIds.has(row.id))
        if (fresh.length === 0) return prev
        return [...prev, ...fresh]
      })
    }
    await syncStagingSnapshot(selectedCategory, { silent: true })
  }, [selectedCategory, categoryId, onStagingCountChange, syncStagingSnapshot])

  useEffect(() => {
    if (!isOpen || !selectedCategory) return undefined
    let active = true
    Promise.resolve().then(async () => {
      if (!active) return
      await syncStagingSnapshot(selectedCategory)
    })
    return () => {
      active = false
    }
  }, [isOpen, selectedCategory, syncStagingSnapshot])

  useEffect(() => () => {
    abortControllerRef.current?.abort()
  }, [])

  const statusCounts = useMemo(() => {
    const counts = {
      book_verified: 0,
      ai_overridden: 0,
      ai_solved: 0,
      pending_answer: 0
    }
    for (const item of stagingItems) {
      const st = resolveItemAnswerStatus(item)
      counts[st] = (counts[st] || 0) + 1
    }
    return counts
  }, [stagingItems])

  const filteredStagingItems = useMemo(() => {
    const query = stagingSearch.trim().toLowerCase()
    return stagingItems.filter((item) => {
      const status = resolveItemAnswerStatus(item)
      if (stagingFilter !== 'all' && status !== stagingFilter) return false
      if (!query) return true
      return (
        (item.question_text || '').toLowerCase().includes(query) ||
        (item.source_file_name || '').toLowerCase().includes(query) ||
        (item.source_section || '').toLowerCase().includes(query) ||
        String(item.source_question_number || '').toLowerCase().includes(query) ||
        (item.explanation || '').toLowerCase().includes(query) ||
        (item.override_reason || '').toLowerCase().includes(query)
      )
    })
  }, [stagingItems, stagingSearch, stagingFilter])

  if (!isOpen) return null

  const displayedDraftCount = Math.max(exactStagingCount, stagingItems.length)

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
      description: `ระบบจะลบประวัติหน้าที่อ่านถึงหน้า ${fileProfile.checkpoint?.last_completed_page || 0} และ Answer Key Pool ของไฟล์นี้ (ข้อสอบที่บันทึกเข้า Staging ไปแล้วจะยังอยู่และถูกตรวจกันซ้ำอัตโนมัติ)`,
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
        modelRoutingMode,
        deepModelOverride: selectedDeepModel,
        resumeFromCheckpoint,
        signal: controller.signal,
        onProgress: (nextProgress) => {
          setProgress(nextProgress)
        },
        onStagingUpdated: handleLiveStagingUpdated
      })

      await syncStagingSnapshot(selectedCategory)
      if (files.length > 0) {
        const refreshedProfile = await inspectExtractionFiles(files, selectedCategory).catch(() => null)
        if (refreshedProfile) setFileProfile(refreshedProfile)
      }

      if (result.completed) {
        notify(
          'success',
          'สกัดและตรวจเฉลยครบทั้ง 3 ขั้นตอนแล้ว!',
          `เข้า Staging ${result.stats.savedToStaging} ข้อ · ตรงหนังสือ ${result.stats.bookVerifiedCount} · AI แก้เฉลย ${result.stats.aiOverriddenCount} · AI เฉลย ${result.stats.aiSolvedCount} ข้อ`
        )
      }
    } catch (error) {
      setExtractionError(error.message)
      await syncStagingSnapshot(selectedCategory)
      if (files.length > 0) {
        const refreshedProfile = await inspectExtractionFiles(files, selectedCategory).catch(() => null)
        if (refreshedProfile) setFileProfile(refreshedProfile)
      }
    } finally {
      setIsExtracting(false)
      abortControllerRef.current = null
    }
  }

  const handleRunPendingPass2And3 = async () => {
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

    if (!selectedCategory || statusCounts.pending_answer === 0) return

    setExtractionError('')
    setIsExtracting(true)
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const result = await runDeferredAnswerPipeline({
        categoryId: selectedCategory,
        fingerprint: fileProfile?.fingerprint || null,
        currentUserId,
        modelRoutingMode,
        deepModelOverride: selectedDeepModel,
        signal: controller.signal,
        onProgress: (nextProgress) => {
          setProgress(nextProgress)
        },
        onStagingUpdated: handleLiveStagingUpdated
      })

      await syncStagingSnapshot(selectedCategory)
      if (result.completed) {
        notify(
          'success',
          'จับคู่และตรวจเฉลย Pass 2–3 สำเร็จ!',
          `ตรงหนังสือ ${result.stats.bookVerifiedCount} · AI แก้เฉลย ${result.stats.aiOverriddenCount} · AI เฉลย ${result.stats.aiSolvedCount} ข้อ`
        )
      }
    } catch (error) {
      setExtractionError(error.message)
      await syncStagingSnapshot(selectedCategory)
    } finally {
      setIsExtracting(false)
      abortControllerRef.current = null
    }
  }

  const handlePauseExtraction = () => {
    abortControllerRef.current?.abort()
  }

  const handleSaveStagingQuestion = async (filteredIndex, updatedQuestion) => {
    const target = filteredStagingItems[filteredIndex]
    if (!target?.id) return
    try {
      const saved = await updateStagingItem(target.id, updatedQuestion)
      setStagingItems((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))
    } catch (error) {
      notify('danger', 'บันทึกการแก้ไข Draft ไม่สำเร็จ', error.message)
    }
  }

  const handleConfirmAiOverride = async (item, editedExplanation) => {
    const saved = await resolveStagingOverrideDecision(item.id, {
      decision: 'confirm_ai',
      explanation: editedExplanation
    })
    setStagingItems((prev) => prev.map((row) => (row.id === saved.id ? saved : row)))
    notify('success', 'ยืนยันใช้เฉลย AI แล้ว', 'บันทึกคำอธิบายและคงเฉลยที่ AI วิเคราะห์ไว้เรียบร้อยครับ')
  }

  const handleRevertOverrideToBook = async (item, nextExplanation) => {
    const saved = await resolveStagingOverrideDecision(item.id, {
      decision: 'revert_to_book',
      bookAnswer: item.book_answer,
      explanation: nextExplanation
    })
    setStagingItems((prev) => prev.map((row) => (row.id === saved.id ? saved : row)))
    setInspectedOverrideItem(saved)
  }

  const handleSaveRevertedExplanation = async (item, editedExplanation) => {
    const saved = await resolveStagingOverrideDecision(item.id, {
      decision: 'revert_to_book',
      bookAnswer: item.book_answer,
      explanation: editedExplanation
    })
    setStagingItems((prev) => prev.map((row) => (row.id === saved.id ? saved : row)))
    notify('success', 'บันทึกเฉลยตามหนังสือเรียบร้อย', 'อัปเดตสถานะเป็น "เฉลยหนังสือ (ตรวจแล้ว)" พร้อมคำอธิบายแล้วครับ')
  }

  const handleRequestRemoveSingleStaging = (filteredIndex, item) => {
    const target = item || filteredStagingItems[filteredIndex]
    if (!target?.id) return
    openConfirm({
      type: 'danger',
      title: 'ยืนยันลบข้อสอบ Draft ข้อนี้?',
      description: 'ข้อสอบข้อนี้จะถูกลบออกจากตาราง Staging ถาวรครับ',
      confirmText: '🗑️ ลบข้อนี้',
      onConfirm: async () => {
        try {
          await deleteStagingItems([target.id])
          await syncStagingSnapshot(selectedCategory, { silent: true })
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
          const count = selectedStagingIds.length
          await deleteStagingItems(selectedStagingIds)
          setSelectedStagingIds([])
          await syncStagingSnapshot(selectedCategory, { silent: true })
          notify('success', 'ลบ Draft สำเร็จ', `ลบข้อสอบ Draft จำนวน ${count} ข้อเรียบร้อยแล้ว`)
        } catch (error) {
          notify('danger', 'ลบ Draft ไม่สำเร็จ', error.message)
        }
      }
    })
  }

  const handleClearAllCategoryDrafts = () => {
    if (!selectedCategory || displayedDraftCount === 0) return
    openConfirm({
      type: 'danger',
      title: `ล้าง Draft ทั้งหมดของวิชา "${selectedCategoryName}"?`,
      description: `จะลบข้อสอบ Draft ค้างอยู่ทั้งหมด ${displayedDraftCount} ข้อ รวมถึง Checkpoint, Answer Key Pool และคิวฟันธงของหมวดหมู่นี้ออกจากระบบถาวร (ไม่กระทบข้อสอบหลักที่เผยแพร่แล้ว)`,
      confirmText: `🧹 ล้าง Draft ทั้งหมด (${displayedDraftCount} ข้อ)`,
      onConfirm: async () => {
        try {
          await clearCategoryStagingItems(selectedCategory, { clearCheckpoints: true })
          setStagingItems([])
          setExactStagingCount(0)
          setSelectedStagingIds([])
          setFileProfile((prev) => (prev ? { ...prev, checkpoint: null } : prev))
          if (selectedCategory === categoryId) onStagingCountChange?.(0)
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
      await syncStagingSnapshot(selectedCategory)
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

  /**
   * Pre-Publish Safety Guard using ConfirmModal:
   * - Strictly blocks publishing any `pending_answer` item
   * - Summarizes `ai_overridden` / `pending_answer` counts for admin review before publishing
   */
  const requestPublishWithGuard = (candidateItems, isPublishAll = false) => {
    if (!candidateItems || candidateItems.length === 0) return

    const pendingList = candidateItems.filter((i) => resolveItemAnswerStatus(i) === 'pending_answer')
    const readyList = candidateItems.filter((i) => resolveItemAnswerStatus(i) !== 'pending_answer')
    const overriddenCount = readyList.filter((i) => resolveItemAnswerStatus(i) === 'ai_overridden').length
    const aiSolvedCount = readyList.filter((i) => resolveItemAnswerStatus(i) === 'ai_solved').length
    const bookVerifiedCount = readyList.filter((i) => resolveItemAnswerStatus(i) === 'book_verified').length

    // Case 1: ALL items are still pending_answer -> strictly block!
    if (readyList.length === 0) {
      return openConfirm({
        type: 'warning',
        title: `ไม่สามารถเผยแพร่ข้อสอบที่รอจับคู่เฉลย (${pendingList.length} ข้อ)`,
        description: 'ข้อสอบทั้งหมดยังอยู่ในสถานะ "รอจับคู่เฉลย (pending_answer)" ห้ามเผยแพร่เข้าคลังหลัก กรุณากดปุ่ม "⚡ ดำเนินการจับคู่และตรวจเฉลยต่อ (Pass 2–3)" ก่อนครับ',
        confirmText: '⚡ ไปรัน Pass 2–3 ทันที',
        onConfirm: () => handleRunPendingPass2And3()
      })
    }

    // Case 2: Mixed ready + pending_answer OR contains ai_overridden items -> Warn & confirm via ConfirmModal!
    if (pendingList.length > 0 || overriddenCount > 0) {
      const warningParts = []
      if (pendingList.length > 0) {
        warningParts.push(`• พบข้อที่ยังเป็น "รอจับคู่เฉลย" จำนวน ${pendingList.length} ข้อ (จะถูกข้ามไว้ใน Staging ห้ามเผยแพร่)`)
      }
      if (overriddenCount > 0) {
        warningParts.push(`• พบข้อที่ติดสถานะ "⚠️ AI แก้เฉลย" จำนวน ${overriddenCount} ข้อ (แนะนำให้กดตรวจเหตุผลก่อนเผยแพร่)`)
      }
      warningParts.push(
        `สรุปรายการพร้อมเผยแพร่ ${readyList.length} ข้อ: เฉลยหนังสือตรง ${bookVerifiedCount} ข้อ · AI แก้เฉลย ${overriddenCount} ข้อ · AI เฉลย ${aiSolvedCount} ข้อ`
      )

      return openConfirm({
        type: 'warning',
        title: isPublishAll
          ? `ตรวจสอบก่อนเผยแพร่ข้อสอบ (${readyList.length} ข้อพร้อมเผยแพร่)?`
          : `ยืนยันเผยแพร่ข้อสอบที่เลือก (${readyList.length} ข้อ)?`,
        description: warningParts.join('\n'),
        confirmText: `🚀 ยืนยันเผยแพร่ ${readyList.length} ข้อที่พร้อมแล้ว`,
        onConfirm: () => executePublish(readyList)
      })
    }

    // Case 3: Clean publish (all verified/solved, no pending or overridden)
    executePublish(readyList)
  }

  const handlePublishSelected = () => {
    const selectedItems = stagingItems.filter((item) => selectedStagingIds.includes(item.id))
    requestPublishWithGuard(selectedItems, false)
  }

  const handlePublishAll = () => {
    requestPublishWithGuard(stagingItems, true)
  }

  const handleSafeClose = () => {
    setShowKeyRequired(false)
    if (isExtracting) {
      openConfirm({
        type: 'warning',
        title: 'หยุดพักและปิดหน้าต่างใช่หรือไม่?',
        description: 'ข้อสอบใน Staging, Answer Key Pool และคิวฟันธง Stage 3B ถูกบันทึกไว้ใน Checkpoint แล้ว คุณสามารถกลับมาทำต่อจากจุดเดิมได้ทุกเมื่อครับ',
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
  const activePass = progress?.pass || fileProfile?.checkpoint?.current_pass || 1
  const totalPages = stats?.totalPages || fileProfile?.totalPages || 0
  const completedPages = Math.min(
    totalPages,
    progress?.currentEndPage || stats?.processedPages || fileProfile?.checkpoint?.last_completed_page || 0
  )

  const progressPercent = (() => {
    if (progress?.status === 'completed') return 100
    if (activePass === 3 && progress?.pass3Total > 0) {
      return Math.min(99, Math.round((progress.pass3Processed / progress.pass3Total) * 100))
    }
    if (activePass === 2) return 100
    return totalPages > 0 ? Math.min(100, Math.round((completedPages / totalPages) * 100)) : 0
  })()

  const cpLastPage = Number(fileProfile?.checkpoint?.last_completed_page || 0)
  const cpPass = Number(fileProfile?.checkpoint?.current_pass || 1)
  const cpKeyPoolLen = Array.isArray(fileProfile?.checkpoint?.answer_key_pool)
    ? fileProfile.checkpoint.answer_key_pool.length
    : 0
  const hasResumablePass1 =
    Boolean(fileProfile?.checkpoint) &&
    cpLastPage > 0 &&
    cpLastPage < Number(fileProfile.totalPages || 0)
  const hasResumablePass23 =
    Boolean(fileProfile?.checkpoint) &&
    cpLastPage >= Number(fileProfile.totalPages || 1) &&
    (cpPass < 3 || fileProfile.checkpoint.status !== 'completed' || statusCounts.pending_answer > 0)

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
                  AI ดึงข้อสอบจากไฟล์ (3-Pass Hybrid Extractor)
                </h2>
                <p className="text-xs text-slate-400 truncate">
                  ขั้น 1 สกัดโจทย์+เฉลยทั้งไฟล์ → ขั้น 2 จับคู่เฉลยหนังสือ → ขั้น 3 ตรวจคัดกรอง (Lite) & ฟันธง (Flash Standard)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onGoToSettings}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] font-bold text-slate-300 hover:border-indigo-500/50 hover:text-white transition-colors cursor-pointer"
                title="ตั้งค่า API Key และโมเดลหลัก"
              >
                <span>⚙️</span>
                <span>{modelRoutingMode === 'hybrid' ? 'Hybrid 2 ระดับ' : getGeminiModelLabel(liteModel)}</span>
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

          {/* Tabs + Category Selector (with real-time exact Draft counter!) */}
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
                📤 สกัดข้อสอบ (3-Pass)
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
                    : displayedDraftCount > 0
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-slate-800 text-slate-400'
                }`}>
                  {displayedDraftCount}
                </span>
                {statusCounts.ai_overridden > 0 && (
                  <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-mono font-black text-slate-950" title="ข้อที่ AI แก้เฉลย">
                    ⚠️ {statusCounts.ai_overridden}
                  </span>
                )}
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
          {/* 3-Pass Pipeline Visual Stepper */}
          {(isExtracting || progress) && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {PIPELINE_STEPS.map((step) => {
                  const isCompleted =
                    progress?.status === 'completed' ||
                    activePass > step.pass
                  const isCurrent = !isCompleted && activePass === step.pass

                  return (
                    <div
                      key={step.pass}
                      className={`rounded-xl border px-3.5 py-2.5 flex items-center gap-2.5 transition-all ${
                        isCompleted
                          ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                          : isCurrent
                            ? 'border-sky-500/50 bg-sky-500/15 text-white ring-1 ring-sky-500/30'
                            : 'border-slate-800 bg-slate-900/60 text-slate-500'
                      }`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                        isCompleted
                          ? 'bg-emerald-500 text-slate-950'
                          : isCurrent
                            ? 'bg-sky-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400'
                      }`}>
                        {isCompleted ? '✓' : step.pass}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider opacity-80">
                          {step.label}{isCurrent && step.pass === 3 && progress?.pass3Stage ? ` · Stage ${progress.pass3Stage}` : ''}
                        </p>
                        <p className="text-xs font-bold truncate">{step.title}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Active Model & Live Status */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    {isExtracting && (
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-400 border-t-transparent shrink-0" />
                    )}
                    <span className="font-bold text-slate-200 truncate">
                      {progress?.statusMessage || 'กำลังเตรียมประมวลผล...'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {progress?.activeModelLabel && (
                      <span className="rounded-full border border-indigo-500/35 bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-bold text-indigo-200">
                        🤖 {progress.activeModelLabel}
                      </span>
                    )}
                    {progress?.adaptiveDelayMs > 0 && isExtracting && (
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] font-mono text-slate-400">
                        RPM: {(progress.adaptiveDelayMs / 1000).toFixed(1)}s/req
                      </span>
                    )}
                    <span className="font-mono font-black text-sky-300">{progressPercent}%</span>
                  </div>
                </div>

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

                {stats?.fallbackTriggered && stats?.fallbackNotice && (
                  <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-200">
                    ⚠️ Auto-Fallback: {stats.fallbackNotice}
                  </div>
                )}
              </div>
            </div>
          )}

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
                helperText="Pass 1 สกัดโจทย์+เฉลยด้วย Flash Lite → Pass 2 จับคู่เฉลยหนังสือ → Pass 3 คัดกรองด้วย Lite & ฟันธงข้อสงสัย/ไม่มีเฉลยด้วย Flash Standard"
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

              {/* File Profile + Checkpoint Banner */}
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

                  {fileProfile.checkpoint && cpLastPage > 0 && (
                    <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-black text-amber-300">
                          🔖 พบ Checkpoint เดิมของไฟล์นี้ (ขั้น {cpPass}/3 · เฉลยสะสมใน Pool {cpKeyPoolLen} ข้อ)
                        </p>
                        <p className="text-xs text-amber-100/90 leading-relaxed">
                          {hasResumablePass1
                            ? `ขั้น 1 อ่านถึงหน้า ${cpLastPage} / ${fileProfile.totalPages} แล้ว · กดเริ่มระบบจะข้ามหน้าที่อ่านแล้วไปต่อที่หน้า ${cpLastPage + 1} พร้อมรักษา Answer Key Pool เดิมครบถ้วน`
                            : hasResumablePass23
                              ? `ขั้น 1 อ่านครบถึงหน้า ${cpLastPage} / ${fileProfile.totalPages} แล้ว · กดปุ่มเพื่อจับคู่เฉลยและตรวจ Pass 2–3 ต่อได้ทันที`
                              : `ไฟล์นี้ผ่านครบทั้ง 3 ขั้นตอนแล้ว หากต้องการสกัดใหม่ตั้งแต่ต้นให้กดล้าง Checkpoint`}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isExtracting}
                        onClick={handleResetCheckpoint}
                        className="shrink-0 rounded-xl border border-amber-400/40 bg-slate-950/70 hover:bg-slate-900 px-3.5 py-2 text-xs font-bold text-amber-300 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        🔄 ล้าง Checkpoint เพื่อเริ่มใหม่
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Two-Stage Hybrid Model Routing Selector */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4 sm:p-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
                    🧠 โหมดการเลือกโมเดลตรวจเฉลย (Two-Stage Hybrid Routing)
                  </h3>
                  <span className="text-[11px] font-bold text-indigo-300">
                    Pass 1 & 3A: {getGeminiModelLabel(liteModel)} (500 RPD)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`rounded-2xl border p-3.5 cursor-pointer transition-all flex items-start gap-3 ${
                    modelRoutingMode === 'hybrid'
                      ? 'border-indigo-500/60 bg-indigo-500/10 ring-1 ring-indigo-500/30'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="modelRoutingMode"
                      value="hybrid"
                      disabled={isExtracting}
                      checked={modelRoutingMode === 'hybrid'}
                      onChange={() => setModelRoutingMode('hybrid')}
                      className="mt-1 accent-indigo-500 cursor-pointer"
                    />
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="text-xs font-black text-white">
                        🧠 Hybrid 2 ระดับ (แนะนำ)
                      </p>
                      <p className="text-[11px] leading-relaxed text-slate-400">
                        คัดกรอง 25 ข้อ/รอบ ด้วย Flash Lite (500 RPD) แล้วส่งเฉพาะข้อสงสัย + ไม่มีเฉลยเข้า Flash Standard (20 RPD) ฟันธง (Auto-Fallback อัตโนมัติหากโควตาเต็ม)
                      </p>
                      {modelRoutingMode === 'hybrid' && GEMINI_STANDARD_MODELS.length > 0 && (
                        <div className="pt-1.5">
                          <select
                            value={selectedDeepModel}
                            disabled={isExtracting}
                            onChange={(e) => setSelectedDeepModel(e.target.value)}
                            className="w-full rounded-xl border border-indigo-500/40 bg-slate-950 px-2.5 py-1.5 text-[11px] font-bold text-indigo-200 outline-none focus:border-indigo-400 cursor-pointer"
                          >
                            {GEMINI_STANDARD_MODELS.map((m) => (
                              <option key={m.value} value={m.value}>
                                ด่านฟันธง 3B: {m.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </label>

                  <label className={`rounded-2xl border p-3.5 cursor-pointer transition-all flex items-start gap-3 ${
                    modelRoutingMode === 'lite_only'
                      ? 'border-sky-500/60 bg-sky-500/10 ring-1 ring-sky-500/30'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="modelRoutingMode"
                      value="lite_only"
                      disabled={isExtracting}
                      checked={modelRoutingMode === 'lite_only'}
                      onChange={() => setModelRoutingMode('lite_only')}
                      className="mt-1 accent-sky-500 cursor-pointer"
                    />
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs font-black text-white">
                        ⚡ Flash Lite ตลอดทาง
                      </p>
                      <p className="text-[11px] leading-relaxed text-slate-400">
                        ใช้ {getGeminiModelLabel(liteModel)} (15 RPM / 500 RPD) ครบทุกขั้นตอนตั้งแต่สกัด คัดกรอง และเฉลย เหมาะเมื่อต้องการเก็บโควตา Flash Standard ไว้ใช้ภายหลัง
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Chunk & Page Range Settings */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
                    ⚙️ การตั้งค่ารอบการประมวลผล (Auto-First + Manual Override)
                  </h3>
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                    {pagesPerBatchInput.trim()
                      ? `กำหนดเอง: ${pagesPerBatchInput} หน้า/รอบ · คุม RPM อัตโนมัติ`
                      : `อัตโนมัติ: ${fileProfile?.recommended?.pagesPerBatch || 'ปรับตามไฟล์'} หน้า/รอบ · 3A (25 ข้อ) / 3B (20 ข้อ)`}
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
                    <span>{hasResumablePass1 || hasResumablePass23 ? '▶️' : '🚀'}</span>
                    <span>
                      {hasResumablePass1
                        ? `อ่านต่อจากหน้า ${cpLastPage + 1} / ${fileProfile.totalPages} (Pass 1 → 2 → 3)`
                        : hasResumablePass23
                          ? 'ดำเนินการต่อขั้นจับคู่และตรวจเฉลย (Pass 2 → 3)'
                          : 'เริ่มสกัดและตรวจเฉลย 3 ขั้นตอน'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePauseExtraction}
                    className="flex-1 rounded-2xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 px-5 py-3.5 text-sm font-black text-amber-300 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>⏸️</span>
                    <span>หยุดพักชั่วคราว (บันทึก Checkpoint & Answer Key Pool แล้วทำต่อได้)</span>
                  </button>
                )}

                {!isExtracting && statusCounts.pending_answer > 0 && (
                  <button
                    type="button"
                    onClick={handleRunPendingPass2And3}
                    className="rounded-2xl border border-violet-500/40 bg-violet-500/15 hover:bg-violet-500/25 px-4 py-3.5 text-xs font-black text-violet-200 transition-colors cursor-pointer shrink-0"
                  >
                    ⚡ จับคู่ & ตรวจเฉลยข้อที่รออยู่ ({statusCounts.pending_answer} ข้อ)
                  </button>
                )}

                {displayedDraftCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('staging')}
                    className="rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-3.5 text-xs font-black text-amber-300 transition-colors cursor-pointer shrink-0"
                  >
                    📝 เปิดตรวจ Draft ({displayedDraftCount}) →
                  </button>
                )}
              </div>

              {extractionError && (
                <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs leading-relaxed text-red-200">
                  <p className="font-bold text-red-300 mb-1">⚠️ เกิดข้อผิดพลาดระหว่างประมวลผล (บันทึก Checkpoint ไว้แล้ว)</p>
                  <p>{extractionError}</p>
                </div>
              )}

              {/* Live 4-Status Breakdown (Synced with Supabase Exact Count) + Extraction Stats */}
              {(stats || displayedDraftCount > 0) && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                      📊 สรุปสถานะเฉลยใน Staging (ซิงก์ตรงจาก Supabase: {displayedDraftCount} ข้อ)
                    </h4>
                    {stats && (
                      <span className="text-[11px] text-slate-400">
                        เฉลยใน Pool: <strong className="text-sky-300 font-mono">{stats.answerKeysCollected || cpKeyPoolLen}</strong> · ส่งฟันธง 3B: <strong className="text-indigo-300 font-mono">{stats.escalatedToDeepCount || 0}</strong> ({stats.stage3BRequestsUsed || 0} req)
                      </span>
                    )}
                  </div>

                  {/* 4 Answer Status Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <p className="text-[11px] font-bold text-emerald-300">✅ เฉลยหนังสือ (ตรวจแล้ว)</p>
                      <p className="mt-1 text-xl font-black font-mono text-emerald-400">{statusCounts.book_verified}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStagingFilter('ai_overridden')
                        setActiveTab('staging')
                      }}
                      className="text-left rounded-xl border border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/15 p-3 transition-colors cursor-pointer"
                    >
                      <p className="text-[11px] font-bold text-orange-300">⚠️ AI แก้เฉลย (คลิกตรวจ)</p>
                      <p className="mt-1 text-xl font-black font-mono text-orange-400">{statusCounts.ai_overridden}</p>
                    </button>
                    <div className="rounded-xl border border-sky-500/30 bg-indigo-500/10 p-3">
                      <p className="text-[11px] font-bold text-sky-300">🤖 AI เฉลย (ไม่มีในไฟล์)</p>
                      <p className="mt-1 text-xl font-black font-mono text-sky-300">{statusCounts.ai_solved}</p>
                    </div>
                    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                      <p className="text-[11px] font-bold text-slate-400">⏳ รอจับคู่ / รอตรวจ</p>
                      <p className="mt-1 text-xl font-black font-mono text-slate-200">{statusCounts.pending_answer}</p>
                    </div>
                  </div>

                  {/* Extraction Filter Metrics */}
                  {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/80">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
                        <p className="text-[10px] font-bold text-slate-400">หน้าที่ข้ามอัตโนมัติ</p>
                        <p className="text-sm font-black font-mono text-slate-200">{stats.skippedFrontMatterPages || 0} หน้า</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
                        <p className="text-[10px] font-bold text-slate-400">ดึงได้ทั้งหมด (Pass 1)</p>
                        <p className="text-sm font-black font-mono text-sky-300">{stats.extractedTotal || 0} ข้อ</p>
                      </div>
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5">
                        <p className="text-[10px] font-bold text-amber-300">คัดออกเพราะซ้ำ (Exact)</p>
                        <p className="text-sm font-black font-mono text-amber-400">{stats.duplicateExactMatch || 0} ข้อ</p>
                      </div>
                      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5">
                        <p className="text-[10px] font-bold text-rose-300">ข้าม (รูป / ไม่ใช่ 4–5 ช้อยส์)</p>
                        <p className="text-sm font-black font-mono text-rose-400">
                          {(stats.skippedImageQuestions || 0) + (stats.skippedNonMcqQuestions || 0)} ข้อ
                        </p>
                      </div>
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
            /* TAB 2: STAGING DRAFT REVIEW, INTERACTIVE AUDIT & FLEXIBLE PUBLISHING */
            <div className="space-y-4">
              {stagingError && (
                <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-bold text-red-200">
                  ⚠️ {stagingError}
                </div>
              )}

              {/* Pending Banner with 1-Click Pass 2-3 Trigger */}
              {statusCounts.pending_answer > 0 && (
                <div className="rounded-2xl border border-violet-500/35 bg-violet-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-violet-200">
                      ⏳ มีข้อสอบรอจับคู่/ตรวจเฉลย (Pass 2–3) จำนวน {statusCounts.pending_answer} ข้อ
                    </p>
                    <p className="text-xs text-violet-200/80 mt-0.5">
                      โหมดปัจจุบัน: <strong>{modelRoutingMode === 'hybrid' ? `Hybrid (${getGeminiModelLabel(liteModel)} → ${getGeminiModelLabel(deepModel)})` : getGeminiModelLabel(liteModel)}</strong> · กดปุ่มเพื่อจับคู่เฉลยและตรวจความถูกต้องทันที
                    </p>
                  </div>
                  {!isExtracting ? (
                    <button
                      type="button"
                      onClick={handleRunPendingPass2And3}
                      className="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 px-4 py-2.5 text-xs font-black text-white shadow cursor-pointer"
                    >
                      ⚡ ดำเนินการจับคู่และตรวจเฉลยต่อ (Pass 2–3)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePauseExtraction}
                      className="shrink-0 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2.5 text-xs font-black text-amber-300 cursor-pointer"
                    >
                      ⏸️ หยุดพัก Pass 3
                    </button>
                  )}
                </div>
              )}

              {/* Search & 5 Status Filter Chips */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 space-y-3">
                <input
                  type="search"
                  value={stagingSearch}
                  onChange={(e) => setStagingSearch(e.target.value)}
                  placeholder="ค้นหาโจทย์, เลขข้อต้นฉบับ, ชื่อชุด/บท, ชื่อไฟล์ หรือเหตุผลที่ AI แก้เฉลย..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-sky-500"
                />

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStagingFilter('all')}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer border transition-colors ${
                      stagingFilter === 'all'
                        ? 'bg-sky-600 text-white border-sky-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    ทั้งหมด ({displayedDraftCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStagingFilter('ai_overridden')}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer border transition-colors ${
                      stagingFilter === 'ai_overridden'
                        ? 'bg-orange-500/25 text-orange-200 border-orange-500/50'
                        : 'bg-slate-900 text-orange-300/80 border-slate-800 hover:border-orange-500/30'
                    }`}
                  >
                    ⚠️ AI แก้เฉลย ({statusCounts.ai_overridden})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStagingFilter('ai_solved')}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer border transition-colors ${
                      stagingFilter === 'ai_solved'
                        ? 'bg-indigo-500/25 text-sky-200 border-sky-500/50'
                        : 'bg-slate-900 text-sky-300/80 border-slate-800 hover:border-sky-500/30'
                    }`}
                  >
                    🤖 AI เฉลย ({statusCounts.ai_solved})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStagingFilter('book_verified')}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer border transition-colors ${
                      stagingFilter === 'book_verified'
                        ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                        : 'bg-slate-900 text-emerald-300/80 border-slate-800 hover:border-emerald-500/30'
                    }`}
                  >
                    ✅ เฉลยหนังสือ ({statusCounts.book_verified})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStagingFilter('pending_answer')}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer border transition-colors ${
                      stagingFilter === 'pending_answer'
                        ? 'bg-slate-700 text-white border-slate-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    ⏳ รอจับคู่ ({statusCounts.pending_answer})
                  </button>
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
                    <span>เลือกทั้งหมดที่แสดง ({selectedStagingIds.length}/{displayedDraftCount})</span>
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
                      disabled={displayedDraftCount === 0 || publishing}
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
                      disabled={displayedDraftCount === 0 || publishing}
                      onClick={handlePublishAll}
                      className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 px-4 py-2 text-xs font-black text-white shadow transition-all cursor-pointer"
                    >
                      {publishing ? '⏳ กำลังเผยแพร่...' : `✨ เผยแพร่ทั้งหมด (${displayedDraftCount} ข้อ)`}
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
                    {displayedDraftCount === 0
                      ? `ยังไม่มีข้อสอบ Draft ค้างอยู่ในวิชา "${selectedCategoryName}"`
                      : 'ไม่พบข้อสอบ Draft ที่ตรงกับคำค้นหาหรือตัวกรองสถานะ'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {displayedDraftCount === 0
                      ? 'สลับไปที่แท็บ "สกัดข้อสอบ (3-Pass)" เพื่ออัปโหลด PDF หรือรูปภาพข้อสอบได้เลยครับ'
                      : 'ลองเปลี่ยน Filter Chips ด้านบนหรือล้างคำค้นหาดูครับ'}
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
                  onInspectOverride={(item) => setInspectedOverrideItem(item)}
                />
              )}
            </div>
          )}
        </div>
      </section>

      {inspectedOverrideItem && (
        <OverrideReasonModal
          key={inspectedOverrideItem.id}
          item={inspectedOverrideItem}
          onClose={() => setInspectedOverrideItem(null)}
          onConfirmAiAnswer={handleConfirmAiOverride}
          onRevertToBookAnswer={handleRevertOverrideToBook}
          onSaveExplanationOnly={handleSaveRevertedExplanation}
        />
      )}

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
          description={<span className="whitespace-pre-line">{confirmState.description}</span>}
          confirmText={confirmState.confirmText}
          cancelText="← ยกเลิก"
          onClose={closeConfirm}
          onConfirm={() => confirmState.onConfirm?.()}
        />
      </div>
    </div>
  )
}
