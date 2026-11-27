import LoadingScreen from '../../../shared/components/LoadingScreen'
import EmptyState from '../../../shared/components/EmptyState'
import ConfirmModal from '../../../shared/components/ConfirmModal'
import { SearchIcon, UsersIcon } from '../../../shared/components/AdminIcons'
import useUserManager from '../hooks/useUserManager'

const ROLE_TABS = [
  { key: 'ALL', label: 'ทั้งหมด' },
  { key: 'admin', label: 'แอดมิน' },
  { key: 'creator', label: 'ผู้ช่วยสร้าง' },
  { key: 'student', label: 'นักเรียน' }
]

function renderRoleBadge(role) {
  switch (role) {
    case 'admin':
      return (
        <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 px-2 py-0.5 rounded-md text-xs font-semibold shrink-0">
          แอดมิน
        </span>
      )
    case 'creator':
      return (
        <span className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 px-2 py-0.5 rounded-md text-xs font-semibold shrink-0">
          ผู้ช่วยสร้างข้อสอบ
        </span>
      )
    default:
      return (
        <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 px-2 py-0.5 rounded-md text-xs font-semibold shrink-0">
          นักเรียน
        </span>
      )
  }
}

export default function UserManagerPage() {
  const um = useUserManager()

  return (
    <div className="space-y-5 relative">
      <ConfirmModal
        isOpen={!!um.roleModalTarget}
        type="warning"
        title="ยืนยันการเปลี่ยนสิทธิ์ผู้ใช้งาน"
        description={
          um.roleModalTarget && (
            <>
              ต้องการเปลี่ยนสิทธิ์ของ{' '}
              <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                {um.roleModalTarget.user.display_name || um.roleModalTarget.user.email || 'ผู้ใช้งาน'}
              </strong>{' '}
              เป็น{' '}
              <strong className="font-semibold text-indigo-600 dark:text-indigo-400">
                {um.roleModalTarget.newRole === 'admin'
                  ? 'ผู้ดูแลระบบสูงสุด (Admin)'
                  : um.roleModalTarget.newRole === 'creator'
                    ? 'ผู้ช่วยสร้างข้อสอบ (Creator)'
                    : 'นักเรียน (Student)'}
              </strong>{' '}
              ใช่หรือไม่
            </>
          )
        }
        confirmText="ยืนยันเปลี่ยนสิทธิ์"
        cancelText="ยกเลิก"
        onClose={() => um.setRoleModalTarget(null)}
        onConfirm={um.handleConfirmRoleChange}
      />

      <ConfirmModal
        isOpen={um.alertModal.isOpen}
        type={um.alertModal.type}
        title={um.alertModal.title}
        description={um.alertModal.desc}
        confirmText="ตกลง"
        cancelText=""
        onConfirm={um.closeAlert}
        onClose={um.closeAlert}
      />

      <div className="bg-white dark:bg-[#181818] p-4 rounded-2xl border border-zinc-200 dark:border-[#272727] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md min-w-0">
          <SearchIcon className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="ค้นหาชื่อ อีเมล หรือ ID..."
            value={um.searchQuery}
            onChange={(e) => um.setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3.5 bg-zinc-50 dark:bg-[#1F1F1F] border border-zinc-200 dark:border-[#272727] rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-300"
          />
        </div>

        <div className="inline-flex items-center p-1 rounded-xl border border-zinc-200 dark:border-[#272727] bg-zinc-100 dark:bg-[#1F1F1F] overflow-x-auto shrink-0">
          {ROLE_TABS.map((tab) => (
            <button
              type="button"
              key={tab.key}
              onClick={() => um.setRoleFilter(tab.key)}
              className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all duration-300 ease-premium cursor-pointer shrink-0 ${
                um.roleFilter === tab.key
                  ? 'bg-white dark:bg-[#272727] text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <section className="bg-white dark:bg-[#181818] rounded-2xl border border-zinc-200 dark:border-[#272727] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-[#272727] bg-zinc-50 dark:bg-[#1F1F1F] flex items-center justify-between text-xs font-semibold text-zinc-600 dark:text-zinc-400">
          <span className="tabular-nums">รายชื่อผู้ใช้งาน ({um.filteredUsers.length.toLocaleString('th-TH')} บัญชี)</span>
        </div>

        {um.loading ? (
          <div className="p-5">
            <LoadingScreen text="กำลังโหลดรายชื่อผู้ใช้งาน..." />
          </div>
        ) : um.filteredUsers.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<UsersIcon className="w-5 h-5 text-zinc-400" />}
              title="ไม่พบผู้ใช้งานตามที่ค้นหา"
              description="ลองเปลี่ยนคำค้นหาหรือล้างตัวกรองสิทธิ์ด้านบน"
            />
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-[#272727]">
            {um.filteredUsers.map((u) => {
              const isSelf = u.id === um.currentUserId
              const initial = (u.display_name || u.email || 'U').charAt(0).toUpperCase()

              return (
                <div
                  key={u.id}
                  className="px-5 py-4 hover:bg-zinc-50 dark:hover:bg-[#1F1F1F] transition-colors duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 min-w-0"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-[#272727] border border-zinc-200 dark:border-[#313131] text-zinc-700 dark:text-zinc-200 font-bold text-sm flex items-center justify-center shrink-0">
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0 mb-0.5">
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm truncate">
                          {u.display_name || 'ผู้ใช้ไม่ระบุชื่อ'}
                        </h3>
                        {isSelf && (
                          <span className="bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-xs font-semibold px-1.5 py-0.5 rounded-md shrink-0">
                            คุณ
                          </span>
                        )}
                        <div className="sm:hidden ml-auto">{renderRoleBadge(u.role || 'student')}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="truncate font-mono">{u.email || `ID: ${u.id.substring(0, 12)}...`}</span>
                        <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">•</span>
                        <span className="tabular-nums">
                          สมัครเมื่อ {u.created_at ? new Date(u.created_at).toLocaleDateString('th-TH') : 'ไม่ระบุ'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto pt-3 sm:pt-0 border-t sm:border-0 border-zinc-100 dark:border-[#272727] shrink-0">
                    <div className="hidden sm:block">{renderRoleBadge(u.role || 'student')}</div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium sm:hidden">สิทธิ์:</span>
                      <select
                        aria-label={`เปลี่ยนสิทธิ์ของ ${u.display_name || u.email || 'ผู้ใช้งาน'}`}
                        value={u.role || 'student'}
                        disabled={isSelf}
                        onChange={(e) => um.handleRoleDropdownChange(u, e.target.value)}
                        className={`w-full sm:w-44 h-9 px-3 rounded-xl text-xs font-semibold border transition-colors duration-300 ${
                          isSelf
                            ? 'bg-zinc-100 dark:bg-[#1F1F1F]/60 border-zinc-200 dark:border-[#272727] text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                            : 'bg-zinc-50 dark:bg-[#1F1F1F] border-zinc-200 dark:border-[#313131] text-zinc-900 dark:text-zinc-100 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer'
                        }`}
                        title={isSelf ? 'ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้' : 'เลือกสิทธิ์ผู้ใช้งาน'}
                      >
                        <option value="student">นักเรียน (Student)</option>
                        <option value="creator">ผู้ช่วยสร้าง (Creator)</option>
                        <option value="admin">แอดมิน (Admin)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
