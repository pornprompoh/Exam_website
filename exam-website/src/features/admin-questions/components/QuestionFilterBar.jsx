import { SearchIcon } from '../../../shared/components/AdminIcons'

export default function QuestionFilterBar({
  categories,
  selectedCategory,
  onCategoryChange,
  searchValue = '',
  onSearchChange,
  children
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 w-full">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 min-w-0">
        {categories.length > 0 ? (
          <select
            aria-label="เลือกหมวดหมู่วิชา"
            value={selectedCategory}
            onChange={(event) => onCategoryChange(event.target.value)}
            className="w-full sm:w-64 lg:w-60 h-10 px-3 bg-zinc-50 dark:bg-[#1F1F1F] border border-zinc-200 dark:border-[#272727] rounded-xl text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-300 ease-premium cursor-pointer shrink-0"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} ({category.questionCount ?? 0} ข้อ)
              </option>
            ))}
          </select>
        ) : (
          <div className="h-10 px-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center shrink-0">
            ยังไม่มีหมวดหมู่วิชาของตนเอง
          </div>
        )}

        <div className="relative flex-1 min-w-0">
          <SearchIcon className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder="ค้นหาโจทย์ในหน้านี้..."
            aria-label="ค้นหาโจทย์ข้อสอบ"
            className="w-full h-10 pl-9 pr-3 bg-zinc-50 dark:bg-[#1F1F1F] border border-zinc-200 dark:border-[#272727] rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-300 ease-premium"
          />
        </div>
      </div>

      {children && <div className="flex items-center gap-2 shrink-0 justify-end">{children}</div>}
    </div>
  )
}
