import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { getGeminiApiKey } from '../../lib/geminiApiKey'
import {
  DEFAULT_STANDARD_MODEL,
  GEMINI_STANDARD_MODELS,
  getGeminiModelLabel,
  resolveHybridModelPair
} from '../../lib/geminiModels'
import {
  DEFAULT_AUDITOR_BATCH_SIZE,
  MAX_AUDITOR_BATCH_SIZE,
  MIN_AUDITOR_BATCH_SIZE,
  acceptAuditSuggestions,
  estimateAuditQuota,
  fetchCategoryAuditStats,
  fetchFlaggedQuestions,
  keepOriginalAnswers,
  manualResolveAuditedQuestion,
  resetAuditStatus,
  runAnswerAuditPipeline
} from '../../lib/aiExamAuditorService'
import AIKeyRequiredModal from './AIKeyRequiredModal'
import ConfirmModal from '../common/ConfirmModal'

function getChoiceLetter(idx) {
  return String.fromCharCode(65 + idx)
}

const AUDIT_STAGES = [
  { stage: 0, label: 'ด่าน 0', title: 'Local Pre-Check (0 Quota)' },
  { stage: 1, label: 'ด่าน 1', title: 'Mega-Batch คัดกรอง (Flash Lite)' },
  { stage: 2, label: 'ด่าน 2', title: 'ยืนยันเชิงลึก (Flash Standard)' }
]

export default function AIExamAuditorModal({
  isOpen,
  onClose,
  categories,
  categoryId,
  initialTab = 'scan',
  onNotify,
  onGoToSettings,
  onQuestionsChanged
}) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [selectedScope, setSelectedScope] = useState(categoryId || 'ALL')

  // DB Stats & Flagged items
  const [stats, setStats] = useState({ total: 0, unchecked: 0, verified: 0, flagged: 0 })
  const [flaggedItems, setFlaggedItems] = useState([])
  const [loadingData, setLoadingData] = useState(false)
  const [dataError, setDataError] = useState('')
  const loadSeqRef = useRef(0)

  // Scan configuration
  const [limitMode, setLimitMode] = useState('all') // 'all' | 'custom'
  const [customLimitInput, setCustomLimitInput] = useState('200')
  const [batchSizeInput, setBatchSizeInput] = useState(String(DEFAULT_AUDITOR_BATCH_SIZE))
  const [modelRoutingMode, setModelRoutingMode] = useState('hybrid') // 'hybrid' | 'lite_only'
  const [selectedDeepModel, setSelectedDeepModel] = useState(() => {
    const pair = resolveHybridModelPair()
    return pair.deepModel || DEFAULT_STANDARD_MODEL
  })

  // Running audit state
  const [isAuditing, setIsAuditing] = useState(false)
  const [auditError, setAuditError] = useState('')
  const [progress, setProgress] = useState(null)
  const abortControllerRef = useRef(null)

  // Flagged Review state
  const [flaggedSearch, setFlaggedSearch] = useState('')
  const [selectedFlaggedIds, setSelectedFlaggedIds] = useState([])
  const [busyItemId, setBusyItemId] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [manualEditingId, setManualEditingId] = useState(null)
  const [manualDraft, setManualDraft] = useState({ correctOption: 0, explanation: '' })

  // Key & Confirm modals
  const [showKeyRequired, setShowKeyRequired] = useState(false)
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    type: 'warning',
    title: '',
    description: '',
    confirmText: 'ยืนยัน',
    onConfirm: null
  })

  const notify = useCallback((type, title, description) => {
    onNotify?.(type, title, description)
  }, [onNotify])

  const categoryNameMap = useMemo(() => {
    const map = new Map()
    for (const cat of categories || []) {
      map.set(cat.id, cat.name)
    }
    return map
  }, [categories])

  const { liteModel, deepModel } = resolveHybridModelPair(selectedDeepModel)

  const refreshAuditData = useCallback(async (scope = selectedScope, { silent = false } = {}) => {
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
  }, [selectedScope])

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

  useEffect(() => () => {
    abortControllerRef.current?.abort()
  }, [])

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
    return flaggedItems.filter((item) => (
      (item.question_text || '').toLowerCase().includes(q) ||
      (item.audit_reason || '').toLowerCase().includes(q) ||
      (categoryNameMap.get(item.category_id) || '').toLowerCase().includes(q)
    ))
  }, [flaggedItems, flaggedSearch, categoryNameMap])

  if (!isOpen) return null

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
      return notify('info', 'ตรวจครบทุกข้อแล้ว', 'ไม่พบข้อสอบสถานะ unchecked ในขอบเขตที่เลือก หากต้องการตรวจใหม่กรุณากด "รีเซ็ตสถานะเพื่อตรวจใหม่"')
    }

    const parsedBatch = parseInt(batchSizeInput, 10)
    if (Number.isNaN(parsedBatch) || parsedBatch < MIN_AUDITOR_BATCH_SIZE || parsedBatch > MAX_AUDITOR_BATCH_SIZE) {
      return notify('warning', 'ขนาด Mega-Batch ไม่ถูกต้อง', `กรุณาระบุขนาด Mega-Batch ระหว่าง ${MIN_AUDITOR_BATCH_SIZE} ถึง ${MAX_AUDITOR_BATCH_SIZE} ข้อต่อรอบ`)
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
          'ตรวจทานเฉลยเสร็จสมบูรณ์!',
          `ตรวจผ่าน ${totalVerifiedNow} ข้อ · พบเฉลยอาจผิด (Flagged) ${totalFlaggedNow} ข้อ (ใช้ Flash Lite ${result.runStats.stage1Requests} req · Flash Standard ${result.runStats.stage2Requests} req)`
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
    const scopeLabel = selectedScope === 'ALL'
      ? 'ทั้งหมดทุกหมวดหมู่ในระบบ'
      : `วิชา "${categoryNameMap.get(selectedScope) || ''}"`

    openConfirm({
      type: 'warning',
      title: `รีเซ็ตสถานะการตรวจทานของ ${scopeLabel}?`,
      description: 'ข้อสอบทั้งหมดในขอบเขตนี้จะถูกรีเซ็ตกลับเป็น "ยังไม่ตรวจ (unchecked)" และล้างข้อมูลคำแนะนำชั่วคราว (ไม่กระทบเฉลยจริงและคำอธิบายเดิมของข้อสอบ)',
      confirmText: '🔄 ยืนยันรีเซ็ตสถานะ',
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

  // Single-item Resolve Handlers
  const handleAcceptSingle = async (item) => {
    setBusyItemId(item.id)
    try {
      const res = await acceptAuditSuggestions([item])
      if (res.updatedCount === 0) {
        notify('warning', 'ไม่มีเฉลยแนะนำที่ใช้งานได้', 'ข้อสอบข้อนี้ถูกติด Flag จากด่าน 0 (โครงสร้างเฉลยผิดปกติ) กรุณากด "แก้ไขเอง" เพื่อระบุเฉลยที่ถูกต้องครับ')
        return
      }
      await refreshAuditData(selectedScope, { silent: true })
      onQuestionsChanged?.({ reloadTable: true })
      notify('success', 'อัปเดตเฉลยและคำอธิบายแล้ว!', 'บันทึกเฉลยใหม่พร้อมคำอธิบายเฉลยใหม่ และล้างค่าชั่วคราวเรียบร้อยครับ')
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
        : (Number.isInteger(Number(item.correct_option)) && Number(item.correct_option) >= 0 && Number(item.correct_option) < options.length
            ? Number(item.correct_option)
            : 0)

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
      notify('success', 'บันทึกการแก้ไขสำเร็จ!', 'อัปเดตเฉลยและคำอธิบายด้วยตนเอง พร้อมเปลี่ยนสถานะเป็น verified เรียบร้อยครับ')
    } catch (error) {
      notify('danger', 'บันทึกไม่สำเร็จ', error.message)
    } finally {
      setBusyItemId('')
    }
  }

  // Bulk Resolve Handlers
  const allVisibleSelected =
    filteredFlaggedItems.length > 0 &&
    filteredFlaggedItems.every((item) => selectedFlaggedIds.includes(item.id))

  const handleToggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(filteredFlaggedItems.map((i) => i.id))
      setSelectedFlaggedIds((prev) => prev.filter((id) => !visibleSet.has(id)))
    } else {
      setSelectedFlaggedIds((prev) => [...new Set([...prev, ...filteredFlaggedItems.map((i) => i.id)])])
    }
  }

  const handleToggleSelectItem = (id) => {
    setSelectedFlaggedIds((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    ))
  }

  const handleBulkAcceptSelected = () => {
    const selectedItems = flaggedItems.filter((item) => selectedFlaggedIds.includes(item.id))
    if (selectedItems.length === 0) return

    openConfirm({
      type: 'warning',
      title: `อนุมัติใช้เฉลย AI ทั้งหมด ${selectedItems.length} ข้อที่เลือก?`,
      description: 'ระบบจะอัปเดตเฉลยจริง และแทนที่คำอธิบายเฉลยเดิมด้วยคำอธิบายใหม่ของ AI ทันที พร้อมตั้งสถานะ verified และล้างข้อมูลชั่วคราวออกทั้งหมด',
      confirmText: `✅ ยืนยันอัปเดต ${selectedItems.length} ข้อ`,
      onConfirm: async () => {
        setBulkBusy(true)
        try {
          const res = await acceptAuditSuggestions(selectedItems)
          setSelectedFlaggedIds([])
          await refreshAuditData(selectedScope)
          onQuestionsChanged?.({ reloadTable: true })
          const skippedMsg = res.skippedCount > 0 ? ` (ข้าม ${res.skippedCount} ข้อที่ไม่มีเฉลยแนะนำจาก AI ต้องแก้ไขเอง)` : ''
          notify('success', 'อนุมัติแบบกลุ่มสำเร็จ!', `อัปเดตเฉลยและคำอธิบายใหม่จำนวน ${res.updatedCount} ข้อเรียบร้อยแล้ว${skippedMsg}`)
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
      description: 'ระบบจะไม่แก้เฉลยและคำอธิบายเดิม แต่จะตั้งสถานะเป็น verified และล้างข้อมูลคำแนะนำชั่วคราวออกเพื่อไม่ให้แจ้งเตือนซ้ำ',
      confirmText: `🛡️ ยืนยันคงเฉลยเดิม (${selectedFlaggedIds.length} ข้อ)`,
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
        description: 'ข้อสอบทุกชุดที่ตรวจเสร็จก่อนหน้านี้ถูกบันทึกสถานะ verified/flagged ลง Supabase แล้ว ครั้งหน้ากดเริ่มจะข้ามข้อที่ตรวจแล้วอัตโนมัติครับ',
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

  const runStats = progress?.runStats || null
  const activeStage = progress?.stage ?? 0
  const progressPercent = runStats?.totalScannedTarget > 0
    ? Math.min(100, Math.round((runStats.processedCount / runStats.totalScannedTarget) * 100))
    : progress?.status === 'completed'
      ? 100
      : 0

  return (
    <div
      role="presentation"
      onClick={handleSafeClose}
      className="fixed inset-0 z-[1000] bg-black/65 backdrop-blur-xs flex justify-end"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-exam-auditor-title"
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-5xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden relative animate-slideLeft"
      >
        {/* Header */}
        <header className="p-5 sm:p-6 border-b border-slate-800 sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-11 h-11 rounded-2xl bg-violet-500/15 text-violet-300 border border-violet-500/30 flex items-center justify-center text-xl shrink-0">
                🔍
              </span>
              <div className="min-w-0">
                <h2 id="ai-exam-auditor-title" className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                  AI ตรวจทานความถูกต้องของเฉลย (AI Answer Auditor)
                </h2>
                <p className="text-xs text-slate-400 truncate">
                  ตรวจเฉพาะความถูกต้องของเฉลยด้วย Exception-Only Mega-Batch (3 ด่าน) · ไม่แก้ทับอัตโนมัติ รอแอดมินอนุมัติเท่านั้น
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onGoToSettings}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] font-bold text-slate-300 hover:border-violet-500/50 hover:text-white transition-colors cursor-pointer"
              >
                <span>⚙️</span>
                <span>ตั้งค่า AI</span>
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

          {/* Tabs + Scope Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-2xl border border-slate-800 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('scan')}
                className={`rounded-xl px-4 py-2 text-xs font-black transition-all cursor-pointer ${
                  activeTab === 'scan'
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🛡️ สั่งตรวจทาน (Scan & Audit)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('flagged')}
                className={`rounded-xl px-4 py-2 text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === 'flagged'
                    ? 'bg-rose-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🚩 รายการเฉลยผิดปกติ (Flagged)</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-mono font-black ${
                  activeTab === 'flagged'
                    ? 'bg-white/20 text-white'
                    : stats.flagged > 0
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-800 text-slate-400'
                }`}>
                  {stats.flagged}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-slate-400 shrink-0">ขอบเขต:</span>
              <select
                value={selectedScope}
                disabled={isAuditing}
                onChange={(e) => handleScopeChange(e.target.value)}
                className="max-w-xs truncate rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white outline-none focus:border-violet-500 disabled:opacity-50 cursor-pointer"
              >
                <option value="ALL">🌐 ทั้งหมดทุกหมวดหมู่ในระบบ</option>
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
        <div className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-5">
          {dataError && (
            <div role="alert" className="rounded-2xl border border-red-500/35 bg-red-500/10 p-4 text-xs font-bold text-red-200">
              ⚠️ {dataError}
            </div>
          )}

          {activeTab === 'scan' ? (
            <div className="space-y-5">
              {/* 4 Live Category Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-[11px] font-bold text-slate-400">ข้อสอบทั้งหมด</p>
                  <p className="mt-1 text-2xl font-black font-mono text-white">{stats.total.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <p className="text-[11px] font-bold text-amber-300">⏳ ยังไม่ตรวจ (unchecked)</p>
                  <p className="mt-1 text-2xl font-black font-mono text-amber-400">{stats.unchecked.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="text-[11px] font-bold text-emerald-300">✅ ตรวจผ่านแล้ว (verified)</p>
                  <p className="mt-1 text-2xl font-black font-mono text-emerald-400">{stats.verified.toLocaleString()}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('flagged')}
                  className="text-left rounded-2xl border border-rose-500/35 bg-rose-500/10 hover:bg-rose-500/15 p-4 transition-colors cursor-pointer"
                >
                  <p className="text-[11px] font-bold text-rose-300">🚩 พบเฉลยอาจผิด (flagged)</p>
                  <p className="mt-1 text-2xl font-black font-mono text-rose-400">{stats.flagged.toLocaleString()}</p>
                </button>
              </div>

              {/* Audit Configuration Panel */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
                    ⚙️ ตั้งค่าการตรวจทาน (ประหยัดโควต้าสูงสุด)
                  </h3>
                  <button
                    type="button"
                    disabled={isAuditing || stats.total === 0}
                    onClick={handleRequestResetAudit}
                    className="rounded-xl border border-slate-700 bg-slate-900 hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-40 px-3 py-1.5 text-[11px] font-bold text-slate-300 transition-colors cursor-pointer"
                  >
                    🔄 รีเซ็ตสถานะเพื่อตรวจใหม่
                  </button>
                </div>

                {/* Limit & Mega-Batch Size */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-400">จำนวนข้อที่ต้องการตรวจรอบนี้</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={limitMode}
                        disabled={isAuditing}
                        onChange={(e) => setLimitMode(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-violet-500 cursor-pointer"
                      >
                        <option value="all">ตรวจที่เหลือทั้งหมด ({stats.unchecked.toLocaleString()} ข้อ)</option>
                        <option value="custom">จำกัดจำนวนข้อเอง</option>
                      </select>
                      {limitMode === 'custom' && (
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, stats.unchecked)}
                          disabled={isAuditing}
                          value={customLimitInput}
                          onChange={(e) => setCustomLimitInput(e.target.value)}
                          className="w-28 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-mono font-bold text-white outline-none focus:border-violet-500"
                          placeholder="เช่น 200"
                        />
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-400">
                      ขนาด Mega-Batch ({MIN_AUDITOR_BATCH_SIZE}–{MAX_AUDITOR_BATCH_SIZE} ข้อ/รอบ · แนะนำ 40)
                    </label>
                    <input
                      type="number"
                      min={MIN_AUDITOR_BATCH_SIZE}
                      max={MAX_AUDITOR_BATCH_SIZE}
                      disabled={isAuditing}
                      value={batchSizeInput}
                      onChange={(e) => setBatchSizeInput(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-mono font-bold text-white outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                {/* Model Routing Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className={`rounded-2xl border p-3.5 cursor-pointer transition-all flex items-start gap-3 ${
                    modelRoutingMode === 'hybrid'
                      ? 'border-violet-500/60 bg-violet-500/10 ring-1 ring-violet-500/30'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="auditorModelMode"
                      value="hybrid"
                      disabled={isAuditing}
                      checked={modelRoutingMode === 'hybrid'}
                      onChange={() => setModelRoutingMode('hybrid')}
                      className="mt-1 accent-violet-500 cursor-pointer"
                    />
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="text-xs font-black text-white">🧠 Hybrid: Flash Lite + Flash Standard (แนะนำ)</p>
                      <p className="text-[11px] leading-relaxed text-slate-400">
                        ด่าน 1 คัดกรอง Exception-Only ด้วย {getGeminiModelLabel(liteModel)} (500 RPD) · ด่าน 2 ยืนยันตัด False Positive ด้วย Flash Standard (20 RPD + Auto-Fallback)
                      </p>
                      {modelRoutingMode === 'hybrid' && GEMINI_STANDARD_MODELS.length > 0 && (
                        <select
                          value={selectedDeepModel}
                          disabled={isAuditing}
                          onChange={(e) => setSelectedDeepModel(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-violet-500/40 bg-slate-950 px-2.5 py-1.5 text-[11px] font-bold text-violet-200 outline-none focus:border-violet-400 cursor-pointer"
                        >
                          {GEMINI_STANDARD_MODELS.map((m) => (
                            <option key={m.value} value={m.value}>
                              ด่าน 2 ยืนยันเชิงลึก: {m.label}
                            </option>
                          ))}
                        </select>
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
                      name="auditorModelMode"
                      value="lite_only"
                      disabled={isAuditing}
                      checked={modelRoutingMode === 'lite_only'}
                      onChange={() => setModelRoutingMode('lite_only')}
                      className="mt-1 accent-sky-500 cursor-pointer"
                    />
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs font-black text-white">⚡ Flash Lite อย่างเดียว</p>
                      <p className="text-[11px] leading-relaxed text-slate-400">
                        ใช้ {getGeminiModelLabel(liteModel)} (15 RPM / 500 RPD) ทั้งด่าน 1 และด่าน 2 ไม่แตะโควตา Flash Standard
                      </p>
                    </div>
                  </label>
                </div>

                {/* Live Quota Estimator */}
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-emerald-200">
                    📊 ประมาณการโควต้า: {quotaEstimate.summaryText}
                  </span>
                  <span className="text-[11px] text-emerald-300/80">
                    ด่าน 2 ใช้ {modelRoutingMode === 'hybrid' ? getGeminiModelLabel(deepModel) : getGeminiModelLabel(liteModel)}
                  </span>
                </div>
              </div>

              {/* Start / Pause Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                {!isAuditing ? (
                  <button
                    type="button"
                    disabled={loadingData || stats.unchecked === 0 || targetScanCount === 0}
                    onClick={handleStartAudit}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-violet-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>🔍</span>
                    <span>
                      {stats.unchecked === 0
                        ? 'ตรวจครบทุกข้อแล้ว'
                        : `เริ่มตรวจทานเฉลย ${targetScanCount.toLocaleString()} ข้อ (ข้ามข้อที่ตรวจแล้วอัตโนมัติ)`}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePauseAudit}
                    className="flex-1 rounded-2xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 px-5 py-3.5 text-sm font-black text-amber-300 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>⏸️</span>
                    <span>หยุดพักชั่วคราว (เซฟผลทุก Batch แล้ว รอบหน้าตรวจต่ออัตโนมัติ)</span>
                  </button>
                )}

                {stats.flagged > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('flagged')}
                    className="rounded-2xl border border-rose-500/35 bg-rose-500/15 hover:bg-rose-500/25 px-4 py-3.5 text-xs font-black text-rose-200 transition-colors cursor-pointer shrink-0"
                  >
                    🚩 เปิดตรวจรายการ Flagged ({stats.flagged}) →
                  </button>
                )}
              </div>

              {/* Real-Time 3-Stage Progress Dashboard */}
              {(isAuditing || progress) && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {AUDIT_STAGES.map((st) => {
                      const isDone = progress?.status === 'completed' || activeStage > st.stage
                      const isCurrent = !isDone && activeStage === st.stage
                      return (
                        <div
                          key={st.stage}
                          className={`rounded-xl border px-3 py-2.5 flex items-center gap-2.5 ${
                            isDone
                              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                              : isCurrent
                                ? 'border-violet-500/50 bg-violet-500/15 text-white'
                                : 'border-slate-800 bg-slate-900/60 text-slate-500'
                          }`}
                        >
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                            isDone ? 'bg-emerald-500 text-slate-950' : isCurrent ? 'bg-violet-500 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {isDone ? '✓' : st.stage}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-wider opacity-80">{st.label}</p>
                            <p className="text-xs font-bold truncate">{st.title}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {isAuditing && (
                          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent shrink-0" />
                        )}
                        <span className="font-bold text-slate-200 truncate">{progress?.statusMessage}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {progress?.activeModelLabel && (
                          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-bold text-indigo-200">
                            🤖 {progress.activeModelLabel}
                          </span>
                        )}
                        <span className="font-mono font-black text-violet-300">{progressPercent}%</span>
                      </div>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          progress?.status === 'error'
                            ? 'bg-red-500'
                            : progress?.status === 'paused'
                              ? 'bg-amber-500'
                              : 'bg-gradient-to-r from-violet-500 via-indigo-500 to-emerald-400'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {runStats?.fallbackTriggered && runStats?.fallbackNotice && (
                    <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-200">
                      ⚠️ Auto-Fallback: {runStats.fallbackNotice}
                    </div>
                  )}

                  {auditError && (
                    <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                      <strong className="text-red-300">⚠️ เกิดข้อผิดพลาด: </strong>{auditError}
                    </div>
                  )}

                  {runStats && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
                        <p className="text-[10px] font-bold text-slate-400">ความคืบหน้ารอบนี้</p>
                        <p className="text-sm font-black font-mono text-white">{runStats.processedCount}/{runStats.totalScannedTarget}</p>
                      </div>
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                        <p className="text-[10px] font-bold text-emerald-300">ผ่านด่าน 1 ทันที</p>
                        <p className="text-sm font-black font-mono text-emerald-400">{runStats.stage1Verified}</p>
                      </div>
                      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-2.5">
                        <p className="text-[10px] font-bold text-sky-300">ตัด False Positive</p>
                        <p className="text-sm font-black font-mono text-sky-300">{runStats.stage2FalsePositivesCleared}</p>
                      </div>
                      <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-2.5">
                        <p className="text-[10px] font-bold text-rose-300">ติด Flag ยืนยันแล้ว</p>
                        <p className="text-sm font-black font-mono text-rose-400">{runStats.stage0Flagged + runStats.stage2ConfirmedFlagged}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5 col-span-2 sm:col-span-1">
                        <p className="text-[10px] font-bold text-slate-400">API ใช้ไป</p>
                        <p className="text-xs font-black font-mono text-indigo-300">
                          L:{runStats.stage1Requests} · S:{runStats.stage2Requests}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: FLAGGED REVIEW (HUMAN-IN-THE-LOOP APPROVAL) */
            <div className="space-y-4">
              {/* Search & Bulk Action Bar */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/85 p-4 space-y-3">
                <input
                  type="search"
                  value={flaggedSearch}
                  onChange={(e) => setFlaggedSearch(e.target.value)}
                  placeholder="ค้นหาโจทย์, เหตุผล หรือชื่อหมวดหมู่ในรายการที่ติด Flag..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-rose-500"
                />

                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      disabled={filteredFlaggedItems.length === 0}
                      onChange={handleToggleSelectAllVisible}
                      className="h-4 w-4 accent-rose-500 rounded cursor-pointer"
                    />
                    <span>เลือกทั้งหมดที่แสดง ({selectedFlaggedIds.length}/{flaggedItems.length})</span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={selectedFlaggedIds.length === 0 || bulkBusy}
                      onClick={handleBulkKeepSelected}
                      className="rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-3.5 py-2 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                    >
                      🛡️ ยืนยันคงเฉลยเดิมที่เลือก ({selectedFlaggedIds.length})
                    </button>
                    <button
                      type="button"
                      disabled={selectedFlaggedIds.length === 0 || bulkBusy}
                      onClick={handleBulkAcceptSelected}
                      className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 px-4 py-2 text-xs font-black text-white shadow transition-all cursor-pointer"
                    >
                      {bulkBusy ? '⏳ กำลังบันทึก...' : `✅ อนุมัติใช้เฉลย AI ที่เลือก (${selectedFlaggedIds.length})`}
                    </button>
                  </div>
                </div>
              </div>

              {/* Flagged Cards List */}
              {loadingData ? (
                <div className="py-12 text-center text-xs font-bold text-slate-400">
                  ⏳ กำลังโหลดรายการเฉลยผิดปกติ...
                </div>
              ) : filteredFlaggedItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 p-10 text-center space-y-2">
                  <p className="text-3xl">🎉</p>
                  <p className="text-sm font-black text-white">
                    {flaggedItems.length === 0
                      ? 'ไม่พบข้อสอบที่ติดสถานะ Flagged ในขอบเขตนี้!'
                      : 'ไม่พบรายการที่ตรงกับคำค้นหา'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {flaggedItems.length === 0
                      ? 'เฉลยทั้งหมดที่ตรวจแล้วถูกต้องเรียบร้อย หรือกดไปที่แท็บ "สั่งตรวจทาน" เพื่อตรวจข้อที่ยังไม่ได้ตรวจครับ'
                      : 'ลองเปลี่ยนคำค้นหาดูครับ'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredFlaggedItems.map((item, idx) => {
                    const options = Array.isArray(item.options) ? item.options : []
                    const currentIdx = Number.isInteger(Number(item.correct_option)) ? Number(item.correct_option) : -1
                    const suggestedIdx =
                      item.audit_suggested_answer !== null &&
                      item.audit_suggested_answer !== undefined &&
                      Number.isInteger(Number(item.audit_suggested_answer))
                        ? Number(item.audit_suggested_answer)
                        : -1
                    const isSelected = selectedFlaggedIds.includes(item.id)
                    const isEditingManual = manualEditingId === item.id
                    const isItemBusy = busyItemId === item.id || bulkBusy

                    return (
                      <article
                        key={item.id}
                        className={`rounded-2xl border bg-slate-950 p-4 sm:p-5 space-y-4 transition-colors ${
                          isSelected ? 'border-rose-500/60 ring-1 ring-rose-500/20' : 'border-slate-800'
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectItem(item.id)}
                              className="h-4 w-4 accent-rose-500 rounded cursor-pointer shrink-0"
                            />
                            <span className="text-xs font-black text-rose-300">🚩 Flagged #{idx + 1}</span>
                            {selectedScope === 'ALL' && categoryNameMap.get(item.category_id) && (
                              <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-slate-300">
                                📖 {categoryNameMap.get(item.category_id)}
                              </span>
                            )}
                            {item.audit_model && (
                              <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-bold text-indigo-300">
                                🤖 {item.audit_model === 'local-precheck' ? 'ด่าน 0 Local Pre-Check' : getGeminiModelLabel(item.audit_model)}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-500">
                            ID: {item.id.slice(0, 8)}
                          </span>
                        </div>

                        {/* Full Question Stem */}
                        <div className="space-y-2">
                          <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-white break-words">
                            {item.question_text}
                          </p>
                          {item.image_url && (
                            <div className="inline-block rounded-xl border border-slate-800 bg-slate-900 p-2">
                              <img src={item.image_url} alt="รูปประกอบโจทย์" className="max-h-48 w-auto rounded-lg object-contain" loading="lazy" />
                            </div>
                          )}
                        </div>

                        {/* Options Comparison (Red/Orange = Current, Emerald = AI Suggested) */}
                        {!isEditingManual ? (
                          <ul className="grid gap-2 sm:grid-cols-2">
                            {options.map((opt, optIdx) => {
                              const isCurrent = optIdx === currentIdx
                              const isSuggested = optIdx === suggestedIdx
                              return (
                                <li
                                  key={optIdx}
                                  className={`flex items-start gap-2 rounded-xl border p-3 text-sm leading-relaxed ${
                                    isSuggested
                                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/25'
                                      : isCurrent
                                        ? 'border-rose-500/50 bg-rose-500/15 text-rose-100 ring-1 ring-rose-500/25'
                                        : 'border-slate-800 bg-slate-900/70 text-slate-300'
                                  }`}
                                >
                                  <span className={`mt-0.5 shrink-0 text-xs font-black ${
                                    isSuggested ? 'text-emerald-400' : isCurrent ? 'text-rose-400' : 'text-slate-500'
                                  }`}>
                                    {getChoiceLetter(optIdx)}
                                  </span>
                                  <span className="whitespace-pre-wrap break-words flex-1">{opt}</span>
                                  {isCurrent && (
                                    <span className="ml-auto shrink-0 rounded-md bg-rose-500/25 px-1.5 py-0.5 text-[10px] font-black text-rose-200">
                                      เฉลยปัจจุบัน
                                    </span>
                                  )}
                                  {isSuggested && (
                                    <span className="ml-auto shrink-0 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
                                      AI แนะนำ
                                    </span>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        ) : (
                          /* Inline Manual Edit Form */
                          <div className="rounded-2xl border border-indigo-500/40 bg-indigo-950/20 p-4 space-y-3">
                            <p className="text-xs font-black text-indigo-300">✏️ แก้ไขเฉลยและคำอธิบายด้วยตนเอง</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {options.map((opt, optIdx) => (
                                <label
                                  key={optIdx}
                                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs cursor-pointer transition-colors ${
                                    Number(manualDraft.correctOption) === optIdx
                                      ? 'border-emerald-500/60 bg-emerald-500/15 text-white font-bold'
                                      : 'border-slate-800 bg-slate-900 text-slate-300'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`manual-correct-${item.id}`}
                                    checked={Number(manualDraft.correctOption) === optIdx}
                                    onChange={() => setManualDraft((d) => ({ ...d, correctOption: optIdx }))}
                                    className="mt-0.5 accent-emerald-500 cursor-pointer"
                                  />
                                  <span className="break-words"><strong>{getChoiceLetter(optIdx)}.</strong> {opt}</span>
                                </label>
                              ))}
                            </div>
                            <label className="block space-y-1">
                              <span className="text-xs font-bold text-slate-300">คำอธิบายเฉลย</span>
                              <textarea
                                rows={3}
                                value={manualDraft.explanation}
                                onChange={(e) => setManualDraft((d) => ({ ...d, explanation: e.target.value }))}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-white outline-none focus:border-indigo-500"
                              />
                            </label>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                disabled={isItemBusy}
                                onClick={() => setManualEditingId(null)}
                                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 cursor-pointer"
                              >
                                ยกเลิก
                              </button>
                              <button
                                type="button"
                                disabled={isItemBusy}
                                onClick={() => handleSaveManualEdit(item)}
                                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-black text-white cursor-pointer"
                              >
                                {isItemBusy ? '⏳ กำลังบันทึก...' : '💾 บันทึกและตั้งสถานะ verified'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Audit Reason */}
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-1">
                          <p className="text-[11px] font-black text-amber-300">🔎 เหตุผลที่ตรวจพบความผิดปกติ (audit_reason)</p>
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-amber-100 break-words">
                            {item.audit_reason || 'ไม่มีรายละเอียดเหตุผล'}
                          </p>
                        </div>

                        {/* Explanation Preview (Current vs Suggested Replacement) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1">
                            <p className="text-[11px] font-bold text-slate-400">คำอธิบายเดิมในคลัง</p>
                            <p className="whitespace-pre-wrap leading-relaxed text-slate-300 break-words">
                              {item.explanation || '(ไม่มีคำอธิบายเดิม)'}
                            </p>
                          </div>
                          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 space-y-1">
                            <p className="text-[11px] font-bold text-emerald-300">💡 ตัวอย่างคำอธิบายเฉลยใหม่ (จะนำมาแทนที่เมื่ออนุมัติ AI)</p>
                            <p className="whitespace-pre-wrap leading-relaxed text-emerald-100/90 break-words">
                              {item.audit_suggested_explanation || '(ไม่มีคำอธิบายแนะนำ — กดแก้ไขเองเพื่อระบุ)'}
                            </p>
                          </div>
                        </div>

                        {/* 1-Click Resolution Buttons */}
                        {!isEditingManual && (
                          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-3">
                            <button
                              type="button"
                              disabled={isItemBusy}
                              onClick={() => startManualEdit(item)}
                              className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-40 px-3.5 py-2 text-xs font-bold text-indigo-300 transition-colors cursor-pointer"
                            >
                              ✏️ แก้ไขเอง
                            </button>
                            <button
                              type="button"
                              disabled={isItemBusy}
                              onClick={() => handleKeepOriginalSingle(item)}
                              className="rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-3.5 py-2 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                            >
                              🛡️ คงเฉลยเดิม (ไม่แก้)
                            </button>
                            <button
                              type="button"
                              disabled={isItemBusy || suggestedIdx < 0}
                              onClick={() => handleAcceptSingle(item)}
                              className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 px-4 py-2 text-xs font-black text-white shadow transition-all cursor-pointer"
                            >
                              {isItemBusy ? '⏳ กำลังบันทึก...' : '✅ ใช้เฉลยที่ AI แนะนำ'}
                            </button>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
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
