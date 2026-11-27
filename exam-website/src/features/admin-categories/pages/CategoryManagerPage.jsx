import LoadingScreen from '../../../shared/components/LoadingScreen'
import EmptyState from '../../../shared/components/EmptyState'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import BatchActionBar from '../../../shared/components/BatchActionBar'
import AdminModalShell from '../../../shared/components/AdminModalShell'
import {
  EditIcon,
  FolderIcon,
  PlusIcon,
  SortIcon,
  TrashIcon,
  UsersIcon
} from '../../../shared/components/AdminIcons'
import ShareCategoryModal from '../components/ShareCategoryModal'
import useCategoryManager from '../hooks/useCategoryManager'

export default function CategoryManagerPage() {
  const cm = useCategoryManager()

  return (
    <div className="space-y-4 relative pb-24">
      <ConfirmModal
        isOpen={!!cm.deleteTarget}
        type="danger"
        title={cm.deleteTarget?.length > 1 ? `ยืนยันการลบ ${cm.deleteTarget.length} หมวดหมู่นี้?` : 'ยืนยันการลบหมวดหมู่นี้?'}
        description="ข้อสอบและสถิติทั้งหมดที่เชื่อมโยงกับหมวดวิชานี้จะถูกลบออกอย่างถาวรและไม่สามารถกู้คืนได้"
        confirmText="ยืนยันลบถาวร"
        cancelText="ยกเลิก"
        onClose={() => cm.setDeleteTarget(null)}
        onConfirm={cm.handleConfirmDelete}
      />

      <ConfirmModal
        isOpen={cm.modalConfig.isOpen}
        type={cm.modalConfig.type}
        title={cm.modalConfig.title}
        description={cm.modalConfig.description}
        confirmText="ตกลง"
        cancelText=""
        onConfirm={cm.closeModal}
        onClose={cm.closeModal}
      />

      <ShareCategoryModal
        isOpen={!!cm.shareTargetCat}
        onClose={() => cm.setShareTargetCat(null)}
        category={cm.shareTargetCat}
        currentUserId={cm.currentUserId}
        onSuccess={() => cm.fetchCategories()}
        showModal={cm.showModal}
      />

      <AdminModalShell
        isOpen={cm.isFormOpen}
        onClose={cm.handleCloseForm}
        title={cm.editingCat ? 'แก้ไขหมวดหมู่วิชา' : 'เพิ่มหมวดหมู่วิชาใหม่'}
        subtitle={cm.editingCat ? `กำลังแก้ไขวิชา: ${cm.editingCat.name}` : 'สร้างวิชาใหม่สำหรับจัดเก็บและแบ่งกลุ่มข้อสอบ'}
        titleId="category-form-drawer-title"
        icon={cm.editingCat ? <EditIcon className="w-4 h-4" /> : <FolderIcon className="w-4 h-4" />}
        maxWidth="max-w-lg"
      >
        <form onSubmit={cm.handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="cat-name-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              ชื่อหมวดหมู่ / วิชา <span className="text-rose-500">*</span>
            </label>
            <input
              id="cat-name-input"
              type="text"
              required
              placeholder="เช่น วิทยาศาสตร์ ม.3"
              value={cm.name}
              onChange={(e) => cm.setName(e.target.value)}
              className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="cat-desc-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              คำอธิบาย (ถ้ามี)
            </label>
            <textarea
              id="cat-desc-input"
              rows="4"
              placeholder="อธิบายขอบเขตเนื้อหาโดยย่อ..."
              value={cm.description}
              onChange={(e) => cm.setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors resize-y"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={cm.handleCloseForm}
              className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={cm.saving}
              className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
            >
              {cm.saving ? 'กำลังบันทึก...' : cm.editingCat ? 'บันทึกการแก้ไข' : 'สร้างหมวดหมู่'}
            </button>
          </div>
        </form>
      </AdminModalShell>

      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {cm.categories.length > 0 && (
            <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={cm.isAllCurrentPageSelected}
                onChange={cm.handleSelectAllInPage}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 select-none tabular-nums">
                เลือกหน้านี้ {cm.selectedCountInPage > 0 ? `(${cm.selectedCountInPage})` : ''}
              </span>
            </label>
          )}
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
            ทั้งหมด {cm.categories.length.toLocaleString('th-TH')} หมวด
          </span>
          {cm.categories.length > 0 && (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md tabular-nums">
              หน้า {cm.currentPage}/{cm.totalPages}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end">
          {cm.categories.length > 1 && (
            <button
              type="button"
              onClick={cm.toggleSortOrder}
              className="h-10 inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <SortIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>{cm.sortOrder === 'asc' ? 'เก่า → ใหม่' : 'ใหม่ → เก่า'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={cm.handleOpenCreateForm}
            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            <span>เพิ่มหมวดหมู่</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {cm.loading ? (
          <LoadingScreen text="กำลังดึงหมวดหมู่วิชาทั้งหมด..." />
        ) : cm.categories.length === 0 ? (
          <EmptyState
            icon={<FolderIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />}
            title="ยังไม่มีหมวดหมู่วิชา"
            description="สร้างหมวดหมู่วิชาแรกเพื่อเริ่มต้นจัดเก็บข้อสอบในคลัง"
            actionText="เพิ่มหมวดหมู่วิชาใหม่"
            onAction={cm.handleOpenCreateForm}
          />
        ) : (
          cm.paginatedCategories.map((cat) => {
            const isOwner = cat.created_by === cm.currentUserId || cm.userRole === 'admin'
            const isCoOwner = (cat.co_owners || []).includes(cm.currentUserId) && !isOwner
            const coOwnersCount = (cat.co_owners || []).length
            const isSelected = cm.selectedItems.includes(cat.id)

            return (
              <div
                key={cat.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 ring-1 ring-indigo-500/30'
                    : cm.editingCat?.id === cat.id
                      ? 'border-indigo-400 dark:border-indigo-500/60 bg-white dark:bg-slate-900'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => cm.handleSelectItem(cat.id)}
                    aria-label={`เลือกหมวด ${cat.name}`}
                    className="w-4 h-4 accent-indigo-600 rounded mt-1 sm:mt-0 cursor-pointer shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate max-w-md">{cat.name}</h4>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${cat.is_active ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                        {cat.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </span>
                      {isOwner ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25 shrink-0">เจ้าของหลัก</span>
                      ) : isCoOwner ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/25 shrink-0">เจ้าของร่วม</span>
                      ) : null}
                      {coOwnersCount > 0 && (
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md tabular-nums">
                          ดูแลร่วม {coOwnersCount} คน
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{cat.description || 'ไม่มีคำอธิบาย'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto shrink-0 pt-3 sm:pt-0 border-t sm:border-0 border-slate-200 dark:border-slate-800 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => cm.setShareTargetCat(cat)}
                    className="h-8 px-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-500/25 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                    title="แชร์สิทธิ์การจัดการวิชานี้ให้ Creator คนอื่น"
                  >
                    <UsersIcon className="w-3.5 h-3.5" />
                    <span>แชร์สิทธิ์</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => cm.handleToggleStatus(cat)}
                    className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${cat.is_active ? 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700' : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25'}`}
                  >
                    {cat.is_active ? 'ซ่อน' : 'เปิดใช้'}
                  </button>

                  <button
                    type="button"
                    onClick={() => cm.handleOpenEditForm(cat)}
                    className="h-8 px-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <EditIcon className="w-3.5 h-3.5" />
                    <span>แก้ไข</span>
                  </button>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => cm.setDeleteTarget([cat.id])}
                      aria-label={`ลบหมวด ${cat.name}`}
                      className="h-8 w-8 text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                      title="ลบหมวดหมู่"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {cm.totalPages > 1 && (
        <div className="pt-2 flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => cm.setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={cm.currentPage === 1}
            className="h-8 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            ก่อนหน้า
          </button>
          <div className="flex items-center gap-1 mx-1 overflow-x-auto">
            {[...Array(cm.totalPages)].map((_, i) => (
              <button
                type="button"
                key={i}
                onClick={() => cm.setCurrentPage(i + 1)}
                className={`w-8 h-8 shrink-0 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                  cm.currentPage === i + 1
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => cm.setCurrentPage((prev) => Math.min(prev + 1, cm.totalPages))}
            disabled={cm.currentPage === cm.totalPages}
            className="h-8 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            ถัดไป
          </button>
        </div>
      )}

      <BatchActionBar
        selectedCount={cm.selectedItems.length}
        itemName="หมวด"
        onClearSelection={() => cm.setSelectedItems([])}
        onToggleStatus={cm.handleBatchToggleStatus}
        onDelete={() => cm.setDeleteTarget(cm.selectedItems)}
      />
    </div>
  )
}
