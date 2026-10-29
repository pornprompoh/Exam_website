export default function QuestionFilterBar({ categories, selectedCategory, onCategoryChange, searchValue = '', onSearchChange, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full lg:max-w-4xl">
      <input
        type="search"
        value={searchValue}
        onChange={(event) => onSearchChange?.(event.target.value)}
        placeholder="ค้นหาโจทย์ข้อสอบ..."
        className="min-w-0 flex-[2_1_13rem] px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {categories.length > 0 ? (
        <select value={selectedCategory} onChange={(event) => onCategoryChange(event.target.value)} className="w-full sm:w-56 px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer">
          {categories.map((category) => <option key={category.id} value={category.id}>📖 {category.name} ({category.questionCount ?? 0})</option>)}
        </select>
      ) : (
        <div className="px-4 py-3 bg-slate-950 border border-red-500/30 text-red-400 rounded-2xl text-xs font-bold">⚠️ ยังไม่มีหมวดหมู่วิชาของตนเอง</div>
      )}
      {children}
    </div>
  )
}
