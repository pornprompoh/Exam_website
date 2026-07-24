import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function BulkImportModal({ isOpen, onClose, categoryId, onSuccess }) {
  const [bulkInputText, setBulkInputText] = useState('')
  const [parsedQuestions, setParsedQuestions] = useState([])
  const [bulkStep, setBulkStep] = useState('input') // 'input' | 'preview'
  const [copyPromptText, setCopyPromptText] = useState('📋 คัดลอกคำสั่งสำหรับใช้กับ AI')
  const [saving, setSaving] = useState(false)

  const MAGIC_PROMPT = `ทำหน้าที่เป็นผู้เชี่ยวชาญด้านการแปลงข้อสอบ ช่วยอ่านโจทย์และตัวเลือกทั้งหมดจากรูปภาพนี้ โดยตัดลายน้ำ หัวกระดาษ และส่วนที่ไม่เกี่ยวข้องออก อ่านเรียงข้อให้ถูกต้อง และพิมพ์แปลงออกมาเป็นข้อความตามฟอร์แมตด้านล่างนี้เท่านั้น (ห้ามใส่ข้อความเกริ่นนำหรือท้ายบท):

1. [พิมพ์โจทย์คำถามที่นี่]
A. [พิมพ์ตัวเลือกแรก]
B. [พิมพ์ตัวเลือกที่สอง]
C. [พิมพ์ตัวเลือกที่สาม]
D. [พิมพ์ตัวเลือกที่สี่]
ANS: [ใส่เฉลยเป็น A, B, C หรือ D หากในรูปไม่มีเฉลยให้ใส่ A]
EXP: [พิมพ์คำอธิบายเฉลยหากมี ถ้าไม่มีให้เว้นว่างไว้]
---
(ใช้เครื่องหมาย --- คั่นระหว่างข้อเสมอ)`

  if (!isOpen) return null

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(MAGIC_PROMPT)
      setCopyPromptText('✅ คัดลอกคำสั่งเรียบร้อยแล้ว!')
      setTimeout(() => setCopyPromptText('📋 คัดลอกคำสั่งสำหรับใช้กับ AI'), 2500)
    } catch (err) {
      alert('เบราว์เซอร์ไม่รองรับการคัดลอกอัตโนมัติ กรุณาก๊อปปี้ด้วยตัวเองครับ')
    }
  }

  const handleParseBulkText = () => {
    if (!bulkInputText.trim()) return alert('กรุณาวางข้อความก่อนกดประมวลผลครับ')
    
    const blocks = bulkInputText.split('---').map(b => b.trim()).filter(b => b.length > 10)
    const newParsedList = []

    blocks.forEach((block) => {
      try {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l !== '')
        let qText = ''
        let opts = []
        let correctIdx = 0
        let expText = ''

        lines.forEach(line => {
          if (/^\d+\./.test(line) || (!line.startsWith('A.') && !line.startsWith('B.') && !line.startsWith('C.') && !line.startsWith('D.') && !line.startsWith('ANS:') && !line.startsWith('EXP:') && qText === '')) {
            qText += line.replace(/^\d+\.\s*/, '') + '\n'
          } else if (/^[A-D]\./i.test(line)) {
            opts.push(line.replace(/^[A-D]\.\s*/i, ''))
          } else if (/^ANS:/i.test(line)) {
            const ansStr = line.replace(/^ANS:\s*/i, '').toUpperCase()
            const mapping = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }
            if (mapping[ansStr] !== undefined) correctIdx = mapping[ansStr]
          } else if (/^EXP:/i.test(line)) {
            expText += line.replace(/^EXP:\s*/i, '') + '\n'
          } else if (qText !== '' && opts.length === 0) {
            qText += line + '\n'
          }
        })

        while (opts.length < 4) opts.push('ไม่มีข้อมูลตัวเลือก')
        if (opts.length > 4) opts = opts.slice(0, 4)

        if (qText.trim()) {
          newParsedList.push({
            question_text: qText.trim(),
            options: opts,
            correct_option: correctIdx,
            explanation: expText.trim()
          })
        }
      } catch (e) {
        console.error("Parse Error on block:", block, e)
      }
    })

    if (newParsedList.length === 0) {
      return alert('ไม่พบข้อมูลข้อสอบ กรุณาตรวจสอบฟอร์แมตอีกครั้งครับ (ต้องมี --- คั่นแต่ละข้อ)')
    }

    setParsedQuestions(newParsedList)
    setBulkStep('preview')
  }

  const handleConfirmBulkSave = async () => {
    if (!categoryId) return alert('กรุณาเลือกหมวดหมู่วิชาก่อนบันทึกครับ')
    setSaving(true)
    
    try {
      const payloadToInsert = parsedQuestions.map(q => ({
        category_id: categoryId,
        question_text: q.question_text,
        options: q.options,
        correct_option: q.correct_option,
        explanation: q.explanation,
        is_options_randomized: true,
        image_url: null,
        explanation_image_url: null,
        is_active: true
      }))

      const { error } = await supabase.from('questions').insert(payloadToInsert)
      if (error) throw error

      alert(`🎉 นำเข้าข้อสอบสำเร็จจำนวน ${parsedQuestions.length} ข้อ!`)
      handleClose()
      if (onSuccess) onSuccess()
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setBulkInputText('')
    setParsedQuestions([])
    setBulkStep('input')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center z-50 p-4 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 w-full max-w-4xl min-h-[500px] my-auto rounded-3xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden relative">
        
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 sticky top-0 z-10">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <span>⚡</span><span>นำเข้าข้อสอบชุดใหญ่อัจฉริยะ (Smart Bulk Import)</span>
          </h2>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-all cursor-pointer">
            ✕
          </button>
        </div>

        <div className="p-6 flex-1 flex flex-col gap-6">
          {bulkStep === 'input' && (
            <>
              <div className="bg-gradient-to-br from-indigo-900/40 to-violet-900/20 p-5 rounded-2xl border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-indigo-300 text-sm mb-1">1. ใช้ AI ช่วยแยกโจทย์จากรูปภาพ</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">คัดลอกคำสั่งด้านขวา แล้วนำไปวางพร้อมกับรูปภาพข้อสอบในระบบ AI (เช่น Gemini / ChatGPT) เพื่อให้ AI จัดฟอร์แมตให้ถูกต้องครับ</p>
                </div>
                <button onClick={handleCopyPrompt} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shrink-0 cursor-pointer">
                  {copyPromptText}
                </button>
              </div>

              <div className="flex-1 flex flex-col gap-2">
                <h3 className="font-bold text-slate-300 text-sm">2. วางผลลัพธ์ข้อความที่ได้จาก AI ลงในกล่องนี้:</h3>
                <textarea
                  value={bulkInputText}
                  onChange={(e) => setBulkInputText(e.target.value)}
                  placeholder="1. ข้อใดคือ...&#10;A. ...&#10;B. ...&#10;ANS: A&#10;---"
                  className="w-full flex-1 min-h-[250px] bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-300 font-mono placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end">
                <button 
                  onClick={handleParseBulkText} 
                  className="px-6 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg cursor-pointer flex items-center gap-2"
                >
                  <span>⚙️</span><span>ประมวลผลข้อความ (Review Data)</span>
                </button>
              </div>
            </>
          )}

          {bulkStep === 'preview' && (
            <div className="flex flex-col h-full gap-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-amber-400 text-sm flex items-center gap-2">
                  <span>👀</span><span>ตรวจสอบความถูกต้อง ({parsedQuestions.length} ข้อ)</span>
                </h3>
                <span className="text-[11px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full">ระบบยังไม่ได้บันทึกลงฐานข้อมูล</span>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4 max-h-[400px]">
                {parsedQuestions.map((pq, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-700 rounded-xl p-4 min-w-0">
                    <div className="flex items-start gap-2.5 min-w-0 mb-3">
                      <span className="w-6 h-6 bg-slate-800 text-slate-400 rounded-lg text-xs font-mono flex items-center justify-center shrink-0">#{idx + 1}</span>
                      <p className="text-sm font-bold text-slate-200 break-words [word-break:break-word] leading-snug">{pq.question_text}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                      {pq.options.map((opt, oIdx) => (
                        <div key={oIdx} className={`text-xs p-2 rounded-lg border ${oIdx === pq.correct_option ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-bold' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                          <span className="mr-2 font-mono uppercase">{['A', 'B', 'C', 'D'][oIdx]}.</span><span className="break-words">{opt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button 
                  onClick={() => setBulkStep('input')} 
                  className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm transition-all cursor-pointer"
                >
                  ← กลับไปแก้ไขข้อความ
                </button>
                <button 
                  onClick={handleConfirmBulkSave}
                  disabled={saving}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-slate-950 font-black rounded-xl text-sm transition-all shadow-lg shadow-orange-500/20 cursor-pointer flex items-center gap-2 justify-center"
                >
                  <span>{saving ? '⏳ กำลังบันทึก...' : `✨ ยืนยันบันทึกทั้ง ${parsedQuestions.length} ข้อลงคลัง`}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}