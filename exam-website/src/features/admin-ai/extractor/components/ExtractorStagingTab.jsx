import { getGeminiModelLabel } from '../../../../shared/lib/geminiModels'
import { InboxIcon, SearchIcon, TrashIcon } from '../../../../shared/components/AdminIcons'
import ExamPreviewTable from '../../shared/components/ExamPreviewTable'

export default function ExtractorStagingTab({
  selectedCategoryName,
  stagingError,
  statusCounts,
  displayedDraftCount,
  modelRoutingMode,
  liteModel,
  deepModel,
  isExtracting,
  onRunPendingPass2And3,
  onPauseExtraction,
  stagingSearch,
  onStagingSearchChange,
  stagingFilter,
  onStagingFilterChange,
  allVisibleSelected,
  filteredStagingItems,
  selectedStagingIds,
  onToggleSelectAllVisible,
  onToggleSelectStaging,
  publishing,
  onDeleteSelectedStaging,
  onClearAllCategoryDrafts,
  onPublishSelected,
  onPublishAll,
  loadingStaging,
  onSaveStagingQuestion,
  onRequestRemoveSingleStaging,
  onInspectOverride
}) {
  return (
    <div className="space-y-4">
      {stagingError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-700 dark:text-rose-200"
        >
          {stagingError}
        </div>
      )}

      {statusCounts.pending_answer > 0 && (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/35 bg-indigo-50/80 dark:bg-indigo-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200 tabular-nums">
              มีข้อสอบรอจับคู่และตรวจเฉลยจำนวน {statusCounts.pending_answer} ข้อ
            </p>
            <p className="text-xs text-indigo-700/80 dark:text-indigo-200/80 mt-0.5">
              โหมดปัจจุบัน:{' '}
              <strong>
                {modelRoutingMode === 'hybrid'
                  ? `Hybrid (${getGeminiModelLabel(liteModel)} → ${getGeminiModelLabel(deepModel)})`
                  : getGeminiModelLabel(liteModel)}
              </strong>
            </p>
          </div>
          {!isExtracting ? (
            <button
              type="button"
              onClick={onRunPendingPass2And3}
              className="shrink-0 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] px-4 text-xs font-semibold text-white cursor-pointer transition-all duration-300 ease-premium"
            >
              จับคู่และตรวจเฉลยต่อ
            </button>
          ) : (
            <button
              type="button"
              onClick={onPauseExtraction}
              className="shrink-0 h-9 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/15 px-4 text-xs font-semibold text-amber-900 dark:text-amber-300 cursor-pointer"
            >
              หยุดพัก Pass 3
            </button>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 dark:border-[#272727] bg-zinc-50 dark:bg-[#1F1F1F] p-4 space-y-3">
        <div className="relative">
          <SearchIcon className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={stagingSearch}
            onChange={(e) => onStagingSearchChange(e.target.value)}
            placeholder="ค้นหาโจทย์ เลขข้อต้นฉบับ ชื่อชุด ชื่อไฟล์ หรือเหตุผลที่ AI แก้เฉลย..."
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-zinc-200 dark:border-[#313131] bg-white dark:bg-[#181818] text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'all', label: `ทั้งหมด (${displayedDraftCount})` },
            { key: 'ai_overridden', label: `AI แก้เฉลย (${statusCounts.ai_overridden})` },
            { key: 'ai_solved', label: `AI เฉลย (${statusCounts.ai_solved})` },
            { key: 'book_verified', label: `เฉลยหนังสือ (${statusCounts.book_verified})` },
            { key: 'pending_answer', label: `รอจับคู่ (${statusCounts.pending_answer})` }
          ].map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onStagingFilterChange(chip.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer border transition-all duration-300 ease-premium active:scale-[0.98] tabular-nums ${
                stagingFilter === chip.key
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-[#181818] text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-[#272727] hover:border-zinc-300 dark:hover:border-[#313131]'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-zinc-200 dark:border-[#272727]">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer tabular-nums">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              disabled={filteredStagingItems.length === 0}
              onChange={onToggleSelectAllVisible}
              className="h-4 w-4 accent-indigo-600 rounded cursor-pointer"
            />
            <span>
              เลือกทั้งหมด ({selectedStagingIds.length}/{displayedDraftCount})
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={selectedStagingIds.length === 0 || publishing}
              onClick={onDeleteSelectedStaging}
              className="h-8 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 disabled:opacity-40 px-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer inline-flex items-center gap-1"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              <span>ลบที่เลือก ({selectedStagingIds.length})</span>
            </button>

            <button
              type="button"
              disabled={displayedDraftCount === 0 || publishing}
              onClick={onClearAllCategoryDrafts}
              className="h-8 rounded-lg border border-zinc-200 dark:border-[#313131] bg-white hover:bg-rose-50 dark:bg-[#181818] dark:hover:bg-rose-500/10 disabled:opacity-40 px-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
            >
              ล้าง Draft ทั้งหมด
            </button>

            <button
              type="button"
              disabled={selectedStagingIds.length === 0 || publishing}
              onClick={onPublishSelected}
              className="h-8 rounded-lg border border-indigo-200 dark:border-indigo-500/35 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:hover:bg-indigo-500/25 disabled:opacity-40 px-3 text-xs font-semibold text-indigo-700 dark:text-indigo-200 transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
            >
              {publishing ? 'กำลังเผยแพร่...' : `เผยแพร่ที่เลือก (${selectedStagingIds.length})`}
            </button>

            <button
              type="button"
              disabled={displayedDraftCount === 0 || publishing}
              onClick={onPublishAll}
              className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 px-3.5 text-xs font-semibold text-white transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
            >
              {publishing ? 'กำลังเผยแพร่...' : `เผยแพร่ทั้งหมด (${displayedDraftCount})`}
            </button>
          </div>
        </div>
      </div>

      {loadingStaging ? (
        <div className="py-12 text-center text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          กำลังโหลดข้อสอบ Draft จากตาราง Staging...
        </div>
      ) : filteredStagingItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-[#313131] bg-zinc-50 dark:bg-[#1F1F1F] p-10 text-center space-y-2">
          <div className="w-11 h-11 rounded-xl bg-white dark:bg-[#181818] border border-zinc-200 dark:border-[#272727] flex items-center justify-center mx-auto text-zinc-400">
            <InboxIcon className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {displayedDraftCount === 0
              ? `ยังไม่มีข้อสอบ Draft ค้างอยู่ในวิชา "${selectedCategoryName}"`
              : 'ไม่พบข้อสอบ Draft ที่ตรงกับคำค้นหาหรือตัวกรองสถานะ'}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {displayedDraftCount === 0
              ? 'สลับไปที่แท็บสกัดข้อสอบเพื่ออัปโหลด PDF หรือรูปภาพข้อสอบได้เลย'
              : 'ลองเปลี่ยนตัวกรองสถานะด้านบนหรือล้างคำค้นหา'}
          </p>
        </div>
      ) : (
        <ExamPreviewTable
          questions={filteredStagingItems}
          onSaveQuestion={onSaveStagingQuestion}
          onRemoveQuestion={onRequestRemoveSingleStaging}
          selectable={true}
          selectedIds={selectedStagingIds}
          onToggleSelect={onToggleSelectStaging}
          showExtractionMeta={true}
          useExternalRemoveConfirm={true}
          onInspectOverride={onInspectOverride}
        />
      )}
    </div>
  )
}
