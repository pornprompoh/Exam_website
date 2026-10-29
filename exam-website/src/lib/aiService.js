import { extractFileText, validateFileCount } from './pdfExtractor'
import { supabase } from './supabase'

function parseJsonResponse(text) {
  const withoutFence = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(withoutFence)
  if (!Array.isArray(parsed)) throw new Error('AI ตอบกลับไม่ใช่รายการข้อสอบ')
  return parsed
}

function normalizeQuestion(item, index) {
  const options = Array.isArray(item.options) ? item.options.slice(0, 4).map(String) : []
  const correctAnswer = Number(item.correct_answer)
  if (!String(item.question || '').trim() || options.length !== 4 || options.some((option) => !option.trim())) throw new Error(`ข้อมูลข้อสอบข้อที่ ${index + 1} จาก AI ไม่ครบถ้วน`)
  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) throw new Error(`เฉลยข้อที่ ${index + 1} จาก AI ไม่ถูกต้อง`)
  return { question_text: String(item.question).trim(), options, correct_option: correctAnswer, explanation: String(item.explanation || '').trim(), source_topic: String(item.source_topic || 'ไม่ระบุแหล่งที่มา').trim() }
}

export async function generateExamQuestions({ files, questionCount, categoryName, promptHint, difficulty = 'balanced', language = 'th_tech', distributionMode = 'importance', onProgress }) {
  validateFileCount(files)
  if (!Number.isInteger(Number(questionCount)) || Number(questionCount) < 1 || Number(questionCount) > 100) throw new Error('จำนวนข้อสอบต้องอยู่ระหว่าง 1 ถึง 100 ข้อ')
  const difficultyDirectives = {
    balanced: 'ใช้สัดส่วนมาตรฐาน: ง่าย 30% (Recall/Definition), ปานกลาง 50% (Understanding/Application), ยาก 20% (Analysis/Problem-Solving)',
    easy: 'เน้นการจำและความเข้าใจพื้นฐาน (Recall/Definition) หลีกเลี่ยงการอนุมานหลายขั้นตอน',
    medium: 'เน้นความเข้าใจและการประยุกต์ใช้ (Understanding/Application) กับเนื้อหาในเอกสาร',
    hard: 'เน้นการวิเคราะห์ การแก้ปัญหา และกรณีศึกษา (Analysis/Problem-Solving) โดยต้องใช้เหตุผลจากเนื้อหา'
  }
  const languageDirectives = {
    th_tech: 'เขียนโจทย์ ตัวเลือก เฉลย และคำอธิบายเป็นภาษาไทย โดยคงศัพท์เทคนิคภาษาอังกฤษไว้ในวงเล็บหลังคำแปลเมื่อเหมาะสม',
    th: 'เขียนโจทย์ ตัวเลือก เฉลย และคำอธิบายเป็นภาษาไทยล้วน หลีกเลี่ยงภาษาอังกฤษยกเว้นชื่อเฉพาะที่จำเป็น',
    en: 'เขียนโจทย์ ตัวเลือก เฉลย และคำอธิบายเป็นภาษาอังกฤษทั้งหมด',
    original: 'ใช้ภาษาตามภาษาต้นฉบับของเอกสารแต่ละส่วนอย่างเคร่งครัด'
  }
  if (!difficultyDirectives[difficulty] || !languageDirectives[language] || !['even', 'importance'].includes(distributionMode)) throw new Error('รูปแบบระดับความยากหรือภาษาของข้อสอบไม่ถูกต้อง')
  const evenDistribution = distributionMode === 'even' && files.length > 1
  const quotas = files.map((file, index) => `${file.name}: ${Math.floor(Number(questionCount) / files.length) + (index < Number(questionCount) % files.length ? 1 : 0)} ข้อ`)
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
ระดับพุทธิพิสัยและความยาก: ${difficultyDirectives[difficulty]}
ภาษาผลลัพธ์: ${languageDirectives[language]}
${evenDistribution ? `การกระจายข้อสอบ: กระจายอย่างเท่าเทียมตามโควตาต่อไฟล์ดังนี้: ${quotas.join(', ')} ห้ามละเลยไฟล์ใดไฟล์หนึ่ง และให้ source_topic ระบุไฟล์ต้นทางที่ถูกต้อง` : 'การกระจายข้อสอบ: ให้น้ำหนักตามความหนาแน่น ความสำคัญ และสาระหลักของเนื้อหาโดยรวม ไม่จำเป็นต้องแบ่งเท่ากันระหว่างไฟล์'}
${promptHint ? `คำแนะนำเพิ่มเติมจากผู้ดูแล: ${promptHint}` : ''}

รูปแบบที่ต้องตอบ:
[{"question":"...","options":["...","...","...","..."],"correct_answer":0,"explanation":"...","source_topic":"ไฟล์: ... (หน้า ...) - หัวข้อ: ..."}]

เอกสาร:
${sourceParts.join('\n\n')}`
  onProgress?.('กำลังให้ AI วิเคราะห์เอกสารและสร้างข้อสอบ...')
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!session?.access_token) throw new Error('กรุณาเข้าสู่ระบบใหม่ก่อนสร้างข้อสอบ')

  const response = await fetch('/api/generate-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ prompt })
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || `เรียกบริการสร้างข้อสอบไม่สำเร็จ (HTTP ${response.status})`)
  }
  const responseText = payload?.text
  if (!responseText) throw new Error('AI ไม่ส่งผลลัพธ์ข้อสอบกลับมา')
  return parseJsonResponse(responseText).map(normalizeQuestion)
}
