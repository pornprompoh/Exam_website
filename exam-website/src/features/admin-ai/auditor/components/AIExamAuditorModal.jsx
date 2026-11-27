import AdminModalShell from '../../../../shared/components/AdminModalShell'
import ConfirmModal from '../../../../shared/components/ConfirmModal'
import { SettingsIcon, ShieldCheckIcon } from '../../../../shared/components/AdminIcons'
import AIKeyRequiredModal from '../../shared/components/AIKeyRequiredModal'
import { useExamAuditor } from '../hooks/useExamAuditor'
import AuditorScanTab from './AuditorScanTab'
import AuditorFlaggedTab from './AuditorFlaggedTab'

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
  const auditor = useExamAuditor({
    isOpen,
    onClose,
    categories,
    categoryId,
    initialTab,
    onNotify,
    onQuestionsChanged
  })

  if (!isOpen) return null

  const subHeader = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-xl border border-zinc-200 dark:border-[#272727] bg-zinc-100 dark:bg-[#1F1F1F] p-1">
        <button
          type="button"
          onClick={() => auditor.setActiveTab('scan')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ease-premium cursor-pointer ${
            auditor.activeTab === 'scan'
              ? 'bg-white dark:bg-[#272727] text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          สั่งตรวจทาน
        </button>
        <button
          type="button"
          onClick={() => auditor.setActiveTab('flagged')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ease-premium cursor-pointer inline-flex items-center gap-1.5 ${
            auditor.activeTab === 'flagged'
              ? 'bg-white dark:bg-[#272727] text-zinc-900 dark:text-zinc-100 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <span>รายการเฉลยผิดปกติ</span>
          <span
            className={`rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
              auditor.stats.flagged > 0
                ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                : 'bg-zinc-200 dark:bg-[#313131] text-zinc-500 dark:text-zinc-400'
            }`}
          >
            {auditor.stats.flagged}
          </span>
        </button>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0">ขอบเขต:</span>
        <select
          value={auditor.selectedScope}
          disabled={auditor.isAuditing}
          onChange={(e) => auditor.handleScopeChange(e.target.value)}
          className="h-9 max-w-xs truncate rounded-xl border border-zinc-200 dark:border-[#272727] bg-zinc-50 dark:bg-[#1F1F1F] px-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
        >
          <option value="ALL">ทั้งหมดทุกหมวดหมู่ในระบบ</option>
          {categories?.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )

  return (
    <>
      <AdminModalShell
        isOpen={isOpen}
        onClose={auditor.handleSafeClose}
        title="AI ตรวจทานความถูกต้องของเฉลย"
        titleId="ai-exam-auditor-title"
        icon={<ShieldCheckIcon className="w-4 h-4" />}
        headerActions={
          <button
            type="button"
            onClick={onGoToSettings}
            className="hidden sm:inline-flex items-center gap-1.5 h-9 rounded-xl border border-zinc-200 dark:border-[#272727] bg-zinc-50 hover:bg-zinc-100 dark:bg-[#1F1F1F] dark:hover:bg-[#272727] px-3 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
          >
            <SettingsIcon className="w-3.5 h-3.5 text-zinc-400" />
            <span>ตั้งค่า AI</span>
          </button>
        }
        subHeader={subHeader}
        maxWidth="max-w-5xl"
      >
        {auditor.dataError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 dark:border-rose-500/35 bg-rose-50 dark:bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-700 dark:text-rose-200"
          >
            {auditor.dataError}
          </div>
        )}

        {auditor.activeTab === 'scan' ? (
          <AuditorScanTab
            stats={auditor.stats}
            loadingData={auditor.loadingData}
            limitMode={auditor.limitMode}
            onLimitModeChange={auditor.setLimitMode}
            customLimitInput={auditor.customLimitInput}
            onCustomLimitChange={auditor.setCustomLimitInput}
            batchSizeInput={auditor.batchSizeInput}
            onBatchSizeChange={auditor.setBatchSizeInput}
            modelRoutingMode={auditor.modelRoutingMode}
            onModelRoutingModeChange={auditor.setModelRoutingMode}
            selectedDeepModel={auditor.selectedDeepModel}
            onSelectedDeepModelChange={auditor.setSelectedDeepModel}
            liteModel={auditor.liteModel}
            deepModel={auditor.deepModel}
            targetScanCount={auditor.targetScanCount}
            quotaEstimate={auditor.quotaEstimate}
            isAuditing={auditor.isAuditing}
            auditError={auditor.auditError}
            progress={auditor.progress}
            onStartAudit={auditor.handleStartAudit}
            onPauseAudit={auditor.handlePauseAudit}
            onRequestResetAudit={auditor.handleRequestResetAudit}
            onOpenFlaggedTab={() => auditor.setActiveTab('flagged')}
          />
        ) : (
          <AuditorFlaggedTab
            selectedScope={auditor.selectedScope}
            categoryNameMap={auditor.categoryNameMap}
            flaggedItems={auditor.flaggedItems}
            filteredFlaggedItems={auditor.filteredFlaggedItems}
            loadingData={auditor.loadingData}
            flaggedSearch={auditor.flaggedSearch}
            onFlaggedSearchChange={auditor.setFlaggedSearch}
            selectedFlaggedIds={auditor.selectedFlaggedIds}
            allVisibleSelected={auditor.allVisibleSelected}
            onToggleSelectAllVisible={auditor.handleToggleSelectAllVisible}
            onToggleSelectItem={auditor.handleToggleSelectItem}
            busyItemId={auditor.busyItemId}
            bulkBusy={auditor.bulkBusy}
            manualEditingId={auditor.manualEditingId}
            manualDraft={auditor.manualDraft}
            onManualDraftChange={auditor.setManualDraft}
            onStartManualEdit={auditor.startManualEdit}
            onCancelManualEdit={() => auditor.setManualEditingId(null)}
            onSaveManualEdit={auditor.handleSaveManualEdit}
            onKeepOriginalSingle={auditor.handleKeepOriginalSingle}
            onAcceptSingle={auditor.handleAcceptSingle}
            onBulkKeepSelected={auditor.handleBulkKeepSelected}
            onBulkAcceptSelected={auditor.handleBulkAcceptSelected}
          />
        )}
      </AdminModalShell>

      {auditor.showKeyRequired && (
        <AIKeyRequiredModal
          onClose={() => auditor.setShowKeyRequired(false)}
          onGoToSettings={onGoToSettings}
        />
      )}

      <ConfirmModal
        isOpen={auditor.confirmState.isOpen}
        type={auditor.confirmState.type}
        title={auditor.confirmState.title}
        description={<span className="whitespace-pre-line">{auditor.confirmState.description}</span>}
        confirmText={auditor.confirmState.confirmText}
        cancelText="ยกเลิก"
        onClose={auditor.closeConfirm}
        onConfirm={() => auditor.confirmState.onConfirm?.()}
      />
    </>
  )
}
