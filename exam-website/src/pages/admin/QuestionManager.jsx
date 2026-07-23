import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import imageCompression from 'browser-image-compression' // 1. ดึงไลบรารีบีบอัดรูปมาใช้

export default function QuestionManager() {
  const [categories, setCategories] = useState([])
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // -- State สำหรับฟอร์มเพิ่มข้อสอบ --
  const [categoryId, setCategoryId] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [questionImage, setQuestionImage] = useState(null)
  const [choices, setChoices] = useState(['', '', '', '']) 
  const [correctOption, setCorrectOption] = useState(0)
  const [isRandomized, setIsRandomized] = useState(true)
  const [explanationText, setExplanationText] = useState('')
  const [explanationImage, setExplanationImage] = useState(null)

  useEffect(() => {
    fetchInitialData()
  }, [])

  async function fetchInitialData() {
    setLoading(true)
    const { data: catData } = await supabase.from('categories').select('*').order('name')
    if (catData) {
      setCategories(catData)
      if (catData.length > 0) setCategoryId(catData[0].id)
    }
    await fetchQuestions()
    setLoading(false)
  }

  async function fetchQuestions() {
    const { data } = await supabase
      .from('questions')
      .select('*, categories(name)')
      .order('created_at', { ascending: false })
    if (data) setQuestions(data)
  }

  // 2. ฟังก์ชันอัปโหลดรูปภาพ (พร้อมระบบบีบอัดไฟล์ให้อัตโนมัติ!)
  async function uploadImage(file, folderName) {
    if (!file) return null

    try {
      // ตั้งค่าบีบอัดรูป: ให้ไฟล์ใหญ่สุดไม่เกิน 0.3 MB (300 KB) และลดความละเอียดหน้าจอลงนิดหน่อยเพื่อความไว
      const options = {
        maxSizeMB: 0.3, 
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      }
      
      console.log(`📏 ขนาดไฟล์ก่อนบีบอัด: ${(file.size / 1024 / 1024).toFixed(2)} MB`)
      const compressedFile = await imageCompression(file, options)
      console.log(`✨ ขนาดไฟล์หลังบีบอัด: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`)

      // อัปโหลดไฟล์ที่บีบอัดแล้วขึ้น Supabase
      const fileExt = compressedFile.name.split('.').pop() || 'jpg'
      const fileName = `${folderName}/${categoryId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`
      
      const { error } = await supabase.storage.from('exam-public-images').upload(fileName, compressedFile)
      if (error) throw error

      const { data: urlData } = supabase.storage.from('exam-public-images').getPublicUrl(fileName)
      return urlData.publicUrl
    } catch (error) {
      alert('อัปโหลดรูปไม่สำเร็จ: ' + error.message)
      return null
    }
  }

  const handleChoiceChange = (index, value) => {
    const newChoices = [...choices]
    newChoices[index] = value
    setChoices(newChoices)
  }

  const addChoice = () => {
    setChoices([...choices, ''])
  }

  const removeChoice = (indexToRemove) => {
    if (choices.length <= 2) {
      return alert('ข้อสอบควรจะมีตัวเลือกอย่างน้อย 2 ข้อครับ (เช่น ถูก/ผิด)')
    }
    const updatedChoices = choices.filter((_, idx) => idx !== indexToRemove)
    setChoices(updatedChoices)

    if (correctOption >= updatedChoices.length) {
      setCorrectOption(0)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!questionText.trim()) return alert('กรุณาพิมพ์โจทย์ข้อสอบ')
    if (choices.some(c => !c.trim())) return alert(`กรุณากรอกข้อความช้อยส์ให้ครบทั้ง ${choices.length} ข้อ`)
    if (!categoryId) return alert('กรุณาเลือกหมวดหมู่วิชา')

    setSubmitting(true)
    try {
      const qImageUrl = await uploadImage(questionImage, 'questions')
      const expImageUrl = await uploadImage(explanationImage, 'explanations')

      const { error } = await supabase.from('questions').insert([{
        category_id: categoryId,
        question_text: questionText.trim(),
        image_url: qImageUrl,
        options: choices,
        correct_option: String(correctOption),
        is_options_randomized: isRandomized,
        explanation: explanationText.trim() || null,
        explanation_image_url: expImageUrl,
        is_active: true
      }])

      if (error) throw error

      alert('✅ เพิ่มข้อสอบเรียบร้อยแล้ว!')
      setQuestionText('')
      setQuestionImage(null)
      setChoices(['', '', '', '']) 
      setExplanationText('')
      setExplanationImage(null)
      fetchQuestions()
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // 3. ฟังก์ชันลบข้อสอบ + ลบรูปภาพใน Storage อัตโนมัติเพื่อไม่ให้เปลืองที่!
  async function handleDelete(question) {
    if (!window.confirm('ยืนยันที่จะลบข้อสอบข้อนี้และรูปภาพประกอบหรือไม่?')) return

    try {
      // 3.1 ตรวจสอบว่ามีรูปโจทย์ไหม ถ้ามี ให้ดึง Path มาแล้วลบออกจาก Storage
      if (question.image_url) {
        const path = question.image_url.split('/exam-public-images/')[1]
        if (path) await supabase.storage.from('exam-public-images').remove([path])
      }

      // 3.2 ตรวจสอบว่ามีรูปเฉลยไหม ถ้ามี ก็ลบทิ้งเหมือนกัน
      if (question.explanation_image_url) {
        const path = question.explanation_image_url.split('/exam-public-images/')[1]
        if (path) await supabase.storage.from('exam-public-images').remove([path])
      }

      // 3.3 ลบข้อมูลข้อสอบออกจากตาราง questions
      const { error } = await supabase.from('questions').delete().eq('id', question.id)
      if (error) throw error

      fetchQuestions()
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการลบ: ' + err.message)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">📝 จัดการคลังข้อสอบ (Admin - Auto Compress & Clean)</h1>
        <p className="text-sm text-slate-500 mb-6">ระบบบีบอัดรูปอัตโนมัติไม่เกิน 300KB พร้อมระบบลบไฟล์ขยะทิ้งทันทีที่ลบข้อสอบ</p>

        <form onSubmit={handleSubmit} className="space-y-6 border-b border-slate-200 pb-8 mb-8">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">1. เลือกหมวดหมู่วิชา</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
              disabled={categories.length === 0}
            >
              {categories.length === 0 && <option>-- กรุณาสร้างหมวดหมู่ก่อน --</option>}
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">2. คำถาม / โจทย์ข้อสอบ</label>
            <textarea
              rows={3}
              placeholder="พิมพ์โจทย์ข้อสอบที่นี่..."
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium">📷 รูปประกอบโจทย์ (ระบบจะบีบอัดให้อัตโนมัติ):</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setQuestionImage(e.target.files[0])}
                className="text-xs text-slate-600 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
              <label className="block text-sm font-semibold text-slate-700">
                3. ตัวเลือก ({choices.length} ช้อยส์) - <span className="text-indigo-600 font-normal">ติ๊กจุดกลมข้อที่ถูกต้องที่สุด</span>
              </label>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRandomized}
                    onChange={(e) => setIsRandomized(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  สลับช้อยส์ตอนสอบ
                </label>

                <button
                  type="button"
                  onClick={addChoice}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-xs transition-colors border border-indigo-200 cursor-pointer flex items-center gap-1"
                >
                  + เพิ่มตัวเลือก
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {choices.map((choice, idx) => (
                <div key={idx} className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${correctOption === idx ? 'border-emerald-500 bg-emerald-50/60 shadow-sm' : 'border-slate-300 bg-white'}`}>
                  <input
                    type="radio"
                    name="correct_choice"
                    checked={correctOption === idx}
                    onChange={() => setCorrectOption(idx)}
                    className="text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-500 w-6 text-center">#{idx + 1}</span>
                  <input
                    type="text"
                    placeholder={`ตัวเลือกที่ ${idx + 1}`}
                    value={choice}
                    onChange={(e) => handleChoiceChange(idx, e.target.value)}
                    className="flex-1 bg-transparent border-none text-sm focus:outline-none"
                  />
                  
                  {choices.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeChoice(idx)}
                      title="ลบตัวเลือกนี้"
                      className="text-slate-400 hover:text-red-500 p-1 text-xs transition-colors cursor-pointer"
                    >
                      ❌
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700">4. คำอธิบายเฉลย (ไม่บังคับ)</label>
            <textarea
              rows={2}
              placeholder="อธิบายเหตุผลของข้อที่ถูก..."
              value={explanationText}
              onChange={(e) => setExplanationText(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-medium">📷 รูปประกอบเฉลย (ไม่บังคับ):</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setExplanationImage(e.target.files[0])}
                className="text-xs text-slate-600 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || categories.length === 0}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-xl text-sm transition-colors shadow-md cursor-pointer"
          >
            {submitting ? '⏳ กำลังบีบอัดรูปภาพและบันทึกข้อมูล...' : '✨ บันทึกข้อสอบใหม่ลงระบบ'}
          </button>
        </form>

        <h2 className="text-base font-bold text-slate-800 mb-4">📚 รายการข้อสอบในระบบ ({questions.length} ข้อ)</h2>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm animate-pulse">⏳ กำลังโหลดรายการข้อสอบ...</div>
        ) : questions.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl text-slate-400 text-sm">📭 ยังไม่มีข้อสอบในระบบ ลองสร้างข้อแรกด้านบนดูเลยครับ!</div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors bg-slate-50/50 flex justify-between items-start gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">
                      {q.categories?.name || 'ไม่ระบุหมวด'}
                    </span>
                    <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
                      {q.options?.length || 0} ช้อยส์
                    </span>
                    {q.image_url && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">📷 มีรูปโจทย์</span>}
                  </div>
                  <p className="font-medium text-slate-800 text-sm line-clamp-2">{q.question_text}</p>
                  <p className="text-xs text-slate-500">
                    เฉลยถูก: <span className="font-semibold text-emerald-600 font-mono">
                      ช้อยส์ #{Number(q.correct_option) + 1} ({q.options[Number(q.correct_option)]})
                    </span>
                  </p>
                </div>
                {/* 4. เปลี่ยนการส่งค่าปุ่มลบ ให้ส่งไปทั้งออบเจกต์ข้อสอบเลย ระบบจะได้รู้ว่าต้องไปลบรูปชื่ออะไรทิ้ง */}
                <button
                  onClick={() => handleDelete(q)}
                  className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer"
                >
                  🗑️ ลบ
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}