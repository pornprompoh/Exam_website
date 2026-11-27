import { CloseIcon, SearchIcon } from '../../../shared/components/AdminIcons'

export default function HomeSearchFilter({
  categories,
  searchQuery,
  selectedFilter,
  onSearchChange,
  onFilterChange,
  onClear
}) {
  return (
    <div className="bg-white dark:bg-[#181818] p-3.5 sm:p-4 rounded-2xl border border-zinc-200 dark:border-[#272727] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 transition-colors duration-300">
      <div className="relative flex-1">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
          <SearchIcon className="w-4 h-4" />
        </span>
        <input
          type="text"
          aria-label="ค้นหาชื่อวิชาหรือรหัสวิชา"
          placeholder="พิมพ์ชื่อวิชา หรือรหัสวิชา (เช่น #486002)..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-9 py-2.5 bg-zinc-50 dark:bg-[#1F1F1F] hover:bg-zinc-100/70 dark:hover:bg-[#272727] focus:bg-white dark:focus:bg-[#272727] border border-zinc-200 dark:border-[#313131] rounded-xl text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300 ease-premium"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="ล้างคำค้นหา"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <select
          aria-label="กรองตามหมวดวิชา"
          value={selectedFilter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="w-full sm:w-56 px-3.5 py-2.5 bg-zinc-50 dark:bg-[#1F1F1F] hover:bg-zinc-100/70 dark:hover:bg-[#272727] border border-zinc-200 dark:border-[#313131] rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-300 ease-premium cursor-pointer"
        >
          <option value="ALL">แสดงทุกหมวดวิชา</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        {(searchQuery || selectedFilter !== 'ALL') && (
          <button
            type="button"
            onClick={onClear}
            className="px-3.5 py-2.5 bg-zinc-100 dark:bg-[#272727] hover:bg-zinc-200 dark:hover:bg-[#313131] active:scale-[0.98] text-zinc-700 dark:text-zinc-200 rounded-xl text-sm font-medium transition-all duration-300 ease-premium shrink-0 cursor-pointer"
            title="ล้างการค้นหา"
          >
            ล้าง
          </button>
        )}
      </div>
    </div>
  )
}
