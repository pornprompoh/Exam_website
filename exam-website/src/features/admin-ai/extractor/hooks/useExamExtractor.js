import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { getGeminiApiKey } from '../../../../shared/lib/geminiApiKey'
import { DEFAULT_STANDARD_MODEL, resolveHybridModelPair } from '../../../../shared/lib/geminiModels'
import { validateExtractorFiles } from '../../shared/utils/pdfPipelineUtils'
import { clearExtractionCheckpoint } from '../services/extractionCheckpointService'
import {
  clearCategoryStagingItems,
  deleteStagingItems,
  fetchCategoryStagingSnapshot,
  publishStagingItems,
  resolveItemAnswerStatus,
  resolveStagingOverrideDecision,
  updateStagingItem
} from '../services/stagingQuestionService'
import {
  inspectExtractionFiles,
  runDeferredAnswerPipeline,
  runVerbatimExamExtraction
} from '../services/examExtractorService'

export function useExamExtractor({
  isOpen,
  onClose,
  categories,
  categoryId,
  currentUserId,
  initialTab,
  onSuccess,
  onNotify,
  onStagingCountChange
}) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [selectedCategory, setSelectedCategory] = useState(categoryId || categories?.[0]?.id || '')

  const [files, setFiles] = useState([])
  const [fileError, setFileError] = useState('')
  const [inspecting, setInspecting] = useState(false)
  const [fileProfile, setFileProfile] = useState(null)

  const [pagesPerBatchInput, setPagesPerBatchInput] = useState('')
  const [startPageInput, setStartPageInput] = useState('')
  const [endPageInput, setEndPageInput] = useState('')
  const [modelRoutingMode, setModelRoutingMode] = useState('hybrid')
  const [selectedDeepModel, setSelectedDeepModel] = useState(() => {
    const pair = resolveHybridModelPair()
    return pair.deepModel || DEFAULT_STANDARD_MODEL
  })

  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState('')
  const [progress, setProgress] = useState(null)
  const [showDetailsPanel, setShowDetailsPanel] = useState(false)
  const [detailsSubTab, setDetailsSubTab] = useState('skipped_items')
  const abortControllerRef = useRef(null)

  const [stagingItems, setStagingItems] = useState([])
  const [exactStagingCount, setExactStagingCount] = useState(0)
  const [loadingStaging, setLoadingStaging] = useState(false)
  const [stagingError, setStagingError] = useState('')
  const [selectedStagingIds, setSelectedStagingIds] = useState([])
  const [stagingSearch, setStagingSearch] = useState('')
  const [stagingFilter, setStagingFilter] = useState('all')
  const [publishing, setPublishing] = useState(false)
  const [inspectedOverrideItem, setInspectedOverrideItem] = useState(null)

  const loadSeqRef = useRef(0)

  const [showKeyRequired, setShowKeyRequired] = useState(false)
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    type: 'danger',
    title: '',
    description: '',
    confirmText: 'ยืนยัน',
    onConfirm: null
  })

  const notify = useCallback(
    (type, title, description) => {
      onNotify?.(type, title, description)
    },
    [onNotify]
  )

  const selectedCategoryName = categories?.find((c) => c.id === selectedCategory)?.name || ''
  const { liteModel, deepModel } = resolveHybridModelPair(selectedDeepModel)

  const syncStagingSnapshot = useCallback(
    async (catId, { silent = false } = {}) => {
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
    },
    [categoryId, onStagingCountChange]
  )

  const handleLiveStagingUpdated = useCallback(
    async (payload = {}) => {
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
    },
    [selectedCategory, categoryId, onStagingCountChange, syncStagingSnapshot]
  )

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

  useEffect(
    () => () => {
      abortControllerRef.current?.abort()
    },
    []
  )

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
      confirmText: 'ล้าง Checkpoint',
      onConfirm: async () => {
        await clearExtractionCheckpoint(selectedCategory, fileProfile.fingerprint)
        setFileProfile((prev) => (prev ? { ...prev, checkpoint: null } : prev))
        setProgress(null)
        notify('info', 'ล้าง Checkpoint แล้ว', 'พร้อมเริ่มสกัดข้อสอบใหม่ตั้งแต่หน้าแรก')
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
      return notify('warning', 'ยังไม่ได้เลือกวิชา', 'กรุณาเลือกหมวดหมู่วิชาก่อนเริ่มสกัดข้อสอบ')
    }
    if (files.length === 0 || fileError) {
      return notify('warning', 'กรุณาเลือกไฟล์ที่ถูกต้อง', fileError || 'กรุณาอัปโหลดไฟล์ PDF หรือรูปภาพก่อนเริ่มสกัด')
    }

    const parsedBatch = pagesPerBatchInput.trim() ? parseInt(pagesPerBatchInput, 10) : null
    if (parsedBatch !== null && (Number.isNaN(parsedBatch) || parsedBatch < 1 || parsedBatch > 30)) {
      return notify(
        'warning',
        'จำนวนหน้าต่อรอบไม่ถูกต้อง',
        'กรุณาระบุจำนวนหน้าต่อรอบระหว่าง 1 ถึง 30 หน้า (หรือเว้นว่างเพื่อใช้ค่าอัตโนมัติ)'
      )
    }

    const parsedStart = startPageInput.trim() ? parseInt(startPageInput, 10) : null
    const parsedEnd = endPageInput.trim() ? parseInt(endPageInput, 10) : null
    if (parsedStart !== null && (Number.isNaN(parsedStart) || parsedStart < 1)) {
      return notify('warning', 'หน้าเริ่มต้นไม่ถูกต้อง', 'กรุณาระบุเลขหน้าเริ่มต้นตั้งแต่ 1 ขึ้นไป')
    }
    if (parsedEnd !== null && parsedStart !== null && parsedEnd < parsedStart) {
      return notify('warning', 'ช่วงหน้าไม่ถูกต้อง', 'หน้าสิ้นสุดต้องมากกว่าหรือเท่ากับหน้าเริ่มต้น')
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
          'สกัดและตรวจเฉลยครบทั้ง 3 ขั้นตอนแล้ว',
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
          'จับคู่และตรวจเฉลย Pass 2–3 สำเร็จ',
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
    notify('success', 'ยืนยันใช้เฉลย AI แล้ว', 'บันทึกคำอธิบายและคงเฉลยที่ AI วิเคราะห์ไว้เรียบร้อยแล้ว')
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
    notify('success', 'บันทึกเฉลยตามหนังสือเรียบร้อย', 'อัปเดตสถานะเป็น "เฉลยหนังสือ (ตรวจแล้ว)" พร้อมคำอธิบายแล้ว')
  }

  const handleRequestRemoveSingleStaging = (filteredIndex, item) => {
    const target = item || filteredStagingItems[filteredIndex]
    if (!target?.id) return
    openConfirm({
      type: 'danger',
      title: 'ยืนยันลบข้อสอบ Draft ข้อนี้?',
      description: 'ข้อสอบข้อนี้จะถูกลบออกจากตาราง Staging ถาวร',
      confirmText: 'ลบข้อนี้',
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
    setSelectedStagingIds((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]))
  }

  const allVisibleSelected =
    filteredStagingItems.length > 0 && filteredStagingItems.every((item) => selectedStagingIds.includes(item.id))

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
      description: 'ข้อสอบที่เลือกทั้งหมดจะถูกลบออกจากตาราง Staging ทันที',
      confirmText: `ลบ ${selectedStagingIds.length} ข้อ`,
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
      confirmText: `ล้าง Draft ทั้งหมด (${displayedDraftCount} ข้อ)`,
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
        const dupText =
          result.skippedDuplicatesCount > 0
            ? ` (และคัดออกเพราะซ้ำกับคลังหลักอีก ${result.skippedDuplicatesCount} ข้อ)`
            : ''
        notify(
          'success',
          'เผยแพร่ข้อสอบสำเร็จ',
          `ย้ายข้อสอบจำนวน ${result.publishedCount} ข้อเข้าสู่คลังข้อสอบหลักและลบออกจาก Staging แล้ว${dupText}`
        )
      }
    } catch (error) {
      notify('danger', 'เผยแพร่ข้อสอบไม่สำเร็จ', error.message)
    } finally {
      setPublishing(false)
    }
  }

  const requestPublishWithGuard = (candidateItems, isPublishAll = false) => {
    if (!candidateItems || candidateItems.length === 0) return

    const pendingList = candidateItems.filter((i) => resolveItemAnswerStatus(i) === 'pending_answer')
    const readyList = candidateItems.filter((i) => resolveItemAnswerStatus(i) !== 'pending_answer')
    const overriddenCount = readyList.filter((i) => resolveItemAnswerStatus(i) === 'ai_overridden').length
    const aiSolvedCount = readyList.filter((i) => resolveItemAnswerStatus(i) === 'ai_solved').length
    const bookVerifiedCount = readyList.filter((i) => resolveItemAnswerStatus(i) === 'book_verified').length

    if (readyList.length === 0) {
      return openConfirm({
        type: 'warning',
        title: `ไม่สามารถเผยแพร่ข้อสอบที่รอจับคู่เฉลย (${pendingList.length} ข้อ)`,
        description:
          'ข้อสอบทั้งหมดยังอยู่ในสถานะ "รอจับคู่เฉลย" ห้ามเผยแพร่เข้าคลังหลัก กรุณาดำเนินการจับคู่และตรวจเฉลย (Pass 2–3) ก่อน',
        confirmText: 'รัน Pass 2–3 ทันที',
        onConfirm: () => handleRunPendingPass2And3()
      })
    }

    if (pendingList.length > 0 || overriddenCount > 0) {
      const warningParts = []
      if (pendingList.length > 0) {
        warningParts.push(`• พบข้อที่ยังรอจับคู่เฉลย ${pendingList.length} ข้อ (จะข้ามไว้ใน Staging ไม่เผยแพร่)`)
      }
      if (overriddenCount > 0) {
        warningParts.push(`• พบข้อที่ AI แก้เฉลย ${overriddenCount} ข้อ (แนะนำให้กดตรวจเหตุผลก่อนเผยแพร่)`)
      }
      warningParts.push(
        `สรุปรายการพร้อมเผยแพร่ ${readyList.length} ข้อ: เฉลยหนังสือตรง ${bookVerifiedCount} · AI แก้เฉลย ${overriddenCount} · AI เฉลย ${aiSolvedCount}`
      )

      return openConfirm({
        type: 'warning',
        title: isPublishAll
          ? `ตรวจสอบก่อนเผยแพร่ข้อสอบ (${readyList.length} ข้อพร้อมเผยแพร่)?`
          : `ยืนยันเผยแพร่ข้อสอบที่เลือก (${readyList.length} ข้อ)?`,
        description: warningParts.join('\n'),
        confirmText: `ยืนยันเผยแพร่ ${readyList.length} ข้อ`,
        onConfirm: () => executePublish(readyList)
      })
    }

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
        description:
          'ข้อสอบใน Staging, Answer Key Pool และคิวฟันธง Stage 3B ถูกบันทึกไว้ใน Checkpoint แล้ว สามารถกลับมาทำต่อจากจุดเดิมได้ทุกเมื่อ',
        confirmText: 'หยุดพักและปิดหน้าต่าง',
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
    Boolean(fileProfile?.checkpoint) && cpLastPage > 0 && cpLastPage < Number(fileProfile.totalPages || 0)
  const hasResumablePass23 =
    Boolean(fileProfile?.checkpoint) &&
    cpLastPage >= Number(fileProfile.totalPages || 1) &&
    (cpPass < 3 || fileProfile.checkpoint.status !== 'completed' || statusCounts.pending_answer > 0)

  return {
    activeTab,
    setActiveTab,
    selectedCategory,
    selectedCategoryName,
    handleCategoryChange,
    files,
    fileError,
    inspecting,
    fileProfile,
    validateUploadedFiles,
    handleFilesChange,
    handleResetCheckpoint,
    pagesPerBatchInput,
    setPagesPerBatchInput,
    startPageInput,
    setStartPageInput,
    endPageInput,
    setEndPageInput,
    modelRoutingMode,
    setModelRoutingMode,
    selectedDeepModel,
    setSelectedDeepModel,
    liteModel,
    deepModel,
    isExtracting,
    extractionError,
    progress,
    stats,
    activePass,
    progressPercent,
    cpLastPage,
    cpPass,
    cpKeyPoolLen,
    hasResumablePass1,
    hasResumablePass23,
    showDetailsPanel,
    setShowDetailsPanel,
    detailsSubTab,
    setDetailsSubTab,
    handleStartExtraction,
    handleRunPendingPass2And3,
    handlePauseExtraction,
    stagingItems,
    filteredStagingItems,
    displayedDraftCount,
    statusCounts,
    loadingStaging,
    stagingError,
    selectedStagingIds,
    allVisibleSelected,
    stagingSearch,
    setStagingSearch,
    stagingFilter,
    setStagingFilter,
    publishing,
    inspectedOverrideItem,
    setInspectedOverrideItem,
    handleSaveStagingQuestion,
    handleConfirmAiOverride,
    handleRevertOverrideToBook,
    handleSaveRevertedExplanation,
    handleRequestRemoveSingleStaging,
    handleToggleSelectStaging,
    handleToggleSelectAllVisible,
    handleDeleteSelectedStaging,
    handleClearAllCategoryDrafts,
    handlePublishSelected,
    handlePublishAll,
    showKeyRequired,
    setShowKeyRequired,
    confirmState,
    closeConfirm,
    handleSafeClose
  }
}
