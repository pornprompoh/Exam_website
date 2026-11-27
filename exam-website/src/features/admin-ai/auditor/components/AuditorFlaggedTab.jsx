import { CheckCircleIcon, SearchIcon } from '../../../../shared/components/AdminIcons'
import AuditorFlaggedCard from './AuditorFlaggedCard'

export default function AuditorFlaggedTab({
  selectedScope,
  categoryNameMap,
  flaggedItems,
  filteredFlaggedItems,
  loadingData,
  flaggedSearch,
  onFlaggedSearchChange,
  selectedFlaggedIds,
  allVisibleSelected,
  onToggleSelectAllVisible,
  onToggleSelectItem,
  busyItemId,
  bulkBusy,
  manualEditingId,
  manualDraft,
  onManualDraftChange,
  onStartManualEdit,
  onCancelManualEdit,
  onSaveManualEdit,
  onKeepOriginalSingle,
  onAcceptSingle,
  onBulkKeepSelected,
  onBulkAcceptSelected
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 dark:border-[#272727] bg-zinc-50 dark:bg-[#1F1F1F] p-4 space-y-3">
        <div className="relative">
          <SearchIcon className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={flaggedSearch}
            onChange={(e) => onFlaggedSearchChange(e.target.value)}
            placeholder="ค้นหาโจทย์ เหตุผล หรือชื่อหมวดหมู่ในรายการที่ติด Flag..."
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-zinc-200 dark:border-[#313131] bg-white dark:bg-[#181818] text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-zinc-200 dark:border-[#272727]">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer tabular-nums">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              disabled={filteredFlaggedItems.length === 0}
              onChange={onToggleSelectAllVisible}
              className="h-4 w-4 accent-indigo-600 rounded cursor-pointer"
            />
            <span>
              เลือกทั้งหมด ({selectedFlaggedIds.length}/{flaggedItems.length})
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={selectedFlaggedIds.length === 0 || bulkBusy}
              onClick={onBulkKeepSelected}
              className="h-8 rounded-lg border border-zinc-200 dark:border-[#313131] bg-white hover:bg-zinc-100 dark:bg-[#181818] dark:hover:bg-[#272727] disabled:opacity-40 px-3 text-xs font-semibold text-zinc-700 dark:text-zinc-200 transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
            >
              คงเฉลยเดิมที่เลือก ({selectedFlaggedIds.length})
            </button>
            <button
              type="button"
              disabled={selectedFlaggedIds.length === 0 || bulkBusy}
              onClick={onBulkAcceptSelected}
              className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 px-3.5 text-xs font-semibold text-white transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
            >
              {bulkBusy ? 'กำลังบันทึก...' : `อนุมัติใช้เฉลย AI (${selectedFlaggedIds.length})`}
            </button>
          </div>
        </div>
      </div>

      {loadingData ? (
        <div className="py-12 text-center text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          กำลังโหลดรายการเฉลยผิดปกติ...
        </div>
      ) : filteredFlaggedItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-[#313131] bg-zinc-50 dark:bg-[#1F1F1F] p-10 text-center space-y-2">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
            <CheckCircleIcon className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {flaggedItems.length === 0
              ? 'ไม่พบข้อสอบที่ติดสถานะ Flagged ในขอบเขตนี้'
              : 'ไม่พบรายการที่ตรงกับคำค้นหา'}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {flaggedItems.length === 0
              ? 'เฉลยทั้งหมดที่ตรวจแล้วถูกต้องเรียบร้อย หรือสลับไปแท็บสั่งตรวจทานเพื่อตรวจข้อที่เหลือ'
              : 'ลองเปลี่ยนคำค้นหาดูอีกครั้ง'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredFlaggedItems.map((item, idx) => (
            <AuditorFlaggedCard
              key={item.id}
              item={item}
              index={idx}
              showCategoryBadge={selectedScope === 'ALL'}
              categoryName={categoryNameMap.get(item.category_id)}
              isSelected={selectedFlaggedIds.includes(item.id)}
              isEditingManual={manualEditingId === item.id}
              isItemBusy={busyItemId === item.id || bulkBusy}
              manualDraft={manualDraft}
              onToggleSelect={onToggleSelectItem}
              onManualDraftChange={onManualDraftChange}
              onStartManualEdit={onStartManualEdit}
              onCancelManualEdit={onCancelManualEdit}
              onSaveManualEdit={onSaveManualEdit}
              onKeepOriginal={onKeepOriginalSingle}
              onAcceptSuggestion={onAcceptSingle}
            />
          ))}
        </div>
      )}
    </div>
  )
}
