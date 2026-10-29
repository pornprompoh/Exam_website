export default function ExamPreviewTable({ questions, onChangeQuestion, onChangeOption, onRemoveQuestion }) {
  return (
    <div className="space-y-4">
      {questions.map((item, index) => (
        <div key={`${index}-${item.source_topic}`} className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs font-black text-indigo-300">ข้อที่ {index + 1}</span>
            <button type="button" onClick={() => onRemoveQuestion(index)} className="text-xs text-red-400 hover:text-red-300 cursor-pointer">ลบข้อนี้</button>
          </div>
          <input value={item.question_text} onChange={(event) => onChangeQuestion(index, 'question_text', event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-white" placeholder="โจทย์คำถาม" />
          <div className="grid gap-2 sm:grid-cols-2">
            {item.options.map((option, optionIndex) => <div key={optionIndex} className="flex items-center gap-2"><input type="radio" name={`correct-${index}`} checked={Number(item.correct_option) === optionIndex} onChange={() => onChangeQuestion(index, 'correct_option', optionIndex)} className="accent-emerald-500" /><input value={option} onChange={(event) => onChangeOption(index, optionIndex, event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-900 p-2 text-sm text-white" placeholder={`ตัวเลือก ${optionIndex + 1}`} /></div>)}
          </div>
          <textarea value={item.explanation} onChange={(event) => onChangeQuestion(index, 'explanation', event.target.value)} rows="2" className="w-full rounded-lg border border-slate-800 bg-slate-900 p-2 text-sm text-white" placeholder="คำอธิบายเฉลย" />
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-xs text-amber-200">แหล่งที่มา: {item.source_topic || 'ไม่ระบุ'}</div>
        </div>
      ))}
    </div>
  )
}
