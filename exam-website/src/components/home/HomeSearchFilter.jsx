export default function HomeSearchFilter({
  categories,
  searchQuery,
  selectedFilter,
  onSearchChange,
  onFilterChange,
  onClear
}) {
  return (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
      <div className="relative flex-1">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">🔍</span>
        <input
          type="text"
          placeholder="พิมพ์ชื่อวิชา หรือรหัส Subject Code (เช่น #486002)..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        />
        {searchQuery && (
          <button type="button" onClick={() => onSearchChange('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">
            ✕
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <select
          value={selectedFilter}
          onChange={(e) => onFilterChange(e.target.value)}
          className="w-full sm:w-56 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
        >
          <option value="ALL">💡 แสดงทุกสาระการเรียนรู้ </option>
          {categories.map((category) => <option key={category.id} value={category.id}>📖 {category.name}</option>)}
        </select>
        {(searchQuery || selectedFilter !== 'ALL') && (
          <button type="button" onClick={onClear} className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer" title="ล้างการค้นหา">
            ล้าง
          </button>
        )}
      </div>
    </div>
  )
}
