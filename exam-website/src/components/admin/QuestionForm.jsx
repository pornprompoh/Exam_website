import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function QuestionForm({
  selectedCat,
  currentUserId,
  editingQuestion,
  onCancelEdit,
  onSaveSuccess,
  showModal,
  deleteStorageFile
}) {
  const [questionText, setQuestionText] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctOption, setCorrectOption] = useState(0)
  const [explanation, setExplanation] = useState('')
  const [isRandomized, setIsRandomized] = useState(true)
  const [isActive, setIsActive] = useState(true)
  const [imageFile, setImageFile] = useState(null)
  const [expImageFile, setExpImageFile] = useState(null)
  const [existingImageUrl, setExistingImageUrl] = useState(null)
  const [existingExpImageUrl, setExistingExpImageUrl] = useState(null)
  const [saving, setSaving] = useState(false)

  // 🌟 เมื่อกดแก้ไขข้อสอบ ให้ดึงข้อมูลโจทย์ข้อนั้นมาแสดงในฟอร์มทันที
  useEffect(() => {
    if (editingQuestion) {
      setQuestionText(editingQuestion.question_text || '')
      setOptions(editingQuestion.options || ['', '', '', ''])
      setCorrectOption(Number(editingQuestion.correct_option) || 0)
      setExplanation(editingQuestion.explanation || '')
      setIsRandomized(editingQuestion.is_options_randomized ?? true)
      setIsActive(editingQuestion.is_active ?? true)
      setExistingImageUrl(editingQuestion.image_url)
      setExistingExpImageUrl(editingQuestion.explanation_image_url)
      setImageFile(null)
      setExpImageFile(null)
    } else {
      handleResetForm()
    }
  }, [editingQuestion])

  const handleResetForm = () => {
    setQuestionText('')
    setOptions(['', '', '', ''])
    setCorrectOption(0)
    setExplanation('')
    setIsRandomized(true)
    setIsActive(true)
    setExistingImageUrl(null)
    setExistingExpImageUrl(null)
    setImageFile(null)
    setExpImageFile(null)
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
    if (options.length <= 2) {
      return showModal('warning', 'ลบไม่ได้', 'ข้อสอบต้องมีตัวเลือกคำตอบอย่างน้อย 2 ข้อครับ')
    }
    const newOptions = options.filter((_, idx) => idx !== indexToRemove)
    setOptions(newOptions)
    if (correctOption === indexToRemove) setCorrectOption(0)
    else if (correctOption > indexToRemove) setCorrectOption(correctOption - 1)
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
    
    // ✨ แก้ชื่อตรงนี้เป็น 'exam-public-images' ให้ตรงกับ Supabase ของคุณ
    const { error } = await supabase.storage.from('exam-public-images').upload(fileName, compressedFile, {
      contentType: 'image/webp',
      cacheControl: '3600',
      upsert: false
    })
    
    if (error) throw error
    // ✨ แก้ชื่อตรงนี้ด้วยครับ
    const { data: { publicUrl } } = supabase.storage.from('exam-public-images').getPublicUrl(fileName)
    return publicUrl
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedCat) return showModal('warning', 'ยังไม่ได้เลือกวิชา', 'กรุณาเลือกหมวดหมู่วิชาก่อนบันทึกครับ')
    if (!questionText.trim()) return showModal('warning', 'ข้อมูลไม่ครบ', 'กรุณากรอกโจทย์คำถามก่อนบันทึกครับ')
    if (options.some((opt) => !opt.trim())) return showModal('warning', 'ข้อมูลไม่ครบ', 'กรุณากรอกตัวเลือกคำตอบให้ครบถ้วนทุกข้อครับ')

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
        is_active: isActive,
        created_by: currentUserId || null
      }

      if (editingQuestion) {
        const { error } = await supabase.from('questions').update(payload).eq('id', editingQuestion.id)
        if (error) throw error

        // 🗑️ ปิดช่องโหว่รูปขยะ: ถ้ามีการเปลี่ยนรูป หรือลบรูปเดิมทิ้ง ให้ลบไฟล์เก่าจาก Storage ทันที
        if (editingQuestion.image_url && editingQuestion.image_url !== imageUrl) {
          await deleteStorageFile(editingQuestion.image_url)
        }
        if (editingQuestion.explanation_image_url && editingQuestion.explanation_image_url !== expImageUrl) {
          await deleteStorageFile(editingQuestion.explanation_image_url)
        }

        showModal('success', 'บันทึกสำเร็จ!', 'อัปเดตการแก้ไขข้อสอบเรียบร้อยแล้วครับ')
        onCancelEdit()
      } else {
        const { error } = await supabase.from('questions').insert([payload])
        if (error) throw error
        showModal('success', 'สร้างสำเร็จ!', 'เพิ่มโจทย์ข้อสอบใหม่ลงในคลังเรียบร้อยแล้วครับ')
        handleResetForm()
      }

      onSaveSuccess()
    } catch (err) {
      showModal('danger', 'เกิดข้อผิดพลาดในการบันทึก', err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl sticky top-24 transition-colors ${
      editingQuestion ? 'bg-indigo-950/40 border-indigo-500/50' : 'bg-slate-900 border-slate-800'
    }`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2 min-w-0">
          <span className="shrink-0">{editingQuestion ? '✏️' : '➕'}</span>
          <span className="truncate">{editingQuestion ? 'แก้ไขโจทย์ข้อสอบ' : 'สร้างทีละข้อ (Manual)'}</span>
        </h3>
        {editingQuestion && (
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

        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-2">
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

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="activeStatus"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer shrink-0"
            />
            <label htmlFor="activeStatus" className="text-xs text-slate-300 font-medium cursor-pointer leading-snug">
              เปิดใช้งานข้อสอบทันที (หากติ๊กออกจะเป็นการซ่อนไว้ในสถานะ "ฉบับร่าง")
            </label>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          {editingQuestion && (
            <button
              type="button"
              onClick={() => {
                handleResetForm()
                onCancelEdit()
              }}
              className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl text-xs sm:text-sm transition-all cursor-pointer"
            >
              ยกเลิก
            </button>
          )}
          <button
            type="submit"
            disabled={saving || !selectedCat}
            className={`flex-1 py-3.5 disabled:opacity-50 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 ${
              editingQuestion ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-orange-500/20' : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-600/20'
            }`}
          >
            <span>{saving ? '⏳ กำลังบันทึก...' : (editingQuestion ? '💾 บันทึกการแก้ไขข้อสอบ' : '✨ บันทึกข้อสอบลงคลัง')}</span>
          </button>
        </div>
      </form>
    </div>
  )
}