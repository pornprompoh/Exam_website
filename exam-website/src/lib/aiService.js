import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_TEXT_PER_FILE = 120000
const MAX_FILES = 10

function getApiKey() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('ไม่พบ VITE_GEMINI_API_KEY กรุณาตั้งค่า API Key ในไฟล์ .env ก่อนใช้งาน')
  }
  return apiKey
}

async function extractPdfText(file) {
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    disableWorker: true
  }).promise
  const pages = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items.map((item) => item.str).join(' ').trim()
    if (text) pages.push(`(หน้า ${pageNumber})\n${text}`)
  }

  return pages.join('\n\n').slice(0, MAX_TEXT_PER_FILE)
}

async function extractFileText(file) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`ไฟล์ "${file.name}" มีขนาดเกิน 10 MB`)
  }
  if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
    return (await file.text()).slice(0, MAX_TEXT_PER_FILE)
  }
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return extractPdfText(file)
  }
  throw new Error(`ไม่รองรับไฟล์ "${file.name}" กรุณาเลือกเฉพาะ PDF หรือ TXT`)
}

function parseJsonResponse(text) {
  const withoutFence = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(withoutFence)
  if (!Array.isArray(parsed)) throw new Error('AI ตอบกลับไม่ใช่รายการข้อสอบ')
  return parsed
}

function normalizeQuestion(item, index) {
  const options = Array.isArray(item.options) ? item.options.slice(0, 4).map(String) : []
  const correctAnswer = Number(item.correct_answer)
  if (!String(item.question || '').trim() || options.length !== 4 || options.some((option) => !option.trim())) {
    throw new Error(`ข้อมูลข้อสอบข้อที่ ${index + 1} จาก AI ไม่ครบถ้วน`)
  }
  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
    throw new Error(`เฉลยข้อที่ ${index + 1} จาก AI ไม่ถูกต้อง`)
  }
  return {
    question_text: String(item.question).trim(),
    options,
    correct_option: correctAnswer,
    explanation: String(item.explanation || '').trim(),
    source_topic: String(item.source_topic || 'ไม่ระบุแหล่งที่มา').trim()
  }
}

export async function generateExamQuestions({ files, questionCount, categoryName, promptHint, onProgress }) {
  if (!files?.length) throw new Error('กรุณาเลือกไฟล์ PDF หรือ TXT อย่างน้อย 1 ไฟล์')
  if (files.length > MAX_FILES) throw new Error(`เลือกไฟล์ได้ไม่เกิน ${MAX_FILES} ไฟล์ต่อครั้ง`)
  if (!Number.isInteger(Number(questionCount)) || Number(questionCount) < 1 || Number(questionCount) > 100) {
    throw new Error('จำนวนข้อสอบต้องอยู่ระหว่าง 1 ถึง 100 ข้อ')
  }

  const sourceParts = []
  for (let index = 0; index < files.length; index += 1) {
    onProgress?.(`กำลังอ่านไฟล์ ${index + 1}/${files.length}: ${files[index].name}`)
    const text = await extractFileText(files[index])
    if (!text.trim()) throw new Error(`ไม่พบข้อความในไฟล์ "${files[index].name}"`)
    sourceParts.push(`===== ไฟล์: ${files[index].name} =====\n${text}`)
  }

  const prompt = `คุณเป็นผู้เชี่ยวชาญด้านการออกข้อสอบวิชา "${categoryName || 'ไม่ระบุ'}"
วิเคราะห์เอกสารด้านล่างและสร้างข้อสอบปรนัยจำนวน ${questionCount} ข้อ
ตอบกลับเป็น JSON array เท่านั้น ห้ามมี Markdown หรือข้อความอื่น
แต่ละข้อห้ามซ้ำกัน ต้องมี options 4 ตัวเลือก และ correct_answer เป็นเลข 0-3
source_topic ต้องอ้างอิงชื่อไฟล์และหน้า (ถ้ามี) รวมถึงหัวข้อที่เกี่ยวข้อง เพื่อให้ผู้ตรวจสอบย้อนกลับได้
${promptHint ? `คำแนะนำเพิ่มเติมจากผู้ดูแล: ${promptHint}` : ''}

รูปแบบที่ต้องตอบ:
[{"question":"...","options":["...","...","...","..."],"correct_answer":0,"explanation":"...","source_topic":"ไฟล์: ... (หน้า ...) - หัวข้อ: ..."}]

เอกสาร:
${sourceParts.join('\n\n')}`

  onProgress?.('กำลังให้ AI วิเคราะห์เอกสารและสร้างข้อสอบ...')
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash'}:generateContent?key=${encodeURIComponent(getApiKey())}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }
      })
    }
  )

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(errorBody?.error?.message || `เรียก Gemini ไม่สำเร็จ (HTTP ${response.status})`)
  }
  const payload = await response.json()
  const responseText = payload?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!responseText) throw new Error('AI ไม่ส่งผลลัพธ์ข้อสอบกลับมา')
  return parseJsonResponse(responseText).map(normalizeQuestion)
}
