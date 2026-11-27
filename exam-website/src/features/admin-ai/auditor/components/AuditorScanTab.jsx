import { GEMINI_STANDARD_MODELS, getGeminiModelLabel } from '../../../../shared/lib/geminiModels'
import { FlagIcon } from '../../../../shared/components/AdminIcons'
import { AUDIT_STAGES, MAX_AUDITOR_BATCH_SIZE, MIN_AUDITOR_BATCH_SIZE } from '../utils/auditorLocalUtils'

export default function AuditorScanTab({
  stats,
  loadingData,
  limitMode,
  onLimitModeChange,
  customLimitInput,
  onCustomLimitChange,
  batchSizeInput,
  onBatchSizeChange,
  modelRoutingMode,
  onModelRoutingModeChange,
  selectedDeepModel,
  onSelectedDeepModelChange,
  liteModel,
  deepModel,
  targetScanCount,
  quotaEstimate,
  isAuditing,
  auditError,
  progress,
  onStartAudit,
  onPauseAudit,
  onRequestResetAudit,
  onOpenFlaggedTab
}) {
  const runStats = progress?.runStats || null
  const activeStage = progress?.stage ?? 0
  const progressPercent =
    runStats?.totalScannedTarget > 0
      ? Math.min(100, Math.round((runStats.processedCount / runStats.totalScannedTarget) * 100))
      : progress?.status === 'completed'
        ? 100
        : 0

  return (
    <div className="space-y-5">
      {/* 4 Live Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">ข้อสอบทั้งหมด</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {stats.total.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 p-4">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">ยังไม่ตรวจ</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {stats.unchecked.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/10 p-4">
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">ตรวจผ่านแล้ว</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {stats.verified.toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenFlaggedTab}
          className="text-left rounded-2xl border border-rose-200 dark:border-rose-500/35 bg-rose-50/70 hover:bg-rose-100/70 dark:bg-rose-500/10 dark:hover:bg-rose-500/15 p-4 transition-colors cursor-pointer"
        >
          <p className="text-xs font-medium text-rose-800 dark:text-rose-300">พบเฉลยอาจผิด</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-rose-700 dark:text-rose-400">
            {stats.flagged.toLocaleString()}
          </p>
        </button>
      </div>

      {/* Configuration Panel */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">ตั้งค่าการตรวจทาน</h3>
          <button
            type="button"
            disabled={isAuditing || stats.total === 0}
            onClick={onRequestResetAudit}
            className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 disabled:opacity-40 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            รีเซ็ตสถานะเพื่อตรวจใหม่
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              จำนวนข้อที่ต้องการตรวจรอบนี้
            </label>
            <div className="flex items-center gap-2">
              <select
                value={limitMode}
                disabled={isAuditing}
                onChange={(e) => onLimitModeChange(e.target.value)}
                className="flex-1 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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
                  onChange={(e) => onCustomLimitChange(e.target.value)}
                  className="w-24 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold tabular-nums text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="200"
                />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              ขนาด Mega-Batch ({MIN_AUDITOR_BATCH_SIZE}–{MAX_AUDITOR_BATCH_SIZE} ข้อ/รอบ · แนะนำ 40)
            </label>
            <input
              type="number"
              min={MIN_AUDITOR_BATCH_SIZE}
              max={MAX_AUDITOR_BATCH_SIZE}
              disabled={isAuditing}
              value={batchSizeInput}
              onChange={(e) => onBatchSizeChange(e.target.value)}
              className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold tabular-nums text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
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
              name="auditorModelMode"
              value="hybrid"
              disabled={isAuditing}
              checked={modelRoutingMode === 'hybrid'}
              onChange={() => onModelRoutingModeChange('hybrid')}
              className="mt-1 accent-indigo-600 cursor-pointer"
            />
            <div className="space-y-1.5 min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Hybrid: Flash Lite + Flash Standard (แนะนำ)
              </p>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                ด่าน 1 คัดกรองด้วย {getGeminiModelLabel(liteModel)} · ด่าน 2 ยืนยันตัด False Positive ด้วย Flash Standard (Auto-Fallback)
              </p>
              {modelRoutingMode === 'hybrid' && GEMINI_STANDARD_MODELS.length > 0 && (
                <select
                  value={selectedDeepModel}
                  disabled={isAuditing}
                  onChange={(e) => onSelectedDeepModelChange(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 dark:border-indigo-500/40 bg-slate-50 dark:bg-slate-950 px-2.5 text-xs font-semibold text-slate-800 dark:text-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
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

          <label
            className={`rounded-xl border p-3.5 cursor-pointer transition-colors flex items-start gap-3 ${
              modelRoutingMode === 'lite_only'
                ? 'border-indigo-400 dark:border-indigo-500/60 bg-white dark:bg-indigo-500/10 ring-1 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <input
              type="radio"
              name="auditorModelMode"
              value="lite_only"
              disabled={isAuditing}
              checked={modelRoutingMode === 'lite_only'}
              onChange={() => onModelRoutingModeChange('lite_only')}
              className="mt-1 accent-indigo-600 cursor-pointer"
            />
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white">Flash Lite อย่างเดียว</p>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                ใช้ {getGeminiModelLabel(liteModel)} (15 RPM / 500 RPD) ทั้งด่าน 1 และด่าน 2 ไม่ใช้โควตา Flash Standard
              </p>
            </div>
          </label>
        </div>

        <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/70 dark:bg-emerald-500/10 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-emerald-900 dark:text-emerald-200">
            ประมาณการโควต้า: {quotaEstimate.summaryText}
          </span>
          <span className="text-emerald-700 dark:text-emerald-300/80">
            ด่าน 2 ใช้ {modelRoutingMode === 'hybrid' ? getGeminiModelLabel(deepModel) : getGeminiModelLabel(liteModel)}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2.5">
        {!isAuditing ? (
          <button
            type="button"
            disabled={loadingData || stats.unchecked === 0 || targetScanCount === 0}
            onClick={onStartAudit}
            className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-5 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            {stats.unchecked === 0
              ? 'ตรวจครบทุกข้อแล้ว'
              : `เริ่มตรวจทานเฉลย ${targetScanCount.toLocaleString()} ข้อ (ข้ามข้อที่ตรวจแล้วอัตโนมัติ)`}
          </button>
        ) : (
          <button
            type="button"
            onClick={onPauseAudit}
            className="flex-1 h-11 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 px-5 text-sm font-semibold text-amber-900 dark:text-amber-300 transition-colors cursor-pointer"
          >
            หยุดพักชั่วคราว (เซฟผลทุก Batch แล้ว)
          </button>
        )}

        {stats.flagged > 0 && (
          <button
            type="button"
            onClick={onOpenFlaggedTab}
            className="h-11 rounded-xl border border-rose-200 dark:border-rose-500/35 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 px-4 text-xs font-semibold text-rose-700 dark:text-rose-200 transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
          >
            <FlagIcon className="w-3.5 h-3.5" />
            <span>เปิดตรวจ Flagged ({stats.flagged}) →</span>
          </button>
        )}
      </div>

      {/* Real-Time 3-Stage Progress Dashboard */}
      {(isAuditing || progress) && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 p-4 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {AUDIT_STAGES.map((st) => {
              const isDone = progress?.status === 'completed' || activeStage > st.stage
              const isCurrent = !isDone && activeStage === st.stage
              return (
                <div
                  key={st.stage}
                  className={`rounded-xl border px-3 py-2 flex items-center gap-2.5 ${
                    isDone
                      ? 'border-emerald-200 dark:border-emerald-500/35 bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
                      : isCurrent
                        ? 'border-indigo-300 dark:border-indigo-500/50 bg-indigo-50/80 dark:bg-indigo-500/15 text-indigo-950 dark:text-white'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {isDone ? '✓' : st.stage}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold opacity-75">{st.label}</p>
                    <p className="text-xs font-semibold truncate">{st.title}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                {isAuditing && (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent shrink-0" />
                )}
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {progress?.statusMessage}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {progress?.activeModelLabel && (
                  <span className="rounded-md border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-200">
                    {progress.activeModelLabel}
                  </span>
                )}
                <span className="font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                  {progressPercent}%
                </span>
              </div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress?.status === 'error'
                    ? 'bg-rose-500'
                    : progress?.status === 'paused'
                      ? 'bg-amber-500'
                      : 'bg-indigo-600 dark:bg-indigo-400'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {runStats?.fallbackTriggered && runStats?.fallbackNotice && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-500/35 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-200">
              Auto-Fallback: {runStats.fallbackNotice}
            </div>
          )}

          {auditError && (
            <div role="alert" className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-200">
              <strong>เกิดข้อผิดพลาด: </strong>
              {auditError}
            </div>
          )}

          {runStats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">ความคืบหน้า</p>
                <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                  {runStats.processedCount}/{runStats.totalScannedTarget}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-500/5 p-2.5">
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">ผ่านด่าน 1 ทันที</p>
                <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {runStats.stage1Verified}
                </p>
              </div>
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50/70 dark:bg-indigo-500/5 p-2.5">
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300">ตัด False Positive</p>
                <p className="text-sm font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                  {runStats.stage2FalsePositivesCleared}
                </p>
              </div>
              <div className="rounded-xl border border-rose-200 dark:border-rose-500/25 bg-rose-50/70 dark:bg-rose-500/10 p-2.5">
                <p className="text-[11px] text-rose-700 dark:text-rose-300">ติด Flag ยืนยัน</p>
                <p className="text-sm font-bold tabular-nums text-rose-700 dark:text-rose-400">
                  {runStats.stage0Flagged + runStats.stage2ConfirmedFlagged}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 col-span-2 sm:col-span-1">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">API ใช้ไป</p>
                <p className="text-xs font-bold tabular-nums text-indigo-700 dark:text-indigo-300 pt-0.5">
                  L:{runStats.stage1Requests} · S:{runStats.stage2Requests}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
