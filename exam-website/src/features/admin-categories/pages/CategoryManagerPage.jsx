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
    <div className="space-y-5 relative pb-24">
      <ConfirmModal
        isOpen={!!cm.deleteTarget}
        type="danger"
        title={cm.deleteTarget?.length > 1 ? `ยืนยันการลบ ${cm.deleteTarget.length} หมวดหมู่นี้` : 'ยืนยันการลบหมวดหมู่นี้'}
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
        subtitle={cm.editingCat ? cm.editingCat.name : ''}
        titleId="category-form-drawer-title"
        icon={cm.editingCat ? <EditIcon className="w-4 h-4" /> : <FolderIcon className="w-4 h-4" />}
        maxWidth="max-w-lg"
      >
        <form onSubmit={cm.handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="cat-name-input" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              ชื่อหมวดหมู่หรือวิชา <span className="text-rose-500">*</span>
            </label>
            <input
              id="cat-name-input"
              type="text"
              required
              placeholder="เช่น วิทยาศาสตร์ ม.3"
              value={cm.name}
              onChange={(e) => cm.setName(e.target.value)}
              className="w-full h-10 px-3.5 bg-zinc-50 dark:bg-[#1F1F1F] border border-zinc-200 dark:border-[#272727] rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-300"
            />
          </div>

          <div>
            <label htmlFor="cat-desc-input" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              คำอธิบาย (ถ้ามี)
            </label>
            <textarea
              id="cat-desc-input"
              rows="4"
              placeholder="อธิบายขอบเขตเนื้อหาโดยย่อ..."
              value={cm.description}
              onChange={(e) => cm.setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-[#1F1F1F] border border-zinc-200 dark:border-[#272727] rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-300 resize-y"
            />
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-[#272727] flex flex-col-reverse sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={cm.handleCloseForm}
              className="flex-1 h-10 bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1F1F1F] dark:hover:bg-[#272727] text-zinc-700 dark:text-zinc-200 font-semibold rounded-xl text-sm transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={cm.saving}
              className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
            >
              {cm.saving ? 'กำลังบันทึก...' : cm.editingCat ? 'บันทึกการแก้ไข' : 'สร้างหมวดหมู่'}
            </button>
          </div>
        </form>
      </AdminModalShell>

      <div className="bg-white dark:bg-[#181818] p-4 rounded-2xl border border-zinc-200 dark:border-[#272727] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {cm.categories.length > 0 && (
            <label className="inline-flex items-center gap-2 cursor-pointer bg-zinc-50 dark:bg-[#1F1F1F] px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-[#272727] hover:border-zinc-300 dark:hover:border-[#313131] transition-colors duration-300">
              <input
                type="checkbox"
                checked={cm.isAllCurrentPageSelected}
                onChange={cm.handleSelectAllInPage}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 select-none tabular-nums">
                เลือกหน้านี้ {cm.selectedCountInPage > 0 ? `(${cm.selectedCountInPage})` : ''}
              </span>
            </label>
          )}
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 tabular-nums">
            ทั้งหมด {cm.categories.length.toLocaleString('th-TH')} หมวด
          </span>
          {cm.categories.length > 0 && (
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-[#1F1F1F] px-2 py-0.5 rounded-md tabular-nums">
              หน้า {cm.currentPage}/{cm.totalPages}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end">
          {cm.categories.length > 1 && (
            <button
              type="button"
              onClick={cm.toggleSortOrder}
              className="h-10 inline-flex items-center gap-1.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-[#1F1F1F] dark:hover:bg-[#272727] px-3 rounded-xl border border-zinc-200 dark:border-[#272727] text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
            >
              <SortIcon className="w-3.5 h-3.5 text-zinc-400" />
              <span>{cm.sortOrder === 'asc' ? 'เก่าไปใหม่' : 'ใหม่ไปเก่า'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={cm.handleOpenCreateForm}
            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer inline-flex items-center gap-1.5 shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            <span>เพิ่มหมวดหมู่</span>
          </button>
        </div>
      </div>

      <section className="space-y-3">
        {cm.loading ? (
          <LoadingScreen text="กำลังโหลดหมวดหมู่วิชา..." />
        ) : cm.categories.length === 0 ? (
          <EmptyState
            icon={<FolderIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
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
              <article
                key={cat.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-colors duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-500/10 ring-1 ring-indigo-500/30'
                    : cm.editingCat?.id === cat.id
                      ? 'border-indigo-400 dark:border-indigo-500/60 bg-white dark:bg-[#181818]'
                      : 'bg-white dark:bg-[#181818] border-zinc-200 dark:border-[#272727] hover:border-zinc-300 dark:hover:border-[#313131]'
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
                      <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-md">
                        {cat.name}
                      </h3>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-md border shrink-0 ${
                          cat.is_active
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25'
                            : 'bg-zinc-100 dark:bg-[#1F1F1F] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-[#272727]'
                        }`}
                      >
                        {cat.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </span>
                      {isOwner ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25 shrink-0">
                          เจ้าของหลัก
                        </span>
                      ) : isCoOwner ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/25 shrink-0">
                          เจ้าของร่วม
                        </span>
                      ) : null}
                      {coOwnersCount > 0 && (
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-[#1F1F1F] px-2 py-0.5 rounded-md tabular-nums">
                          ดูแลร่วม {coOwnersCount} คน
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {cat.description || 'ไม่มีคำอธิบาย'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto shrink-0 pt-3 sm:pt-0 border-t sm:border-0 border-zinc-200 dark:border-[#272727] w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => cm.setShareTargetCat(cat)}
                    className="h-8 px-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-500/25 rounded-lg text-xs font-semibold transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer inline-flex items-center gap-1"
                    title="แชร์สิทธิ์การจัดการวิชานี้ให้ Creator คนอื่น"
                  >
                    <UsersIcon className="w-3.5 h-3.5" />
                    <span>แชร์สิทธิ์</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => cm.handleToggleStatus(cat)}
                    className={`h-8 px-2.5 rounded-lg text-xs font-semibold transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer border ${
                      cat.is_active
                        ? 'bg-zinc-50 hover:bg-zinc-100 dark:bg-[#1F1F1F] dark:hover:bg-[#272727] text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-[#272727]'
                        : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25'
                    }`}
                  >
                    {cat.is_active ? 'ซ่อน' : 'เปิดใช้'}
                  </button>

                  <button
                    type="button"
                    onClick={() => cm.handleOpenEditForm(cat)}
                    className="h-8 px-2.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-[#1F1F1F] dark:hover:bg-[#272727] text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-[#272727] rounded-lg text-xs font-semibold transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer inline-flex items-center gap-1"
                  >
                    <EditIcon className="w-3.5 h-3.5" />
                    <span>แก้ไข</span>
                  </button>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => cm.setDeleteTarget([cat.id])}
                      aria-label={`ลบหมวด ${cat.name}`}
                      className="h-8 w-8 text-zinc-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors duration-300 cursor-pointer inline-flex items-center justify-center"
                      title="ลบหมวดหมู่"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </article>
            )
          })
        )}
      </section>

      {cm.totalPages > 1 && (
        <nav aria-label="เปลี่ยนหน้าหมวดหมู่" className="pt-2 flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => cm.setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={cm.currentPage === 1}
            className="h-8 px-3 bg-white dark:bg-[#181818] border border-zinc-200 dark:border-[#272727] rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#272727] disabled:opacity-35 disabled:cursor-not-allowed transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
          >
            ก่อนหน้า
          </button>
          <div className="flex items-center gap-1 mx-1 overflow-x-auto">
            {[...Array(cm.totalPages)].map((_, i) => (
              <button
                type="button"
                key={i}
                onClick={() => cm.setCurrentPage(i + 1)}
                aria-current={cm.currentPage === i + 1 ? 'page' : undefined}
                className={`w-8 h-8 shrink-0 rounded-lg text-xs font-semibold tabular-nums transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer ${
                  cm.currentPage === i + 1
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-[#181818] text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-[#272727] hover:bg-zinc-100 dark:hover:bg-[#272727]'
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
            className="h-8 px-3 bg-white dark:bg-[#181818] border border-zinc-200 dark:border-[#272727] rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-[#272727] disabled:opacity-35 disabled:cursor-not-allowed transition-all duration-300 ease-premium active:scale-[0.98] cursor-pointer"
          >
            ถัดไป
          </button>
        </nav>
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
