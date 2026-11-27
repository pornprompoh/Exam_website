import { GEMINI_STANDARD_MODELS, getGeminiModelLabel } from '../../../../shared/lib/geminiModels'
import { MAX_EXTRACTOR_FILES, MAX_EXTRACTOR_PDF_SIZE_MB } from '../../shared/utils/pdfPipelineUtils'
import FileUploadDropzone from '../../shared/components/FileUploadDropzone'

function formatModeLabel(mode) {
  if (mode === 'vision') return 'Vision (ภาพสแกน/รูปภาพ)'
  if (mode === 'mixed') return 'Mixed (Text + Vision)'
  return 'Text (ข้อความ PDF)'
}

export default function ExtractorUploadTab({
  files,
  fileError,
  inspecting,
  fileProfile,
  selectedCategory,
  validateUploadedFiles,
  onFilesChange,
  onRequireApiKey,
  onResetCheckpoint,
  cpLastPage,
  cpPass,
  cpKeyPoolLen,
  hasResumablePass1,
  hasResumablePass23,
  modelRoutingMode,
  onModelRoutingModeChange,
  selectedDeepModel,
  onSelectedDeepModelChange,
  liteModel,
  pagesPerBatchInput,
  onPagesPerBatchChange,
  startPageInput,
  onStartPageChange,
  endPageInput,
  onEndPageChange,
  isExtracting,
  extractionError,
  onStartExtraction,
  onPauseExtraction,
  onRunPendingPass2And3,
  onOpenStagingTab,
  onFilterOverriddenAndOpenStaging,
  displayedDraftCount,
  statusCounts,
  stats,
  showDetailsPanel,
  onToggleDetailsPanel,
  detailsSubTab,
  onDetailsSubTabChange
}) {
  return (
    <div className="space-y-5">
      <FileUploadDropzone
        files={files}
        onFilesChange={onFilesChange}
        onRequireApiKey={onRequireApiKey}
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        maxFileSizeMb={MAX_EXTRACTOR_PDF_SIZE_MB}
        maxFiles={MAX_EXTRACTOR_FILES}
        label={`ไฟล์ข้อสอบต้นฉบับ (PDF สูงสุด ${MAX_EXTRACTOR_PDF_SIZE_MB} MB หรือรูปภาพ JPG/PNG/WebP สูงสุด ${MAX_EXTRACTOR_FILES} รูป)`}
        helperText="Pass 1 สกัดโจทย์และเฉลยด้วย Flash Lite → Pass 2 จับคู่เฉลยหนังสือทั้งไฟล์ → Pass 3 คัดกรองและฟันธงข้อสงสัยด้วย Flash Standard"
        disabled={isExtracting}
        validateFiles={validateUploadedFiles}
      />

      {fileError && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
        >
          {fileError}
        </p>
      )}

      {inspecting && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/25 bg-indigo-50/70 dark:bg-indigo-500/10 p-3.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-2.5">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span>กำลังวิเคราะห์โครงสร้างไฟล์และตรวจสอบ Checkpoint เดิม...</span>
        </div>
      )}

      {fileProfile && !inspecting && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 p-3.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {fileProfile.sourceFileName}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                  ทั้งหมด {fileProfile.totalPages} {fileProfile.isPdf ? 'หน้า' : 'รูป'}
                </span>
                <span className="rounded-md bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/80 dark:border-indigo-500/25 px-2 py-0.5 font-semibold text-indigo-700 dark:text-indigo-300">
                  {formatModeLabel(fileProfile.dominantMode)}
                </span>
                <span>{fileProfile.recommended.label}</span>
              </div>
            </div>
          </div>

          {fileProfile.checkpoint && cpLastPage > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-500/35 bg-amber-50/80 dark:bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-amber-900 dark:text-amber-300 tabular-nums">
                  พบ Checkpoint เดิม (ขั้น {cpPass}/3 · เฉลยสะสมใน Pool {cpKeyPoolLen} ข้อ)
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-100/90 leading-relaxed">
                  {hasResumablePass1
                    ? `ขั้น 1 อ่านถึงหน้า ${cpLastPage} / ${fileProfile.totalPages} แล้ว กดเริ่มเพื่ออ่านต่อจากหน้า ${cpLastPage + 1} พร้อมรักษา Answer Key Pool เดิม`
                    : hasResumablePass23
                      ? `ขั้น 1 อ่านครบถึงหน้า ${cpLastPage} / ${fileProfile.totalPages} แล้ว กดปุ่มเพื่อจับคู่เฉลยและตรวจ Pass 2–3 ต่อได้ทันที`
                      : 'ไฟล์นี้ผ่านครบทั้ง 3 ขั้นตอนแล้ว หากต้องการสกัดใหม่ตั้งแต่ต้นให้กดล้าง Checkpoint'}
                </p>
              </div>
              <button
                type="button"
                disabled={isExtracting}
                onClick={onResetCheckpoint}
                className="shrink-0 h-9 rounded-xl border border-amber-300 dark:border-amber-400/40 bg-white hover:bg-amber-100/60 dark:bg-slate-950/70 dark:hover:bg-slate-900 px-3 text-xs font-semibold text-amber-900 dark:text-amber-300 transition-colors disabled:opacity-50 cursor-pointer"
              >
                ล้าง Checkpoint
              </button>
            </div>
          )}
        </div>
      )}

      {/* Two-Stage Hybrid Model Routing Selector */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            โหมดการเลือกโมเดลตรวจเฉลย (Two-Stage Hybrid Routing)
          </h3>
          <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
            Pass 1 & 3A: {getGeminiModelLabel(liteModel)} (500 RPD)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            className={`rounded-xl border p-3.5 cursor-pointer transition-colors flex items-start gap-3 ${
              modelRoutingMode === 'hybrid'
                ? 'border-indigo-400 dark:border-indigo-500/60 bg-white dark:bg-indigo-500/10 ring-1 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <input
              type="radio"
              name="modelRoutingMode"
              value="hybrid"
              disabled={isExtracting}
              checked={modelRoutingMode === 'hybrid'}
              onChange={() => onModelRoutingModeChange('hybrid')}
              className="mt-1 accent-indigo-600 cursor-pointer"
            />
            <div className="space-y-1.5 min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white">Hybrid 2 ระดับ (แนะนำ)</p>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                คัดกรอง 25 ข้อ/รอบ ด้วย Flash Lite แล้วส่งเฉพาะข้อสงสัยและข้อไม่มีเฉลยเข้า Flash Standard ฟันธง (Auto-Fallback อัตโนมัติ)
              </p>
              {modelRoutingMode === 'hybrid' && GEMINI_STANDARD_MODELS.length > 0 && (
                <select
                  value={selectedDeepModel}
                  disabled={isExtracting}
                  onChange={(e) => onSelectedDeepModelChange(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 dark:border-indigo-500/40 bg-slate-50 dark:bg-slate-950 px-2.5 text-xs font-semibold text-slate-800 dark:text-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {GEMINI_STANDARD_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      ด่านฟันธง 3B: {m.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </label>

          <label
            className={`rounded-xl border p-3.5 cursor-pointer transition-colors flex items-start gap-3 ${
              modelRoutingMode === 'lite_only'
                ? 'border-indigo-400 dark:border-indigo-500/60 bg-white dark:bg-indigo-500/10 ring-1 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <input
              type="radio"
              name="modelRoutingMode"
              value="lite_only"
              disabled={isExtracting}
              checked={modelRoutingMode === 'lite_only'}
              onChange={() => onModelRoutingModeChange('lite_only')}
              className="mt-1 accent-indigo-600 cursor-pointer"
            />
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white">Flash Lite ตลอดทาง</p>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                ใช้ {getGeminiModelLabel(liteModel)} (15 RPM / 500 RPD) ครบทุกขั้นตอน ไม่ใช้โควตา Flash Standard
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Chunk & Page Range Settings */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            ตั้งค่ารอบการประมวลผลและช่วงหน้า
          </h3>
          <span className="rounded-md border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            {pagesPerBatchInput.trim()
              ? `กำหนดเอง: ${pagesPerBatchInput} หน้า/รอบ`
              : `อัตโนมัติ: ${fileProfile?.recommended?.pagesPerBatch || 'Auto'} หน้า/รอบ`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              จำนวนหน้าต่อรอบ (1–30)
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={30}
                disabled={isExtracting}
                value={pagesPerBatchInput}
                onChange={(e) => onPagesPerBatchChange(e.target.value)}
                placeholder={`อัตโนมัติ (${fileProfile?.recommended?.pagesPerBatch || 'Auto'})`}
                className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
              {pagesPerBatchInput && (
                <button
                  type="button"
                  disabled={isExtracting}
                  onClick={() => onPagesPerBatchChange('')}
                  className="shrink-0 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 px-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Auto
                </button>
              )}
            </div>
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              หน้าเริ่มต้น (ไม่บังคับ)
            </span>
            <input
              type="number"
              min={1}
              max={fileProfile?.totalPages || undefined}
              disabled={isExtracting}
              value={startPageInput}
              onChange={(e) => onStartPageChange(e.target.value)}
              placeholder="1"
              className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 tabular-nums"
            />
          </label>

          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              หน้าสิ้นสุด (ไม่บังคับ)
            </span>
            <input
              type="number"
              min={1}
              max={fileProfile?.totalPages || undefined}
              disabled={isExtracting}
              value={endPageInput}
              onChange={(e) => onEndPageChange(e.target.value)}
              placeholder={fileProfile?.totalPages ? String(fileProfile.totalPages) : 'ถึงหน้าสุดท้าย'}
              className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 tabular-nums"
            />
          </label>
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="flex flex-wrap items-center gap-2.5">
        {!isExtracting ? (
          <button
            type="button"
            disabled={files.length === 0 || inspecting || !selectedCategory}
            onClick={() => onStartExtraction({ resumeFromCheckpoint: true })}
            className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-5 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            {hasResumablePass1
              ? `อ่านต่อจากหน้า ${cpLastPage + 1} / ${fileProfile.totalPages} (Pass 1 → 2 → 3)`
              : hasResumablePass23
                ? 'ดำเนินการต่อขั้นจับคู่และตรวจเฉลย (Pass 2 → 3)'
                : 'เริ่มสกัดและตรวจเฉลย 3 ขั้นตอน'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onPauseExtraction}
            className="flex-1 h-11 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 px-5 text-sm font-semibold text-amber-900 dark:text-amber-300 transition-colors cursor-pointer"
          >
            หยุดพักชั่วคราว (บันทึก Checkpoint แล้ว)
          </button>
        )}

        {!isExtracting && statusCounts.pending_answer > 0 && (
          <button
            type="button"
            onClick={onRunPendingPass2And3}
            className="h-11 rounded-xl border border-indigo-200 dark:border-indigo-500/35 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:hover:bg-indigo-500/25 px-4 text-xs font-semibold text-indigo-700 dark:text-indigo-200 transition-colors cursor-pointer shrink-0"
          >
            จับคู่ & ตรวจเฉลยข้อรออยู่ ({statusCounts.pending_answer})
          </button>
        )}

        {displayedDraftCount > 0 && (
          <button
            type="button"
            onClick={onOpenStagingTab}
            className="h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 text-xs font-semibold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer shrink-0"
          >
            เปิดตรวจ Draft ({displayedDraftCount}) →
          </button>
        )}
      </div>

      {extractionError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3.5 text-xs leading-relaxed text-rose-800 dark:text-rose-200"
        >
          <p className="font-bold text-rose-900 dark:text-rose-300 mb-0.5">
            เกิดข้อผิดพลาดระหว่างประมวลผล (บันทึก Checkpoint ไว้แล้ว)
          </p>
          <p>{extractionError}</p>
        </div>
      )}

      {/* Live 4-Status Breakdown */}
      {(stats || displayedDraftCount > 0) && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
              สรุปสถานะเฉลยใน Staging ({displayedDraftCount} ข้อ)
            </h4>
            {stats && (
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Pool เฉลย: <strong className="text-slate-900 dark:text-white">{stats.answerKeysCollected || cpKeyPoolLen}</strong> · ส่งฟันธง 3B:{' '}
                <strong className="text-indigo-700 dark:text-indigo-300">{stats.escalatedToDeepCount || 0}</strong> ({stats.stage3BRequestsUsed || 0} req)
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/10 p-3">
              <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">เฉลยหนังสือ (ตรวจแล้ว)</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {statusCounts.book_verified}
              </p>
            </div>
            <button
              type="button"
              onClick={onFilterOverriddenAndOpenStaging}
              className="text-left rounded-xl border border-amber-300 dark:border-orange-500/35 bg-amber-50/80 hover:bg-amber-100/80 dark:bg-orange-500/10 dark:hover:bg-orange-500/15 p-3 transition-colors cursor-pointer"
            >
              <p className="text-[11px] font-semibold text-amber-900 dark:text-orange-300">AI แก้เฉลย (คลิกตรวจ)</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-amber-800 dark:text-orange-400">
                {statusCounts.ai_overridden}
              </p>
            </button>
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-500/10 p-3">
              <p className="text-[11px] font-semibold text-indigo-800 dark:text-indigo-300">AI เฉลย (ไม่มีในไฟล์)</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                {statusCounts.ai_solved}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">รอจับคู่ / รอตรวจ</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {statusCounts.pending_answer}
              </p>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-2.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">หน้าที่ข้ามอัตโนมัติ</p>
                <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {stats.skippedFrontMatterPages || 0} หน้า
                </p>
              </div>
              <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-2.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">ดึงได้ทั้งหมด (Pass 1)</p>
                <p className="text-sm font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                  {stats.extractedTotal || 0} ข้อ
                </p>
              </div>
              <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-2.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">คัดออกเพราะซ้ำ (Exact)</p>
                <p className="text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400">
                  {stats.duplicateExactMatch || 0} ข้อ
                </p>
              </div>
              <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-2.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">ข้าม (รูป / ไม่ใช่ 4–5 ช้อยส์)</p>
                <p className="text-sm font-bold tabular-nums text-rose-700 dark:text-rose-400">
                  {(stats.skippedImageQuestions || 0) + (stats.skippedNonMcqQuestions || 0)} ข้อ
                </p>
              </div>
            </div>
          )}

          {stats && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
              <button
                type="button"
                onClick={onToggleDetailsPanel}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>{showDetailsPanel ? '▾' : '▸'}</span>
                <span>
                  ดูรายละเอียดรายการที่ถูกคัดออก / ข้าม (
                  {(stats.skippedItemsLog?.length || 0) +
                    (stats.duplicateItemsLog?.length || 0) +
                    (stats.skippedPagesLog?.length || 0)}{' '}
                  รายการ)
                </span>
              </button>

              {showDetailsPanel && (
                <div className="mt-3 space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => onDetailsSubTabChange('skipped_items')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer border ${
                        detailsSubTab === 'skipped_items'
                          ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      ข้อที่ข้าม ({stats.skippedItemsLog?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => onDetailsSubTabChange('duplicates')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer border ${
                        detailsSubTab === 'duplicates'
                          ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      คัดออกเพราะซ้ำ ({stats.duplicateItemsLog?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => onDetailsSubTabChange('skipped_pages')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer border ${
                        detailsSubTab === 'skipped_pages'
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      หน้าที่ข้ามอัตโนมัติ ({stats.skippedPagesLog?.length || 0})
                    </button>
                  </div>

                  <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 p-3 space-y-2 text-xs">
                    {detailsSubTab === 'skipped_items' &&
                      ((stats.skippedItemsLog || []).length === 0 ? (
                        <p className="text-slate-500">ไม่มีข้อสอบที่ถูกข้าม</p>
                      ) : (
                        stats.skippedItemsLog.map((entry, idx) => (
                          <div
                            key={idx}
                            className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5 last:border-0"
                          >
                            <span className="font-semibold text-rose-700 dark:text-rose-300 tabular-nums">
                              ข้อ #{entry.source_question_number} (หน้า {entry.source_page})
                            </span>
                            <span className="text-slate-600 dark:text-slate-300">
                              {entry.reason === 'has_image' ? 'มีรูปภาพ' : 'ไม่ใช่ปรนัย 4–5 ตัวเลือก'} — {entry.detail}
                            </span>
                          </div>
                        ))
                      ))}

                    {detailsSubTab === 'duplicates' &&
                      ((stats.duplicateItemsLog || []).length === 0 ? (
                        <p className="text-slate-500">ไม่มีข้อสอบที่ถูกคัดออกเพราะซ้ำ</p>
                      ) : (
                        stats.duplicateItemsLog.map((entry, idx) => (
                          <div key={idx} className="border-b border-slate-100 dark:border-slate-800 pb-1.5 last:border-0">
                            <span className="font-semibold text-amber-700 dark:text-amber-300 mr-2 tabular-nums">
                              ข้อ #{entry.source_question_number} (หน้า {entry.source_page}):
                            </span>
                            <span className="text-slate-600 dark:text-slate-300">{entry.question_preview}</span>
                          </div>
                        ))
                      ))}

                    {detailsSubTab === 'skipped_pages' &&
                      ((stats.skippedPagesLog || []).length === 0 ? (
                        <p className="text-slate-500">ไม่มีหน้าที่ถูกข้ามอัตโนมัติ</p>
                      ) : (
                        stats.skippedPagesLog.map((entry, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1.5 last:border-0"
                          >
                            <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                              หน้า {entry.page}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">{entry.detail || entry.reason}</span>
                          </div>
                        ))
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
