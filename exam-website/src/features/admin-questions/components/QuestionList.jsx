import { useState } from 'react'
import LoadingScreen from '../../../shared/components/LoadingScreen'
import EmptyState from '../../../shared/components/EmptyState'
import BatchActionBar from '../../../shared/components/BatchActionBar'
import {
  CheckCircleIcon,
  EditIcon,
  FlagIcon,
  FolderIcon,
  InboxIcon,
  InfoCircleIcon,
  SortIcon,
  TrashIcon
} from '../../../shared/components/AdminIcons'

export default function QuestionList({
  questions,
  loading,
  userRole,
  totalCount,
  currentPage,
  sortOrder,
  highlightedNum,
  editingId,
  onEditClick,
  onDeleteClick,
  onToggleStatus,
  onToggleSortOrder,
  ITEMS_PER_PAGE,
  selectedIds = [],
  onSelectItem,
  onSelectAll,
  onBulkStatus,
  onBulkDelete,
  onBulkMove,
  categories = []
}) {
  const [targetMoveCat, setTargetMoveCat] = useState('')
  const [showMoveDropdown, setShowMoveDropdown] = useState(false)

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1
  const allCurrentPageIds = questions.map((q) => q.id)
  const isAllSelected = questions.length > 0 && allCurrentPageIds.every((id) => selectedIds.includes(id))

  const handleConfirmMove = () => {
    if (!targetMoveCat) return
    onBulkMove(targetMoveCat)
    setShowMoveDropdown(false)
    setTargetMoveCat('')
  }

  return (
    <div className="space-y-3.5 min-w-0 relative pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2.5">
          {questions.length > 0 && (
            <label
              htmlFor="selectAll"
              className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <input
                type="checkbox"
                id="selectAll"
                checked={isAllSelected}
                onChange={(e) => onSelectAll(e.target.checked, allCurrentPageIds)}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
              />
              <span>เลือกหน้านี้</span>
              {selectedIds.length > 0 && (
                <span className="text-indigo-600 dark:text-indigo-400 tabular-nums">({selectedIds.length})</span>
              )}
            </label>
          )}

          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
              {userRole === 'admin'
                ? `ข้อสอบทั้งหมด ${totalCount.toLocaleString('th-TH')} ข้อ`
                : `ข้อสอบของคุณ ${totalCount.toLocaleString('th-TH')} ข้อ`}
            </h3>
            {totalCount > 0 && (
              <span className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">
                หน้า {currentPage}/{totalPages}
              </span>
            )}
          </div>
        </div>

        {totalCount > 1 && (
          <button
            type="button"
            onClick={onToggleSortOrder}
            className="h-8 px-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            <SortIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>เรียง:</span>
            <span className="text-slate-900 dark:text-white">
              {sortOrder === 'asc' ? 'เก่า → ใหม่' : 'ใหม่ → เก่า'}
            </span>
          </button>
        )}
      </div>

      {loading ? (
        <LoadingScreen text="กำลังดึงโจทย์ข้อสอบ..." />
      ) : questions.length === 0 ? (
        <EmptyState
          icon={<InboxIcon className="w-6 h-6 text-slate-400 dark:text-slate-500" />}
          title="ยังไม่มีโจทย์ข้อสอบ"
          description={
            userRole === 'admin'
              ? 'หมวดหมู่นี้ยังไม่มีข้อสอบ กดปุ่ม "เพิ่มข้อสอบ" หรือใช้เครื่องมือ AI ด้านบนเพื่อเริ่มต้นได้เลย'
              : 'คุณยังไม่ได้สร้างข้อสอบในหมวดหมู่นี้ เริ่มต้นสร้างโจทย์ข้อแรกจากปุ่มด้านบนได้เลย'
          }
        />
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => {
            const displayIndex =
              sortOrder === 'asc'
                ? (currentPage - 1) * ITEMS_PER_PAGE + idx + 1
                : totalCount - ((currentPage - 1) * ITEMS_PER_PAGE + idx)

            const isHighlighted = highlightedNum === displayIndex
            const isChecked = selectedIds.includes(q.id)

            return (
              <article
                key={q.id}
                id={`question-card-${displayIndex}`}
                className={`p-4 sm:p-5 rounded-2xl border transition-colors space-y-3.5 min-w-0 ${
                  isChecked
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 ring-1 ring-indigo-500/30'
                    : isHighlighted
                      ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-400 ring-2 ring-amber-400/30'
                      : editingId === q.id
                        ? 'border-indigo-400 dark:border-indigo-500/60 bg-white dark:bg-slate-900'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 min-w-0">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="pt-0.5 flex items-center shrink-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onSelectItem(q.id)}
                        aria-label={`เลือกข้อที่ ${displayIndex}`}
                        className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-md font-semibold text-xs tabular-nums ${
                            isHighlighted
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          #{displayIndex}
                        </span>

                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            q.is_active
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {q.is_active ? 'เปิดใช้งาน' : 'ฉบับร่าง'}
                        </span>

                        {q.audit_status === 'flagged' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                            <FlagIcon className="w-3 h-3" />
                            <span>เฉลยอาจผิด</span>
                          </span>
                        )}

                        {q.audit_status === 'verified' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50/70 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-500/20">
                            <CheckCircleIcon className="w-3 h-3" />
                            <span>ตรวจเฉลยแล้ว</span>
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed break-words [word-break:break-word]">
                        {q.question_text}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 shrink-0 pl-7 sm:pl-0">
                    <button
                      type="button"
                      onClick={() => onToggleStatus(q)}
                      className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                        q.is_active
                          ? 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25'
                      }`}
                      title={q.is_active ? 'ซ่อนเป็นฉบับร่าง' : 'เปิดใช้งานข้อสอบนี้'}
                    >
                      {q.is_active ? 'ซ่อน' : 'เปิดใช้'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onEditClick(q)}
                      className="h-8 px-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-500/25 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <EditIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">แก้ไข</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteClick(q)}
                      aria-label={`ลบข้อที่ ${displayIndex}`}
                      className="h-8 w-8 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {q.image_url && (
                  <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-center sm:ml-7">
                    <img src={q.image_url} alt="รูปโจทย์" className="max-h-48 object-contain rounded-lg" loading="lazy" />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:pl-7 min-w-0">
                  {q.options?.map((opt, oIdx) => {
                    const isCorrect = oIdx === Number(q.correct_option)
                    return (
                      <div
                        key={oIdx}
                        className={`px-3 py-2 rounded-xl text-xs flex items-start gap-2.5 border min-w-0 ${
                          isCorrect
                            ? 'bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200 font-semibold'
                            : 'bg-slate-50/80 dark:bg-slate-950/60 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-md text-[11px] flex items-center justify-center shrink-0 tabular-nums font-bold mt-0.5 ${
                            isCorrect
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {oIdx + 1}
                        </span>
                        <span className="break-words [word-break:break-word] flex-1 min-w-0 leading-relaxed pt-0.5">
                          {opt}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {(q.explanation || q.explanation_image_url) && (
                  <div className="sm:ml-7 px-3.5 py-2.5 bg-amber-50/70 dark:bg-amber-500/5 border border-amber-200/80 dark:border-amber-500/20 rounded-xl text-xs space-y-1.5 min-w-0">
                    <div className="font-semibold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                      <InfoCircleIcon className="w-3.5 h-3.5" />
                      <span>คำอธิบายเฉลย</span>
                    </div>
                    {q.explanation && (
                      <p className="leading-relaxed text-slate-700 dark:text-slate-300 pl-5 break-words [word-break:break-word] min-w-0">
                        {q.explanation}
                      </p>
                    )}
                    {q.explanation_image_url && (
                      <div className="bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800 flex justify-center mt-1.5">
                        <img
                          src={q.explanation_image_url}
                          alt="รูปเฉลย"
                          className="max-h-36 object-contain rounded-md"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      <BatchActionBar
        selectedCount={selectedIds.length}
        itemName="ข้อ"
        onClearSelection={() => onSelectAll(false, [])}
        onToggleStatus={onBulkStatus}
        onDelete={onBulkDelete}
        moveSlot={
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoveDropdown((prev) => !prev)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FolderIcon className="w-3.5 h-3.5" />
              <span>ย้ายหมวดวิชา</span>
            </button>

            {showMoveDropdown && (
              <div className="absolute bottom-full right-0 mb-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-2xl z-50 space-y-2.5 animate-fadeIn">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 pb-1.5 border-b border-slate-200 dark:border-slate-800">
                  ย้าย {selectedIds.length} ข้อไปยังหมวดวิชา
                </div>
                <select
                  value={targetMoveCat}
                  onChange={(e) => setTargetMoveCat(e.target.value)}
                  className="w-full h-9 px-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">เลือกวิชาปลายทาง...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMoveDropdown(false)}
                    className="flex-1 h-8 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmMove}
                    disabled={!targetMoveCat}
                    className="flex-1 h-8 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-45 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                  >
                    ยืนยันย้าย
                  </button>
                </div>
              </div>
            )}
          </div>
        }
      />
    </div>
  )
}
