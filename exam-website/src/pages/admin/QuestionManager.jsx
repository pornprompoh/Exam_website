import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import LoadingScreen from '../../components/common/LoadingScreen'
import EmptyState from '../../components/common/EmptyState'
import ConfirmModal from '../../components/common/ConfirmModal'
import BulkImportModal from '../../components/admin/BulkImportModal' // <-- 1. Import คอมโพเนนต์ใหม่มาใช้ตรงนี้

export default function QuestionManager() {
  const [categories, setCategories] = useState([])
  const [questions, setQuestions] = useState([])
  const [selectedCat, setSelectedCat] = useState('')
  const [loading, setLoading] = useState(true)

  // Form State สำหรับสร้างข้อสอบทีละข้อ (Manual)
  const [questionText, setQuestionText] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctOption, setCorrectOption] = useState(0)
  const [explanation, setExplanation] = useState('')
  const [isRandomized, setIsRandomized] = useState(true)
  const [imageFile, setImageFile] = useState(null)
  const [expImageFile, setExpImageFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [existingImageUrl, setExistingImageUrl] = useState(null)
  const [existingExpImageUrl, setExistingExpImageUrl] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // 🌟 2. เหลือ State สำหรับคุมการเปิด/ปิด Modal แค่บรรทัดเดียว!
  const [showBulkModal, setShowBulkModal] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    if (selectedCat) {
      fetchQuestions(selectedCat)
      if (editingId) handleCancelEdit()
    }
  }, [selectedCat])

  async function fetchCategories() {
    try {
      const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('name')
      setCategories(data || [])
      if (data && data.length > 0) setSelectedCat(data[0].id)
    } catch (err) { console.error(err) }
  }

  async function fetchQuestions(catId) {
    setLoading(true)
    try {
      const { data } = await supabase.from('questions').select('*').eq('category_id', catId).order('created_at', { ascending: false })
      setQuestions(data || [])
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  const handleOptionChange = (index, value) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const addOption = () => {
    if (options.length < 6) setOptions([...options, ''])
  }

  const removeOption = (indexToRemove) => {
    if (options.length <= 2) return alert('ต้องมีตัวเลือกอย่างน้อย 2 ข้อครับ')
    const newOptions = options.filter((_, idx) => idx !== indexToRemove)
    setOptions(newOptions)
    if (correctOption === indexToRemove) setCorrectOption(0)
    else if (correctOption > indexToRemove) setCorrectOption(correctOption - 1)
  }

  const handleEditClick = (q) => {
    setEditingId(q.id)
    setQuestionText(q.question_text)
    setOptions(q.options || ['', '', '', ''])
    setCorrectOption(Number(q.correct_option))
    setExplanation(q.explanation || '')
    setIsRandomized(q.is_options_randomized ?? true)
    setExistingImageUrl(q.image_url)
    setExistingExpImageUrl(q.explanation_image_url)
    setImageFile(null)
    setExpImageFile(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setQuestionText('')
    setOptions(['', '', '', ''])
    setCorrectOption(0)
    setExplanation('')
    setIsRandomized(true)
    setExistingImageUrl(null)
    setExistingExpImageUrl(null)
    setImageFile(null)
    setExpImageFile(null)
  }

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target.result
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 1000
          let width = img.width
          let height = img.height
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH }
          canvas.width = width; canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' }))
          }, 'image/webp', 0.8)
        }
      }
    })
  }

  const uploadImage = async (file) => {
    if (!file) return null
    const compressedFile = await compressImage(file)
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.webp`
    const { error } = await supabase.storage.from('exam-images').upload(fileName, compressedFile)
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('exam-images').getPublicUrl(fileName)
    return publicUrl
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!questionText.trim()) return alert('กรุณากรอกโจทย์คำถาม')
    if (options.some((opt) => !opt.trim())) return alert('กรุณากรอกตัวเลือกให้ครบถ้วน')

    setSaving(true)
    try {
      let imageUrl = existingImageUrl
      if (imageFile) imageUrl = await uploadImage(imageFile)

      let expImageUrl = existingExpImageUrl
      if (expImageFile) expImageUrl = await uploadImage(expImageFile)

      const payload = {
        category_id: selectedCat,
        question_text: questionText,
        options,
        correct_option: correctOption,
        explanation,
        is_options_randomized: isRandomized,
        image_url: imageUrl,
        explanation_image_url: expImageUrl,
        is_active: true
      }

      if (editingId) {
        const { error } = await supabase.from('questions').update(payload).eq('id', editingId)
        if (error) throw error
        alert('✅ บันทึกการแก้ไขข้อสอบเรียบร้อยแล้ว')
      } else {
        const { error } = await supabase.from('questions').insert([payload])
        if (error) throw error
        alert('✅ บันทึกข้อสอบใหม่เรียบร้อยแล้ว')
      }

      handleCancelEdit()
      fetchQuestions(selectedCat)
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const { id, image_url, explanation_image_url } = deleteTarget

    try {
      if (image_url) {
        const fileName = image_url.split('/').pop()
        await supabase.storage.from('exam-images').remove([fileName])
      }
      if (explanation_image_url) {
        const fileName = explanation_image_url.split('/').pop()
        await supabase.storage.from('exam-images').remove([fileName])
      }

      const { error } = await supabase.from('questions').delete().eq('id', id)
      if (error) throw error

      setQuestions((prev) => prev.filter((q) => q.id !== id))
      if (editingId === id) handleCancelEdit()
      setDeleteTarget(null)
    } catch (err) {
      alert('ลบข้อสอบไม่สำเร็จ: ' + err.message)
    }
  }

  return (
    <div className="space-y-8 text-slate-200 overflow-x-hidden relative">
      
      <ConfirmModal
        isOpen={!!deleteTarget}
        type="danger"
        title="ยืนยันการลบข้อสอบนี้?"
        description="ข้อสอบและไฟล์รูปภาพประกอบจะถูกลบออกจากระบบและคลังข้อผิดพลาดถาวรครับ"
        confirmText="🚨 ลบข้อสอบถาวร"
        cancelText="← ยกเลิก"
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* 🌟 3. เรียกใช้ BulkImportModal ที่เราแยกออกไป คลีนและเป็นระเบียบสุดๆ! */}
      <BulkImportModal 
        isOpen={showBulkModal} 
        onClose={() => setShowBulkModal(false)} 
        categoryId={selectedCat} 
        onSuccess={() => fetchQuestions(selectedCat)} 
      />

      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl shrink-0">📚</span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white truncate">เลือกหมวดหมู่วิชาเพื่อจัดการโจทย์</h2>
            <p className="text-xs text-slate-400 truncate">โจทย์คำถามที่สร้างหรือนำเข้าจะไปอยู่ในหมวดวิชานี้ครับ</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="flex-1 sm:w-64 px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>📖 {cat.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-2xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 h-full"
            title="นำเข้าข้อสอบชุดใหญ่ด้วย AI"
          >
            <span className="hidden md:inline">⚡ นำเข้าชุดใหญ่</span>
            <span className="md:hidden">⚡ Bulk</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* คอลัมน์ซ้าย (5 คอลัมน์): ฟอร์มสร้าง/แก้ไขข้อสอบแบบ Manual */}
        <div className="lg:col-span-5 order-1 min-w-0">
          <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl sticky top-24 transition-colors ${
            editingId ? 'bg-indigo-950/40 border-indigo-500/50' : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2 min-w-0">
                <span className="shrink-0">{editingId ? '✏️' : '➕'}</span>
                <span className="truncate">{editingId ? 'แก้ไขโจทย์ข้อสอบ' : 'สร้างทีละข้อ (Manual)'}</span>
              </h3>
              {editingId && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950 animate-pulse shrink-0">
                  EDIT MODE
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">โจทย์คำถาม *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="พิมพ์โจทย์คำถามที่นี่..."
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  รูปประกอบโจทย์ {existingImageUrl && <span className="text-emerald-400">(มีรูปเดิมอยู่แล้ว)</span>}
                </label>
                {existingImageUrl && (
                  <div className="mb-2 relative inline-block">
                    <img src={existingImageUrl} alt="รูปเดิม" className="h-20 w-auto rounded-lg border border-slate-700 object-cover" />
                    <button type="button" onClick={() => setExistingImageUrl(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-[10px] font-bold flex items-center justify-center shadow">✕</button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files[0])}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 mt-1">* หากต้องการเพิ่มรูปใส่ข้อสอบที่พึ่งนำเข้า ให้กดแก้ไขข้อสอบแล้วเลือกรูปตรงนี้ครับ</p>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">ตัวเลือกคำตอบ ({options.length} ช้อยส์) *</label>
                  {options.length < 6 && (
                    <button type="button" onClick={addOption} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer">+ เพิ่มช้อยส์</button>
                  )}
                </div>

                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctOption === idx}
                      onChange={() => setCorrectOption(idx)}
                      className="w-4 h-4 accent-emerald-500 cursor-pointer shrink-0"
                      title="เลือกเป็นข้อที่ถูกต้อง"
                    />
                    <input
                      type="text"
                      required
                      placeholder={`ตัวเลือกที่ ${idx + 1}`}
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      className="w-full min-w-0 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                    {options.length > 2 && (
                      <button type="button" onClick={() => removeOption(idx)} className="text-slate-500 hover:text-red-400 text-xs font-bold px-2 py-1 cursor-pointer shrink-0">✕</button>
                    )}
                  </div>
                ))}
                <p className="text-[11px] text-amber-400 font-medium">* คลิกที่ปุ่มวงกลมหน้าข้อ เพื่อกำหนดให้เป็นคำตอบที่ถูกต้อง</p>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">คำอธิบายเฉลยละเอียด (ถ้ามี)</label>
                  <textarea
                    rows="2"
                    placeholder="อธิบายเหตุผลของคำตอบข้อนี้..."
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="randomize"
                  checked={isRandomized}
                  onChange={(e) => setIsRandomized(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer shrink-0"
                />
                <label htmlFor="randomize" className="text-xs text-slate-300 font-medium cursor-pointer leading-snug">
                  สลับตำแหน่งตัวเลือก (Randomize Options) เมื่อผู้เข้าสอบทำข้อนี้
                </label>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs sm:text-sm transition-all cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving || !selectedCat}
                  className={`flex-1 py-3.5 disabled:opacity-50 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 ${
                    editingId ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-orange-500/20' : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-600/20'
                  }`}
                >
                  <span>{saving ? '⏳ กำลังบันทึก...' : (editingId ? '💾 บันทึกการแก้ไขข้อสอบ' : '✨ บันทึกข้อสอบลงคลัง')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* คอลัมน์ขวา (7 คอลัมน์): ตารางแสดงข้อสอบทั้งหมด */}
        <div className="lg:col-span-7 order-2 space-y-4 min-w-0">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-300">
              รายการข้อสอบในหมวดนี้ ({questions.length} ข้อ)
            </h3>
          </div>

          {loading ? (
            <LoadingScreen text="กำลังดึงโจทย์ข้อสอบในหมวดวิชานี้..." />
          ) : questions.length === 0 ? (
            <EmptyState 
              icon="📝"
              title="หมวดหมู่นี้ยังไม่มีโจทย์ข้อสอบ"
              description="คุณสามารถนำเข้าข้อสอบชุดใหญ่ด้วยปุ่ม ⚡ ด้านบน หรือสร้างโจทย์ข้อแรกจากฟอร์มด้านซ้ายมือเลยครับ"
            />
          ) : (
            questions.map((q, idx) => (
              <div 
                key={q.id} 
                className={`bg-slate-900 p-5 sm:p-6 rounded-3xl border transition-all space-y-4 min-w-0 ${
                  editingId === q.id ? 'border-amber-500 bg-slate-900/90 shadow-md shadow-amber-500/10' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4 min-w-0">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <span className="w-7 h-7 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 font-mono mt-0.5">
                      #{questions.length - idx}
                    </span>
                    <span className="text-sm font-bold text-white leading-relaxed break-words [word-break:break-word] flex-1 min-w-0">{q.question_text}</span>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleEditClick(q)}
                      className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      title="แก้ไขข้อสอบนี้"
                    >
                      <span>✏️</span><span className="hidden sm:inline">แก้ไข</span>
                    </button>
                    <button
                      onClick={() => setDeleteTarget(q)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                      title="ลบข้อสอบ"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {q.image_url && (
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-center">
                    <img src={q.image_url} alt="รูปโจทย์" className="max-h-48 object-contain rounded-xl" loading="lazy" />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1 sm:pl-2 min-w-0">
                  {q.options?.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-start gap-2.5 border min-w-0 ${
                        oIdx === Number(q.correct_option)
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-bold'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-lg text-[10px] flex items-center justify-center shrink-0 font-mono mt-0.5 ${
                        oIdx === Number(q.correct_option) ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {oIdx + 1}
                      </span>
                      <span className="break-words [word-break:break-word] flex-1 min-w-0 leading-relaxed pt-0.5">{opt}</span>
                    </div>
                  ))}
                </div>

                {(q.explanation || q.explanation_image_url) && (
                  <div className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-xs text-amber-300/90 space-y-2 min-w-0">
                    <div className="font-bold flex items-center gap-1.5 text-amber-400">
                      <span>💡</span><span>คำอธิบายเฉลย:</span>
                    </div>
                    {q.explanation && <p className="leading-relaxed text-slate-300 pl-5 break-words [word-break:break-word] min-w-0">{q.explanation}</p>}
                    {q.explanation_image_url && (
                      <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex justify-center mt-2">
                        <img src={q.explanation_image_url} alt="รูปเฉลย" className="max-h-36 object-contain rounded-lg" loading="lazy" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}