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
  const inputClass =
    'mt-1.5 w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors'

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          หมวดหมู่วิชา
          <select
            value={selectedCategory}
            onChange={(event) => onCategoryChange(event.target.value)}
            required
            className={`${inputClass} cursor-pointer`}
          >
            <option value="">เลือกหมวดหมู่</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          จำนวนข้อสอบ (1–100)
          <input
            type="number"
            min="1"
            max="100"
            value={questionCount}
            onChange={(event) => onQuestionCountChange(event.target.value)}
            required
            className={`${inputClass} tabular-nums`}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          ระดับความยาก
          <select
            value={difficulty}
            onChange={(event) => onDifficultyChange(event.target.value)}
            className={`${inputClass} cursor-pointer`}
          >
            <option value="balanced">สมดุลมาตรฐาน (ง่าย 30% / ปานกลาง 50% / ยาก 20%)</option>
            <option value="easy">ง่าย — ความจำ / พื้นฐาน</option>
            <option value="medium">ปานกลาง — ความเข้าใจ / ประยุกต์ใช้</option>
            <option value="hard">ยาก — วิเคราะห์ / แก้ปัญหา</option>
          </select>
        </label>

        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          ภาษาของข้อสอบ
          <select
            value={language}
            onChange={(event) => onLanguageChange(event.target.value)}
            className={`${inputClass} cursor-pointer`}
          >
            <option value="th_tech">ไทย (คงศัพท์เทคนิคอังกฤษในวงเล็บ)</option>
            <option value="th">ภาษาไทยล้วน</option>
            <option value="en">ภาษาอังกฤษล้วน (English)</option>
            <option value="original">ตามภาษาต้นฉบับของเอกสาร</option>
          </select>
        </label>
      </div>

      {filesLength > 1 && (
        <fieldset className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4">
          <legend className="px-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            การกระจายข้อสอบข้ามหลายไฟล์
          </legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="radio"
                name="distribution-mode"
                value="even"
                checked={distributionMode === 'even'}
                onChange={(event) => onDistributionChange(event.target.value)}
                className="mt-0.5 accent-indigo-600 cursor-pointer"
              />
              <span>
                <strong className="text-slate-900 dark:text-white font-semibold">กระจายเท่ากัน</strong>
                <br />
                แบ่งโควตาเฉลี่ยตามจำนวนไฟล์
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="radio"
                name="distribution-mode"
                value="importance"
                checked={distributionMode === 'importance'}
                onChange={(event) => onDistributionChange(event.target.value)}
                className="mt-0.5 accent-indigo-600 cursor-pointer"
              />
              <span>
                <strong className="text-slate-900 dark:text-white font-semibold">ตามความสำคัญ</strong>
                <br />
                ให้น้ำหนักตามเนื้อหาและจุดสำคัญ
              </span>
            </label>
          </div>
        </fieldset>
      )}

      <div className="space-y-2.5">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          คำแนะนำเพิ่มเติมสำหรับ AI (ไม่บังคับ)
          <textarea
            value={promptHint}
            onChange={(event) => onPromptHintChange(event.target.value)}
            rows="3"
            placeholder="เช่น เน้นโจทย์วิเคราะห์สถานการณ์สมมติ หรือระบุจุดที่ต้องการเน้น..."
            className="mt-1.5 w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          />
        </label>

        <div className="flex flex-wrap gap-1.5">
          {promptPresets.map((preset) => {
            const isSelected = promptHint.split('\n').includes(preset)
            return (
              <button
                key={preset}
                type="button"
                onClick={() =>
                  onPromptHintChange(
                    isSelected
                      ? promptHint.split('\n').filter((line) => line && line !== preset).join('\n')
                      : [...promptHint.split('\n').filter(Boolean), preset].join('\n')
                  )
                }
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-indigo-300 dark:border-indigo-500/50 bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-200'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500/40'
                }`}
              >
                {isSelected ? '✓ ' : '+ '}
                {preset}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
