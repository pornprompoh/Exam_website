import { getGeminiModelLabel } from '../../../../shared/lib/geminiModels'
import AdminModalShell from '../../../../shared/components/AdminModalShell'
import ConfirmModal from '../../../../shared/components/ConfirmModal'
import { FileExtractIcon, SettingsIcon } from '../../../../shared/components/AdminIcons'
import AIKeyRequiredModal from '../../shared/components/AIKeyRequiredModal'
import { useExamExtractor } from '../hooks/useExamExtractor'
import ExtractorStepperBar from './ExtractorStepperBar'
import ExtractorUploadTab from './ExtractorUploadTab'
import ExtractorStagingTab from './ExtractorStagingTab'
import OverrideReasonModal from './OverrideReasonModal'

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
  const extractor = useExamExtractor({
    isOpen,
    onClose,
    categories,
    categoryId,
    currentUserId,
    initialTab,
    onSuccess,
    onNotify,
    onStagingCountChange
  })

  if (!isOpen) return null

  const subHeader = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-1">
        <button
          type="button"
          onClick={() => extractor.setActiveTab('extract')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
            extractor.activeTab === 'extract'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          สกัดข้อสอบ (3-Pass)
        </button>
        <button
          type="button"
          onClick={() => extractor.setActiveTab('staging')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
            extractor.activeTab === 'staging'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>ตรวจสอบ Draft</span>
          <span
            className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
              extractor.displayedDraftCount > 0
                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            {extractor.displayedDraftCount}
          </span>
          {extractor.statusCounts.ai_overridden > 0 && (
            <span
              className="rounded-md bg-rose-100 dark:bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-rose-700 dark:text-rose-300"
              title="ข้อที่ AI แก้เฉลย"
            >
              แก้เฉลย {extractor.statusCounts.ai_overridden}
            </span>
          )}
        </button>
      </div>

      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">หมวดหมู่:</span>
        <select
          value={extractor.selectedCategory}
          disabled={extractor.isExtracting}
          onChange={(e) => extractor.handleCategoryChange(e.target.value)}
          className="h-9 max-w-xs truncate rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
        >
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
        onClose={extractor.handleSafeClose}
        title="AI ดึงข้อสอบจากไฟล์ (3-Pass Hybrid Extractor)"
        subtitle="ขั้น 1 สกัดโจทย์+เฉลย → ขั้น 2 จับคู่เฉลยหนังสือ → ขั้น 3 ตรวจคัดกรอง (Lite) และฟันธง (Flash Standard)"
        titleId="ai-exam-extractor-title"
        icon={<FileExtractIcon className="w-4 h-4" />}
        headerActions={
          <button
            type="button"
            onClick={onGoToSettings}
            className="hidden sm:inline-flex items-center gap-1.5 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            title="ตั้งค่า API Key และโมเดลหลัก"
          >
            <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {extractor.modelRoutingMode === 'hybrid'
                ? 'Hybrid 2 ระดับ'
                : getGeminiModelLabel(extractor.liteModel)}
            </span>
          </button>
        }
        subHeader={subHeader}
        maxWidth="max-w-5xl"
      >
        <ExtractorStepperBar
          isExtracting={extractor.isExtracting}
          progress={extractor.progress}
          stats={extractor.stats}
          activePass={extractor.activePass}
          progressPercent={extractor.progressPercent}
        />

        {extractor.activeTab === 'extract' ? (
          <ExtractorUploadTab
            files={extractor.files}
            fileError={extractor.fileError}
            inspecting={extractor.inspecting}
            fileProfile={extractor.fileProfile}
            selectedCategory={extractor.selectedCategory}
            validateUploadedFiles={extractor.validateUploadedFiles}
            onFilesChange={extractor.handleFilesChange}
            onRequireApiKey={() => extractor.setShowKeyRequired(true)}
            onResetCheckpoint={extractor.handleResetCheckpoint}
            cpLastPage={extractor.cpLastPage}
            cpPass={extractor.cpPass}
            cpKeyPoolLen={extractor.cpKeyPoolLen}
            hasResumablePass1={extractor.hasResumablePass1}
            hasResumablePass23={extractor.hasResumablePass23}
            modelRoutingMode={extractor.modelRoutingMode}
            onModelRoutingModeChange={extractor.setModelRoutingMode}
            selectedDeepModel={extractor.selectedDeepModel}
            onSelectedDeepModelChange={extractor.setSelectedDeepModel}
            liteModel={extractor.liteModel}
            pagesPerBatchInput={extractor.pagesPerBatchInput}
            onPagesPerBatchChange={extractor.setPagesPerBatchInput}
            startPageInput={extractor.startPageInput}
            onStartPageChange={extractor.setStartPageInput}
            endPageInput={extractor.endPageInput}
            onEndPageChange={extractor.setEndPageInput}
            isExtracting={extractor.isExtracting}
            extractionError={extractor.extractionError}
            onStartExtraction={extractor.handleStartExtraction}
            onPauseExtraction={extractor.handlePauseExtraction}
            onRunPendingPass2And3={extractor.handleRunPendingPass2And3}
            onOpenStagingTab={() => extractor.setActiveTab('staging')}
            onFilterOverriddenAndOpenStaging={() => {
              extractor.setStagingFilter('ai_overridden')
              extractor.setActiveTab('staging')
            }}
            displayedDraftCount={extractor.displayedDraftCount}
            statusCounts={extractor.statusCounts}
            stats={extractor.stats}
            showDetailsPanel={extractor.showDetailsPanel}
            onToggleDetailsPanel={() => extractor.setShowDetailsPanel((v) => !v)}
            detailsSubTab={extractor.detailsSubTab}
            onDetailsSubTabChange={extractor.setDetailsSubTab}
          />
        ) : (
          <ExtractorStagingTab
            selectedCategoryName={extractor.selectedCategoryName}
            stagingError={extractor.stagingError}
            statusCounts={extractor.statusCounts}
            displayedDraftCount={extractor.displayedDraftCount}
            modelRoutingMode={extractor.modelRoutingMode}
            liteModel={extractor.liteModel}
            deepModel={extractor.deepModel}
            isExtracting={extractor.isExtracting}
            onRunPendingPass2And3={extractor.handleRunPendingPass2And3}
            onPauseExtraction={extractor.handlePauseExtraction}
            stagingSearch={extractor.stagingSearch}
            onStagingSearchChange={extractor.setStagingSearch}
            stagingFilter={extractor.stagingFilter}
            onStagingFilterChange={extractor.setStagingFilter}
            allVisibleSelected={extractor.allVisibleSelected}
            filteredStagingItems={extractor.filteredStagingItems}
            selectedStagingIds={extractor.selectedStagingIds}
            onToggleSelectAllVisible={extractor.handleToggleSelectAllVisible}
            onToggleSelectStaging={extractor.handleToggleSelectStaging}
            publishing={extractor.publishing}
            onDeleteSelectedStaging={extractor.handleDeleteSelectedStaging}
            onClearAllCategoryDrafts={extractor.handleClearAllCategoryDrafts}
            onPublishSelected={extractor.handlePublishSelected}
            onPublishAll={extractor.handlePublishAll}
            loadingStaging={extractor.loadingStaging}
            onSaveStagingQuestion={extractor.handleSaveStagingQuestion}
            onRequestRemoveSingleStaging={extractor.handleRequestRemoveSingleStaging}
            onInspectOverride={(item) => extractor.setInspectedOverrideItem(item)}
          />
        )}
      </AdminModalShell>

      {extractor.inspectedOverrideItem && (
        <OverrideReasonModal
          key={extractor.inspectedOverrideItem.id}
          item={extractor.inspectedOverrideItem}
          onClose={() => extractor.setInspectedOverrideItem(null)}
          onConfirmAiAnswer={extractor.handleConfirmAiOverride}
          onRevertToBookAnswer={extractor.handleRevertOverrideToBook}
          onSaveExplanationOnly={extractor.handleSaveRevertedExplanation}
        />
      )}

      {extractor.showKeyRequired && (
        <AIKeyRequiredModal
          onClose={() => extractor.setShowKeyRequired(false)}
          onGoToSettings={onGoToSettings}
        />
      )}

      <div className="relative z-[1100]">
        <ConfirmModal
          isOpen={extractor.confirmState.isOpen}
          type={extractor.confirmState.type}
          title={extractor.confirmState.title}
          description={<span className="whitespace-pre-line">{extractor.confirmState.description}</span>}
          confirmText={extractor.confirmState.confirmText}
          cancelText="ยกเลิก"
          onClose={extractor.closeConfirm}
          onConfirm={() => extractor.confirmState.onConfirm?.()}
        />
      </div>
    </>
  )
}
