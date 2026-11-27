import ConfirmModal from '../../../shared/components/ConfirmModal'
import EmptyState from '../../../shared/components/EmptyState'
import AdminModalShell from '../../../shared/components/AdminModalShell'
import PaginationBar from '../../../shared/components/PaginationBar'
import { EditIcon, FolderIcon, PlusIcon } from '../../../shared/components/AdminIcons'
import AIKeyRequiredModal from '../../admin-ai/shared/components/AIKeyRequiredModal'
import AIExamGeneratorModal from '../../admin-ai/generator/components/AIExamGeneratorModal'
import AIExamExtractorModal from '../../admin-ai/extractor/components/AIExamExtractorModal'
import AIExamAuditorModal from '../../admin-ai/auditor/components/AIExamAuditorModal'
import { QUESTIONS_PER_PAGE } from '../services/questionService'
import { useQuestionManager } from '../hooks/useQuestionManager'
import QuestionFilterBar from '../components/QuestionFilterBar'
import QuestionToolsMenu from '../components/QuestionToolsMenu'
import QuestionStatusStrip from '../components/QuestionStatusStrip'
import QuestionForm from '../components/QuestionForm'
import QuestionTable from '../components/QuestionTable'
import BulkImportModal from '../components/BulkImportModal'

export default function QuestionManagerPage() {
  const qm = useQuestionManager()

  return (
    <div className="space-y-4 relative">
      <ConfirmModal
        isOpen={!!qm.deleteTarget}
        type="danger"
        title="ยืนยันการลบข้อสอบนี้?"
        description="ข้อสอบและไฟล์รูปภาพประกอบจะถูกลบออกจากระบบและคลังข้อผิดพลาดถาวร"
        confirmText="ลบข้อสอบถาวร"
        cancelText="ยกเลิก"
        onClose={() => qm.setDeleteTarget(null)}
        onConfirm={qm.handleConfirmDelete}
      />

      <ConfirmModal
        isOpen={qm.showBulkDeleteConfirm}
        type="danger"
        title={`ยืนยันลบข้อสอบที่เลือก ${qm.selectedIds.length} ข้อ?`}
        description="ข้อสอบที่เลือกไว้ทั้งหมด รวมถึงไฟล์รูปภาพประกอบ จะถูกลบออกจากระบบอย่างถาวรและไม่สามารถกู้คืนได้"
        confirmText={`ลบทั้ง ${qm.selectedIds.length} ข้อ`}
        cancelText="ยกเลิก"
        onClose={() => qm.setShowBulkDeleteConfirm(false)}
        onConfirm={qm.handleConfirmBulkDelete}
      />

      <ConfirmModal
        isOpen={qm.showClearStagingConfirm}
        type="danger"
        title={`ยืนยันล้าง Draft ทั้งหมด (${qm.stagingCount} ข้อ)?`}
        description="ข้อสอบ Draft ในตาราง Staging และ Checkpoint ของหมวดหมู่นี้จะถูกลบออกทั้งหมด (ไม่กระทบข้อสอบหลักที่เผยแพร่แล้ว)"
        confirmText={`ล้าง Draft (${qm.stagingCount} ข้อ)`}
        cancelText="ยกเลิก"
        onClose={() => qm.setShowClearStagingConfirm(false)}
        onConfirm={qm.handleConfirmClearCategoryDrafts}
      />

      <ConfirmModal
        isOpen={qm.modalConfig.isOpen}
        type={qm.modalConfig.type}
        title={qm.modalConfig.title}
        description={qm.modalConfig.description}
        confirmText="ตกลง"
        cancelText=""
        onConfirm={qm.closeModal}
        onClose={qm.closeModal}
      />

      {qm.showAIKeyRequired && (
        <AIKeyRequiredModal
          onClose={() => qm.setShowAIKeyRequired(false)}
          onGoToSettings={qm.handleGoToAISettings}
        />
      )}

      <BulkImportModal
        isOpen={qm.showBulkModal}
        onClose={() => qm.setShowBulkModal(false)}
        categoryId={qm.selectedCat}
        currentUserId={qm.currentUserId}
        onSuccess={() => {
          qm.setCurrentPage(1)
          qm.setSelectedIds([])
          qm.fetchQuestions(qm.selectedCat, 1, qm.sortOrder)
        }}
      />

      <AIExamGeneratorModal
        key={`ai-generator-${qm.selectedCat || 'empty'}`}
        isOpen={qm.showAIGeneratorModal}
        onClose={() => qm.setShowAIGeneratorModal(false)}
        categories={qm.categories}
        categoryId={qm.selectedCat}
        currentUserId={qm.currentUserId}
        onNotify={qm.showModal}
        onGoToSettings={qm.handleGoToAISettings}
        onSuccess={() => {
          qm.setCurrentPage(1)
          qm.setSelectedIds([])
          qm.fetchQuestions(qm.selectedCat, 1, qm.sortOrder)
        }}
      />

      <AIExamExtractorModal
        key={`ai-extractor-${qm.selectedCat || 'empty'}-${qm.extractorInitialTab}-${qm.showAIExtractorModal ? 'open' : 'closed'}`}
        isOpen={qm.showAIExtractorModal}
        onClose={() => {
          qm.setShowAIExtractorModal(false)
          qm.refreshStagingCount(qm.selectedCat, qm.userRole)
        }}
        categories={qm.categories}
        categoryId={qm.selectedCat}
        currentUserId={qm.currentUserId}
        initialTab={qm.extractorInitialTab}
        onNotify={qm.showModal}
        onGoToSettings={qm.handleGoToAISettings}
        onStagingCountChange={qm.setStagingCount}
        onSuccess={() => {
          qm.setCurrentPage(1)
          qm.setSelectedIds([])
          qm.fetchQuestions(qm.selectedCat, 1, qm.sortOrder)
          qm.refreshStagingCount(qm.selectedCat, qm.userRole)
          qm.refreshFlaggedCounts(qm.selectedCat)
        }}
      />

      <AIExamAuditorModal
        key={`ai-auditor-${qm.selectedCat || 'ALL'}-${qm.auditorInitialTab}-${qm.showAIAuditorModal ? 'open' : 'closed'}`}
        isOpen={qm.showAIAuditorModal}
        onClose={() => {
          qm.setShowAIAuditorModal(false)
          qm.refreshFlaggedCounts(qm.selectedCat)
        }}
        categories={qm.categories}
        categoryId={
          qm.auditorInitialTab === 'flagged' &&
          qm.flaggedCounts.categoryFlagged === 0 &&
          qm.flaggedCounts.totalFlagged > 0
            ? 'ALL'
            : qm.selectedCat
        }
        initialTab={qm.auditorInitialTab}
        onNotify={qm.showModal}
        onGoToSettings={qm.handleGoToAISettings}
        onQuestionsChanged={({ reloadTable = false } = {}) => {
          qm.refreshFlaggedCounts(qm.selectedCat)
          if (reloadTable) {
            qm.fetchQuestions(qm.selectedCat, qm.currentPage, qm.sortOrder)
          }
        }}
      />

      <AdminModalShell
        isOpen={qm.isFormOpen}
        onClose={qm.handleCloseForm}
        title={qm.editingQuestion ? 'แก้ไขโจทย์ข้อสอบ' : 'สร้างโจทย์ข้อสอบใหม่'}
        subtitle={
          qm.editingQuestion
            ? `รหัสข้อสอบ: ${qm.editingQuestion.id.substring(0, 8)}...`
            : 'เพิ่มโจทย์ ตัวเลือก และเฉลยทีละข้อลงในคลัง'
        }
        titleId="question-form-drawer-title"
        icon={qm.editingQuestion ? <EditIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
        maxWidth="max-w-xl"
      >
        <QuestionForm
          selectedCat={qm.selectedCat}
          currentUserId={qm.currentUserId}
          editingQuestion={qm.editingQuestion}
          onCancelEdit={qm.handleCloseForm}
          onSaveSuccess={() => {
            qm.handleCloseForm()
            qm.fetchQuestions(qm.selectedCat, qm.currentPage, qm.sortOrder)
          }}
          showModal={qm.showModal}
        />
      </AdminModalShell>

      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <QuestionFilterBar
          categories={qm.categories}
          selectedCategory={qm.selectedCat}
          onCategoryChange={qm.handleCategoryChange}
          searchValue={qm.questionSearch}
          onSearchChange={qm.setQuestionSearch}
        >
          <QuestionToolsMenu
            toolsMenuRef={qm.toolsMenuRef}
            showToolsMenu={qm.showToolsMenu}
            disabled={qm.categories.length === 0}
            alertBadgeCount={qm.alertBadgeCount}
            hasDrafts={qm.hasDrafts}
            stagingCount={qm.stagingCount}
            hasFlagged={qm.hasFlagged}
            flaggedCounts={qm.flaggedCounts}
            onToggleMenu={() => qm.setShowToolsMenu((prev) => !prev)}
            onOpenExtractor={() => qm.handleOpenAIExtractor('extract')}
            onOpenGenerator={qm.handleOpenAIGenerator}
            onOpenAuditor={() => qm.handleOpenAIAuditor(qm.flaggedCounts.categoryFlagged > 0 ? 'flagged' : 'scan')}
            onOpenBulkImport={() => {
              qm.setShowToolsMenu(false)
              qm.setShowBulkModal(true)
            }}
          />

          <button
            type="button"
            onClick={qm.handleOpenCreateForm}
            disabled={qm.categories.length === 0}
            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            <span>เพิ่มข้อสอบ</span>
          </button>
        </QuestionFilterBar>
      </div>

      <QuestionStatusStrip
        hasFlagged={qm.hasFlagged}
        hasDrafts={qm.hasDrafts}
        flaggedCounts={qm.flaggedCounts}
        stagingCount={qm.stagingCount}
        onOpenFlaggedAuditor={() => qm.handleOpenAIAuditor('flagged')}
        onOpenStagingExtractor={() => qm.handleOpenAIExtractor('staging')}
        onRequestClearDrafts={() => qm.setShowClearStagingConfirm(true)}
      />

      {qm.categories.length === 0 ? (
        <EmptyState
          icon={<FolderIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />}
          title="ยังไม่มีหมวดหมู่วิชาในระบบ"
          description="กรุณาสร้างหมวดหมู่วิชาในหน้าจัดการหมวดหมู่ก่อนเริ่มเพิ่มข้อสอบ"
          actionText="ไปหน้าจัดการหมวดหมู่"
          onAction={() => qm.navigate('/admin/categories')}
        />
      ) : (
        <div className="w-full space-y-5">
          <QuestionTable
            questions={qm.questions}
            searchValue={qm.questionSearch}
            loading={qm.loading}
            userRole={qm.userRole}
            totalCount={qm.totalCount}
            currentPage={qm.currentPage}
            sortOrder={qm.sortOrder}
            highlightedNum={qm.highlightedNum}
            editingId={qm.editingQuestion?.id}
            onEditClick={qm.handleOpenEditForm}
            onDeleteClick={(q) => qm.setDeleteTarget(q)}
            onToggleStatus={qm.handleToggleQuestionStatus}
            onToggleSortOrder={qm.handleToggleSortOrder}
            ITEMS_PER_PAGE={QUESTIONS_PER_PAGE}
            selectedIds={qm.selectedIds}
            onSelectItem={qm.handleSelectItem}
            onSelectAll={qm.handleSelectAll}
            onBulkStatus={qm.handleBulkStatus}
            onBulkDelete={() => qm.setShowBulkDeleteConfirm(true)}
            onBulkMove={qm.handleBulkMove}
            categories={qm.categories}
          />

          <PaginationBar
            totalCount={qm.totalCount}
            currentPage={qm.currentPage}
            totalPages={qm.totalPages}
            startItemNumber={qm.startItemNumber}
            endItemNumber={qm.endItemNumber}
            pageJumpInput={qm.pageJumpInput}
            setPageJumpInput={qm.setPageJumpInput}
            questionJumpInput={qm.questionJumpInput}
            setQuestionJumpInput={qm.setQuestionJumpInput}
            onPageChange={qm.handlePageChange}
            onPageJumpSubmit={qm.handlePageJumpSubmit}
            onQuestionJumpSubmit={qm.handleQuestionJumpSubmit}
          />
        </div>
      )}
    </div>
  )
}
