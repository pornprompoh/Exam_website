import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { getGeminiApiKey } from '../../../../shared/lib/geminiApiKey'
import { DEFAULT_STANDARD_MODEL, resolveHybridModelPair } from '../../../../shared/lib/geminiModels'
import {
  DEFAULT_AUDITOR_BATCH_SIZE,
  MAX_AUDITOR_BATCH_SIZE,
  MIN_AUDITOR_BATCH_SIZE,
  estimateAuditQuota
} from '../utils/auditorLocalUtils'
import {
  acceptAuditSuggestions,
  fetchCategoryAuditStats,
  fetchFlaggedQuestions,
  keepOriginalAnswers,
  manualResolveAuditedQuestion,
  resetAuditStatus
} from '../services/auditorDbService'
import { runAnswerAuditPipeline } from '../services/auditorPipelineService'

export function useExamAuditor({ isOpen, onClose, categories, categoryId, initialTab, onNotify, onQuestionsChanged }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [selectedScope, setSelectedScope] = useState(categoryId || 'ALL')

  const [stats, setStats] = useState({ total: 0, unchecked: 0, verified: 0, flagged: 0 })
  const [flaggedItems, setFlaggedItems] = useState([])
  const [loadingData, setLoadingData] = useState(false)
  const [dataError, setDataError] = useState('')
  const loadSeqRef = useRef(0)

  const [limitMode, setLimitMode] = useState('all')
  const [customLimitInput, setCustomLimitInput] = useState('200')
  const [batchSizeInput, setBatchSizeInput] = useState(String(DEFAULT_AUDITOR_BATCH_SIZE))
  const [modelRoutingMode, setModelRoutingMode] = useState('hybrid')
  const [selectedDeepModel, setSelectedDeepModel] = useState(() => {
    const pair = resolveHybridModelPair()
    return pair.deepModel || DEFAULT_STANDARD_MODEL
  })

  const [isAuditing, setIsAuditing] = useState(false)
  const [auditError, setAuditError] = useState('')
  const [progress, setProgress] = useState(null)
  const abortControllerRef = useRef(null)

  const [flaggedSearch, setFlaggedSearch] = useState('')
  const [selectedFlaggedIds, setSelectedFlaggedIds] = useState([])
  const [busyItemId, setBusyItemId] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [manualEditingId, setManualEditingId] = useState(null)
  const [manualDraft, setManualDraft] = useState({ correctOption: 0, explanation: '' })

  const [showKeyRequired, setShowKeyRequired] = useState(false)
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    type: 'warning',
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

  const categoryNameMap = useMemo(() => {
    const map = new Map()
    for (const cat of categories || []) {
      map.set(cat.id, cat.name)
    }
    return map
  }, [categories])

  const { liteModel, deepModel } = resolveHybridModelPair(selectedDeepModel)

  const refreshAuditData = useCallback(
    async (scope = selectedScope, { silent = false } = {}) => {
      const seq = ++loadSeqRef.current
      if (!silent) setLoadingData(true)
      setDataError('')
      try {
        const [nextStats, nextFlagged] = await Promise.all([
          fetchCategoryAuditStats(scope),
          fetchFlaggedQuestions(scope)
        ])
        if (seq !== loadSeqRef.current) return
        setStats(nextStats)
        setFlaggedItems(nextFlagged)
        setSelectedFlaggedIds((prev) => prev.filter((id) => nextFlagged.some((item) => item.id === id)))
      } catch (error) {
        if (seq === loadSeqRef.current) setDataError(error.message)
      } finally {
        if (seq === loadSeqRef.current && !silent) setLoadingData(false)
      }
    },
    [selectedScope]
  )

  useEffect(() => {
    if (!isOpen) return undefined
    let active = true
    Promise.resolve().then(async () => {
      if (!active) return
      await refreshAuditData(selectedScope)
    })
    return () => {
      active = false
    }
  }, [isOpen, selectedScope, refreshAuditData])

  useEffect(
    () => () => {
      abortControllerRef.current?.abort()
    },
    []
  )

  const targetScanCount = useMemo(() => {
    if (limitMode === 'all') return stats.unchecked
    const parsed = parseInt(customLimitInput, 10)
    if (Number.isNaN(parsed) || parsed <= 0) return 0
    return Math.min(parsed, stats.unchecked)
  }, [limitMode, customLimitInput, stats.unchecked])

  const quotaEstimate = useMemo(
    () => estimateAuditQuota(targetScanCount, Number(batchSizeInput) || DEFAULT_AUDITOR_BATCH_SIZE, modelRoutingMode),
    [targetScanCount, batchSizeInput, modelRoutingMode]
  )

  const filteredFlaggedItems = useMemo(() => {
    const q = flaggedSearch.trim().toLowerCase()
    if (!q) return flaggedItems
    return flaggedItems.filter(
      (item) =>
        (item.question_text || '').toLowerCase().includes(q) ||
        (item.audit_reason || '').toLowerCase().includes(q) ||
        (categoryNameMap.get(item.category_id) || '').toLowerCase().includes(q)
    )
  }, [flaggedItems, flaggedSearch, categoryNameMap])

  const openConfirm = ({ type = 'warning', title, description, confirmText = 'ยืนยัน', onConfirm }) => {
    setConfirmState({ isOpen: true, type, title, description, confirmText, onConfirm })
  }

  const closeConfirm = () => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }))
  }

  const handleScopeChange = (nextScope) => {
    setSelectedScope(nextScope)
    setSelectedFlaggedIds([])
    setManualEditingId(null)
    setProgress(null)
    setAuditError('')
  }

  const handleStartAudit = async () => {
    try {
      if (!getGeminiApiKey()) {
        setShowKeyRequired(true)
        return
      }
    } catch (error) {
      setAuditError(error.message)
      setShowKeyRequired(true)
      return
    }

    if (stats.unchecked === 0) {
      return notify(
        'info',
        'ตรวจครบทุกข้อแล้ว',
        'ไม่พบข้อสอบสถานะ unchecked ในขอบเขตที่เลือก หากต้องการตรวจใหม่กรุณากด "รีเซ็ตสถานะเพื่อตรวจใหม่"'
      )
    }

    const parsedBatch = parseInt(batchSizeInput, 10)
    if (Number.isNaN(parsedBatch) || parsedBatch < MIN_AUDITOR_BATCH_SIZE || parsedBatch > MAX_AUDITOR_BATCH_SIZE) {
      return notify(
        'warning',
        'ขนาด Mega-Batch ไม่ถูกต้อง',
        `กรุณาระบุขนาด Mega-Batch ระหว่าง ${MIN_AUDITOR_BATCH_SIZE} ถึง ${MAX_AUDITOR_BATCH_SIZE} ข้อต่อรอบ`
      )
    }

    let maxQuestions = null
    if (limitMode === 'custom') {
      const parsedLimit = parseInt(customLimitInput, 10)
      if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
        return notify('warning', 'จำนวนข้อไม่ถูกต้อง', 'กรุณาระบุจำนวนข้อสอบที่ต้องการตรวจตั้งแต่ 1 ข้อขึ้นไป')
      }
      maxQuestions = parsedLimit
    }

    setAuditError('')
    setIsAuditing(true)
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const result = await runAnswerAuditPipeline({
        categoryId: selectedScope,
        maxQuestions,
        batchSize: parsedBatch,
        modelRoutingMode,
        deepModelOverride: selectedDeepModel,
        signal: controller.signal,
        onProgress: (nextProgress) => setProgress(nextProgress),
        onStatsUpdated: async () => {
          await refreshAuditData(selectedScope, { silent: true })
          onQuestionsChanged?.({ reloadTable: false })
        }
      })

      await refreshAuditData(selectedScope)
      onQuestionsChanged?.({ reloadTable: false })

      if (result.completed) {
        const totalFlaggedNow = result.runStats.stage0Flagged + result.runStats.stage2ConfirmedFlagged
        const totalVerifiedNow = result.runStats.stage1Verified + result.runStats.stage2FalsePositivesCleared
        notify(
          totalFlaggedNow > 0 ? 'warning' : 'success',
          'ตรวจทานเฉลยเสร็จสมบูรณ์',
          `ตรวจผ่าน ${totalVerifiedNow} ข้อ · พบเฉลยอาจผิด (Flagged) ${totalFlaggedNow} ข้อ (Flash Lite ${result.runStats.stage1Requests} req · Flash Standard ${result.runStats.stage2Requests} req)`
        )
      }
    } catch (error) {
      setAuditError(error.message)
      await refreshAuditData(selectedScope)
      onQuestionsChanged?.({ reloadTable: false })
    } finally {
      setIsAuditing(false)
      abortControllerRef.current = null
    }
  }

  const handlePauseAudit = () => {
    abortControllerRef.current?.abort()
  }

  const handleRequestResetAudit = () => {
    const scopeLabel =
      selectedScope === 'ALL'
        ? 'ทั้งหมดทุกหมวดหมู่ในระบบ'
        : `วิชา "${categoryNameMap.get(selectedScope) || ''}"`

    openConfirm({
      type: 'warning',
      title: `รีเซ็ตสถานะการตรวจทานของ ${scopeLabel}?`,
      description:
        'ข้อสอบทั้งหมดในขอบเขตนี้จะถูกรีเซ็ตกลับเป็น "ยังไม่ตรวจ" และล้างข้อมูลคำแนะนำชั่วคราว (ไม่กระทบเฉลยจริงและคำอธิบายเดิม)',
      confirmText: 'ยืนยันรีเซ็ตสถานะ',
      onConfirm: async () => {
        try {
          await resetAuditStatus(selectedScope)
          await refreshAuditData(selectedScope)
          setProgress(null)
          onQuestionsChanged?.({ reloadTable: false })
          notify('success', 'รีเซ็ตสถานะสำเร็จ', `รีเซ็ตข้อสอบใน ${scopeLabel} กลับเป็น "ยังไม่ตรวจ" แล้ว`)
        } catch (error) {
          notify('danger', 'รีเซ็ตไม่สำเร็จ', error.message)
        }
      }
    })
  }

  const handleAcceptSingle = async (item) => {
    setBusyItemId(item.id)
    try {
      const res = await acceptAuditSuggestions([item])
      if (res.updatedCount === 0) {
        notify(
          'warning',
          'ไม่มีเฉลยแนะนำที่ใช้งานได้',
          'ข้อสอบข้อนี้ถูกติด Flag จากด่าน 0 (โครงสร้างเฉลยผิดปกติ) กรุณากด "แก้ไขเอง" เพื่อระบุเฉลยที่ถูกต้อง'
        )
        return
      }
      await refreshAuditData(selectedScope, { silent: true })
      onQuestionsChanged?.({ reloadTable: true })
      notify('success', 'อัปเดตเฉลยและคำอธิบายแล้ว', 'บันทึกเฉลยใหม่พร้อมคำอธิบายและล้างค่าชั่วคราวเรียบร้อยแล้ว')
    } catch (error) {
      notify('danger', 'อัปเดตไม่สำเร็จ', error.message)
    } finally {
      setBusyItemId('')
    }
  }

  const handleKeepOriginalSingle = async (item) => {
    setBusyItemId(item.id)
    try {
      await keepOriginalAnswers([item.id])
      await refreshAuditData(selectedScope, { silent: true })
      onQuestionsChanged?.({ reloadTable: false })
    } catch (error) {
      notify('danger', 'บันทึกไม่สำเร็จ', error.message)
    } finally {
      setBusyItemId('')
    }
  }

  const startManualEdit = (item) => {
    const options = Array.isArray(item.options) ? item.options : []
    const fallbackIdx =
      item.audit_suggested_answer !== null &&
      item.audit_suggested_answer !== undefined &&
      Number(item.audit_suggested_answer) >= 0 &&
      Number(item.audit_suggested_answer) < options.length
        ? Number(item.audit_suggested_answer)
        : Number.isInteger(Number(item.correct_option)) &&
            Number(item.correct_option) >= 0 &&
            Number(item.correct_option) < options.length
          ? Number(item.correct_option)
          : 0

    setManualEditingId(item.id)
    setManualDraft({
      correctOption: fallbackIdx,
      explanation: item.audit_suggested_explanation || item.explanation || ''
    })
  }

  const handleSaveManualEdit = async (item) => {
    setBusyItemId(item.id)
    try {
      await manualResolveAuditedQuestion(item.id, {
        correctOption: manualDraft.correctOption,
        explanation: manualDraft.explanation
      })
      setManualEditingId(null)
      await refreshAuditData(selectedScope, { silent: true })
      onQuestionsChanged?.({ reloadTable: true })
      notify('success', 'บันทึกการแก้ไขสำเร็จ', 'อัปเดตเฉลยและคำอธิบายด้วยตนเองพร้อมตั้งสถานะ verified เรียบร้อยแล้ว')
    } catch (error) {
      notify('danger', 'บันทึกไม่สำเร็จ', error.message)
    } finally {
      setBusyItemId('')
    }
  }

  const allVisibleSelected =
    filteredFlaggedItems.length > 0 && filteredFlaggedItems.every((item) => selectedFlaggedIds.includes(item.id))

  const handleToggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(filteredFlaggedItems.map((i) => i.id))
      setSelectedFlaggedIds((prev) => prev.filter((id) => !visibleSet.has(id)))
    } else {
      setSelectedFlaggedIds((prev) => [...new Set([...prev, ...filteredFlaggedItems.map((i) => i.id)])])
    }
  }

  const handleToggleSelectItem = (id) => {
    setSelectedFlaggedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleBulkAcceptSelected = () => {
    const selectedItems = flaggedItems.filter((item) => selectedFlaggedIds.includes(item.id))
    if (selectedItems.length === 0) return

    openConfirm({
      type: 'warning',
      title: `อนุมัติใช้เฉลย AI ทั้งหมด ${selectedItems.length} ข้อที่เลือก?`,
      description:
        'ระบบจะอัปเดตเฉลยจริง และแทนที่คำอธิบายเฉลยเดิมด้วยคำอธิบายใหม่ของ AI ทันที พร้อมตั้งสถานะ verified และล้างข้อมูลชั่วคราวออกทั้งหมด',
      confirmText: `ยืนยันอัปเดต ${selectedItems.length} ข้อ`,
      onConfirm: async () => {
        setBulkBusy(true)
        try {
          const res = await acceptAuditSuggestions(selectedItems)
          setSelectedFlaggedIds([])
          await refreshAuditData(selectedScope)
          onQuestionsChanged?.({ reloadTable: true })
          const skippedMsg =
            res.skippedCount > 0 ? ` (ข้าม ${res.skippedCount} ข้อที่ไม่มีเฉลยแนะนำจาก AI ต้องแก้ไขเอง)` : ''
          notify(
            'success',
            'อนุมัติแบบกลุ่มสำเร็จ',
            `อัปเดตเฉลยและคำอธิบายใหม่จำนวน ${res.updatedCount} ข้อเรียบร้อยแล้ว${skippedMsg}`
          )
        } catch (error) {
          notify('danger', 'อัปเดตไม่สำเร็จ', error.message)
        } finally {
          setBulkBusy(false)
        }
      }
    })
  }

  const handleBulkKeepSelected = () => {
    if (selectedFlaggedIds.length === 0) return
    openConfirm({
      type: 'info',
      title: `ยืนยันคงเฉลยเดิมทั้ง ${selectedFlaggedIds.length} ข้อที่เลือก?`,
      description:
        'ระบบจะไม่แก้เฉลยและคำอธิบายเดิม แต่จะตั้งสถานะเป็น verified และล้างข้อมูลคำแนะนำชั่วคราวออกเพื่อไม่ให้แจ้งเตือนซ้ำ',
      confirmText: `ยืนยันคงเฉลยเดิม (${selectedFlaggedIds.length} ข้อ)`,
      onConfirm: async () => {
        setBulkBusy(true)
        try {
          const count = await keepOriginalAnswers(selectedFlaggedIds)
          setSelectedFlaggedIds([])
          await refreshAuditData(selectedScope)
          onQuestionsChanged?.({ reloadTable: false })
          notify('success', 'ยืนยันคงเฉลยเดิมแล้ว', `ตั้งสถานะ verified ให้ข้อสอบจำนวน ${count} ข้อเรียบร้อยแล้ว`)
        } catch (error) {
          notify('danger', 'บันทึกไม่สำเร็จ', error.message)
        } finally {
          setBulkBusy(false)
        }
      }
    })
  }

  const handleSafeClose = () => {
    setShowKeyRequired(false)
    if (isAuditing) {
      openConfirm({
        type: 'warning',
        title: 'หยุดพักการตรวจทานและปิดหน้าต่าง?',
        description:
          'ข้อสอบทุกชุดที่ตรวจเสร็จก่อนหน้านี้ถูกบันทึกสถานะ verified/flagged ลง Supabase แล้ว ครั้งหน้ากดเริ่มจะข้ามข้อที่ตรวจแล้วอัตโนมัติ',
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

  return {
    activeTab,
    setActiveTab,
    selectedScope,
    handleScopeChange,
    stats,
    flaggedItems,
    filteredFlaggedItems,
    loadingData,
    dataError,
    categoryNameMap,
    limitMode,
    setLimitMode,
    customLimitInput,
    setCustomLimitInput,
    batchSizeInput,
    setBatchSizeInput,
    modelRoutingMode,
    setModelRoutingMode,
    selectedDeepModel,
    setSelectedDeepModel,
    liteModel,
    deepModel,
    targetScanCount,
    quotaEstimate,
    isAuditing,
    auditError,
    progress,
    handleStartAudit,
    handlePauseAudit,
    handleRequestResetAudit,
    flaggedSearch,
    setFlaggedSearch,
    selectedFlaggedIds,
    allVisibleSelected,
    handleToggleSelectAllVisible,
    handleToggleSelectItem,
    busyItemId,
    bulkBusy,
    manualEditingId,
    setManualEditingId,
    manualDraft,
    setManualDraft,
    handleAcceptSingle,
    handleKeepOriginalSingle,
    startManualEdit,
    handleSaveManualEdit,
    handleBulkAcceptSelected,
    handleBulkKeepSelected,
    showKeyRequired,
    setShowKeyRequired,
    confirmState,
    closeConfirm,
    handleSafeClose
  }
}
