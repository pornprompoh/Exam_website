export default function GeneratorSettings({
  categories,
  selectedCategory,
  questionCount,
  difficulty,
  language,
  distributionMode,
  filesLength,
  promptHint,
  promptPresets,
  onCategoryChange,
  onQuestionCountChange,
  onDifficultyChange,
  onLanguageChange,
  onDistributionChange,
  onPromptHintChange
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-300">หมวดหมู่วิชา
          <select value={selectedCategory} onChange={(event) => onCategoryChange(event.target.value)} required className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-white">
            <option value="">เลือกหมวดหมู่</option>
            {categories?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-300">จำนวนข้อสอบ (1-100)
          <input type="number" min="1" max="100" value={questionCount} onChange={(event) => onQuestionCountChange(event.target.value)} required className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-white" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-300">ระดับความยาก
          <select value={difficulty} onChange={(event) => onDifficultyChange(event.target.value)} className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-white">
            <option value="balanced">สมดุลมาตรฐาน (ง่าย 30% / ปานกลาง 50% / ยาก 20%)</option>
            <option value="easy">ง่าย - ความจำ/พื้นฐาน (Recall/Definition)</option>
            <option value="medium">ปานกลาง - ความเข้าใจ/ประยุกต์ใช้ (Application)</option>
            <option value="hard">ยาก - วิเคราะห์/แก้ปัญหา (Analytical/Problem-Solving)</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-300">ภาษาของข้อสอบ
          <select value={language} onChange={(event) => onLanguageChange(event.target.value)} className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-white">
            <option value="th_tech">ไทย (คงศัพท์เทคนิคภาษาอังกฤษในวงเล็บ)</option>
            <option value="th">ภาษาไทยล้วน</option>
            <option value="en">ภาษาอังกฤษล้วน (English)</option>
            <option value="original">ตามภาษาต้นฉบับของเอกสาร</option>
          </select>
        </label>
      </div>
      {filesLength > 1 && (
        <fieldset className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <legend className="px-1 text-xs font-bold text-slate-300">การกระจายข้อสอบ</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-300"><input type="radio" name="distribution-mode" value="even" checked={distributionMode === 'even'} onChange={(event) => onDistributionChange(event.target.value)} className="mt-0.5 accent-indigo-500" /><span><strong className="text-white">กระจายเท่าๆ กัน (Evenly Distributed)</strong><br />แบ่งโควตาเฉลี่ยตามจำนวนไฟล์</span></label>
            <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-300"><input type="radio" name="distribution-mode" value="importance" checked={distributionMode === 'importance'} onChange={(event) => onDistributionChange(event.target.value)} className="mt-0.5 accent-indigo-500" /><span><strong className="text-white">ตามความสำคัญ (Importance-based)</strong><br />ให้น้ำหนักตามเนื้อหาและจุดสำคัญ</span></label>
          </div>
        </fieldset>
      )}
      <label className="block text-xs font-bold text-slate-300">Prompt Hint เพิ่มเติม (ไม่บังคับ)
        <textarea value={promptHint} onChange={(event) => onPromptHintChange(event.target.value)} rows="4" placeholder="เช่น เน้นความเข้าใจเชิงวิเคราะห์ ระดับยาก..." className="mt-2 w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-white placeholder-slate-600" />
      </label>
      <div className="flex flex-wrap gap-2">
        {promptPresets.map((preset) => {
          const isSelected = promptHint.split('\n').includes(preset)
          return <button key={preset} type="button" onClick={() => onPromptHintChange(isSelected ? promptHint.split('\n').filter((line) => line && line !== preset).join('\n') : [...promptHint.split('\n').filter(Boolean), preset].join('\n'))} className={`rounded-full border px-3 py-1.5 text-xs transition-colors cursor-pointer ${isSelected ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200' : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500 hover:text-white'}`}>{isSelected ? '✓ ' : '+ '}{preset}</button>
        })}
      </div>
    </>
  )
}
