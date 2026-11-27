import { supabase } from '../../../../shared/lib/supabase'
import { getGeminiApiKey } from '../../../../shared/lib/geminiApiKey'
import { DEFAULT_GEMINI_MODEL, getGeminiModel } from '../../../../shared/lib/geminiModels'
import { extractFileText, validateFileCount } from '../../shared/utils/pdfPipelineUtils'
import {
  DIFFICULTY_DIRECTIVES,
  GENERATOR_SYSTEM_INSTRUCTION,
  LANGUAGE_DIRECTIVES,
  buildExamGeneratorPrompt
} from '../prompts/examGeneratorPrompt'
import {
  isNearlyIdentical,
  normalizeGeneratedQuestion,
  normalizeQuestionText,
  parseGeneratorJsonResponse
} from '../utils/generatorDedupeUtils'

const PROGRESS_STEP_DELAY_MS = 450
const EXISTING_QUESTION_LIMIT = 25

function waitForProgressTransition() {
  return new Promise((resolve) => setTimeout(resolve, PROGRESS_STEP_DELAY_MS))
}

function parseResponse(text) {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

export async function generateExamQuestions({
  files,
  questionCount,
  categoryName,
  categoryId,
  promptHint,
  difficulty = 'balanced',
  language = 'th_tech',
  distributionMode = 'importance',
  onProgress
}) {
  const apiKey = getGeminiApiKey()
  if (!apiKey) throw new Error('ยังไม่ได้ตั้งค่า Gemini API Key กรุณาไปตั้งค่าในเมนูผู้ดูแลก่อน')
  const selectedModel = getGeminiModel() || DEFAULT_GEMINI_MODEL

  validateFileCount(files)
  if (!Number.isInteger(Number(questionCount)) || Number(questionCount) < 1 || Number(questionCount) > 100) {
    throw new Error('จำนวนข้อสอบต้องอยู่ระหว่าง 1 ถึง 100 ข้อ')
  }
  if (!categoryId) throw new Error('กรุณาเลือกหมวดหมู่ก่อนสร้างข้อสอบ')

  if (
    !DIFFICULTY_DIRECTIVES[difficulty] ||
    !LANGUAGE_DIRECTIVES[language] ||
    !['even', 'importance'].includes(distributionMode)
  ) {
    throw new Error('รูปแบบระดับความยากหรือภาษาของข้อสอบไม่ถูกต้อง')
  }

  const evenDistribution = distributionMode === 'even' && files.length > 1
  const quotas = files.map(
    (file, index) =>
      `${file.name}: ${Math.floor(Number(questionCount) / files.length) + (index < Number(questionCount) % files.length ? 1 : 0)} questions`
  )
  onProgress?.(1, 'กำลังอ่านและสกัดข้อความจากเอกสาร (PDF/TXT)...')

  const { data: existingQuestions, error: existingQuestionsError } = await supabase
    .from('questions')
    .select('question_text')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false })
    .limit(EXISTING_QUESTION_LIMIT)
  if (existingQuestionsError) throw existingQuestionsError

  const existingQuestionTexts = (existingQuestions || [])
    .map((question) => question.question_text)
    .filter((question) => typeof question === 'string' && question.trim())
  const comparedQuestionTexts = existingQuestionTexts.map(normalizeQuestionText)

  const sourceParts = []
  for (let index = 0; index < files.length; index += 1) {
    const text = await extractFileText(files[index])
    if (!text.trim()) throw new Error(`ไม่พบข้อความในไฟล์ "${files[index].name}"`)
    sourceParts.push(`===== ไฟล์: ${files[index].name} =====\n${text}`)
  }

  const prompt = buildExamGeneratorPrompt({
    categoryName,
    questionCount,
    language,
    difficulty,
    evenDistribution,
    quotas,
    promptHint,
    existingQuestionTexts,
    sourceParts
  })

  await waitForProgressTransition()
  onProgress?.(2, 'กำลังจัดหมวดหมู่และส่งเนื้อหาให้ Gemini วิเคราะห์...')
  await waitForProgressTransition()
  onProgress?.(3, 'Gemini กำลังร่างโจทย์ ชอยส์ตัวเลือก และคำอธิบาย...')

  const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${encodeURIComponent(apiKey)}`
  const response = await fetch(modelUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: GENERATOR_SYSTEM_INSTRUCTION }]
      },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }
    })
  })

  const responseText = await response.text()
  const payload = parseResponse(responseText)

  if (!response.ok) {
    console.error('API Error Details:', response.status, responseText)
    if (response.status === 400 || response.status === 403) {
      throw new Error('API Key ไม่ถูกต้อง กรุณาตรวจสอบคีย์ที่ตั้งค่าไว้อีกครั้ง')
    }
    if (response.status === 429) {
      throw new Error('โควตาการใช้งานของ API Key เต็มชั่วคราว กรุณารอสักครู่แล้วลองใหม่')
    }
    throw new Error(payload?.error?.message || `เรียกบริการ Gemini ไม่สำเร็จ (HTTP ${response.status})`)
  }

  const generatedText = payload?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!generatedText) throw new Error('AI ไม่ส่งผลลัพธ์ข้อสอบกลับมา')

  const normalizedQuestions = parseGeneratorJsonResponse(generatedText).map(normalizeGeneratedQuestion)
  const acceptedQuestions = []
  const acceptedNormalizedQuestions = []

  for (const question of normalizedQuestions) {
    const normalizedQuestion = normalizeQuestionText(question.question_text)
    if (
      [...comparedQuestionTexts, ...acceptedNormalizedQuestions].some((previousQuestion) =>
        isNearlyIdentical(normalizedQuestion, previousQuestion)
      )
    ) {
      continue
    }
    acceptedQuestions.push(question)
    acceptedNormalizedQuestions.push(normalizedQuestion)
  }

  onProgress?.(4, 'กำลังตรวจสอบโครงสร้าง JSON และจัดเรียงตาราง...')
  await waitForProgressTransition()
  return acceptedQuestions
}

export async function saveGeneratedQuestions({ categoryId, questions, currentUserId }) {
  const payload = questions.map((item) => ({
    category_id: categoryId,
    question_text: item.question_text.trim(),
    options: item.options.map((option) => option.trim()),
    correct_option: Number(item.correct_option),
    explanation: item.explanation.trim() || null,
    is_options_randomized: true,
    image_url: null,
    explanation_image_url: null,
    is_active: true,
    created_by: currentUserId || null
  }))
  const { error } = await supabase.from('questions').insert(payload)
  if (error) throw error
  return payload.length
}
