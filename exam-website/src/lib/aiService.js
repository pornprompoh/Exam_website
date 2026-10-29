import { extractFileText, validateFileCount } from './pdfExtractor'
import { getGeminiApiKey } from './geminiApiKey'
import { DEFAULT_GEMINI_MODEL, getGeminiModel } from './geminiModels'
import { supabase } from './supabase'

const PROGRESS_STEP_DELAY_MS = 450
const EXISTING_QUESTION_LIMIT = 25
const DUPLICATE_SIMILARITY_THRESHOLD = 0.95

function waitForProgressTransition() {
  return new Promise((resolve) => setTimeout(resolve, PROGRESS_STEP_DELAY_MS))
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

function parseResponse(text) {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

function normalizeQuestionText(question) {
  return String(question || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function isNearlyIdentical(left, right) {
  if (left === right) return true
  if (!left || !right) return false

  const maxLength = Math.max(left.length, right.length)
  const allowedEdits = Math.floor(maxLength * (1 - DUPLICATE_SIMILARITY_THRESHOLD))
  if (Math.abs(left.length - right.length) > allowedEdits) return false

  let previousRow = new Map([[0, 0]])
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const currentRow = new Map()
    const start = Math.max(0, leftIndex - allowedEdits)
    const end = Math.min(right.length, leftIndex + allowedEdits)
    if (start === 0) currentRow.set(0, leftIndex)

    let minimumDistance = Number.POSITIVE_INFINITY
    for (let rightIndex = Math.max(1, start); rightIndex <= end; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      const distance = Math.min(
        (currentRow.get(rightIndex - 1) ?? Number.POSITIVE_INFINITY) + 1,
        (previousRow.get(rightIndex) ?? Number.POSITIVE_INFINITY) + 1,
        (previousRow.get(rightIndex - 1) ?? Number.POSITIVE_INFINITY) + substitutionCost
      )
      currentRow.set(rightIndex, distance)
      minimumDistance = Math.min(minimumDistance, distance)
    }

    if (minimumDistance > allowedEdits) return false
    previousRow = currentRow
  }

  return (previousRow.get(right.length) ?? Number.POSITIVE_INFINITY) <= allowedEdits
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

  const difficultyDirectives = {
    balanced: 'Use a balanced distribution: 30% easy (recall/definition), 50% medium (understanding/application), and 20% hard (analysis/problem-solving).',
    easy: 'Focus on basic recall and understanding. Avoid questions that require multi-step reasoning.',
    medium: 'Focus on understanding and applying concepts from the documents.',
    hard: 'Emphasize analysis, problem-solving, and case studies grounded in the provided content.'
  }
  const languageDirectives = {
    th_tech: 'Write all questions, options, answers, and explanations in Thai. Retain English technical terms in parentheses after their Thai translations when appropriate.',
    th: 'Write all questions, options, answers, and explanations entirely in Thai. Avoid English except for necessary proper nouns.',
    en: 'Write all questions, options, answers, and explanations entirely in English.',
    original: 'Strictly follow the language used in each relevant part of the source documents.'
  }
  if (!difficultyDirectives[difficulty] || !languageDirectives[language] || !['even', 'importance'].includes(distributionMode)) {
    throw new Error('รูปแบบระดับความยากหรือภาษาของข้อสอบไม่ถูกต้อง')
  }

  const evenDistribution = distributionMode === 'even' && files.length > 1
  const quotas = files.map((file, index) => (
    `${file.name}: ${Math.floor(Number(questionCount) / files.length) + (index < Number(questionCount) % files.length ? 1 : 0)} questions`
  ))
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

  const prompt = `You are an expert assessment designer for the subject "${categoryName || 'unspecified'}".
Analyze the documents below and create ${questionCount} multiple-choice questions.
Return only a JSON array, with no Markdown or surrounding text.
Each question must be distinct, have exactly four options, and set correct_answer to an integer from 0 to 3.
The output language is determined by this instruction: ${languageDirectives[language]}
Difficulty and cognitive level: ${difficultyDirectives[difficulty]}
Each source_topic must identify the source file and page (when available), plus the relevant topic, so reviewers can trace it back to the source.
${evenDistribution ? `Distribute questions evenly using these per-file quotas: ${quotas.join(', ')}. Do not omit any file, and identify the correct source file in source_topic.` : 'Distribute questions according to the overall density, importance, and core ideas of the content. Equal distribution across files is not required.'}
${promptHint ? `Additional instructions from the administrator: ${promptHint}` : ''}
${existingQuestionTexts.length > 0 ? `[QUESTION DIVERSITY RULE]:
Some questions already exist in this subject category:
${existingQuestionTexts.map((question) => `- ${question}`).join('\n')}

Do not repeat these questions, test the same point, or reuse their wording. Create genuinely new questions from a different perspective, use a different scenario, or focus on relevant content that has not yet been assessed.` : ''}

Output schema (keep the question, options, and explanation in the selected output language; the example below is in Thai):
[{"question":"...","options":["...","...","...","..."],"correct_answer":0,"explanation":"คำอธิบายภาษาไทย","source_topic":"ไฟล์: ... (หน้า ...) - หัวข้อ: ..."}]

Documents:
${sourceParts.join('\n\n')}`

  await waitForProgressTransition()
  onProgress?.(2, 'กำลังจัดหมวดหมู่และส่งเนื้อหาให้ Gemini วิเคราะห์...')
  await waitForProgressTransition()
  onProgress?.(3, 'Gemini กำลังร่างโจทย์ ชอยส์ตัวเลือก และคำอธิบาย...')
  const modelUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${encodeURIComponent(apiKey)}`
  const responsePromise = fetch(modelUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: 'You are an institutional assessment engine. Follow the requested cognitive level, output language, content distribution, and JSON schema exactly. Ground every answer in the source documents. Return exactly four options per question and ensure the correct answer is supported by the source.'
        }]
      },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }
    })
  })

  const response = await responsePromise
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
  const normalizedQuestions = parseJsonResponse(generatedText).map(normalizeQuestion)
  const acceptedQuestions = []
  const acceptedNormalizedQuestions = []
  for (const question of normalizedQuestions) {
    const normalizedQuestion = normalizeQuestionText(question.question_text)
    if ([...comparedQuestionTexts, ...acceptedNormalizedQuestions]
      .some((previousQuestion) => isNearlyIdentical(normalizedQuestion, previousQuestion))) {
      continue
    }
    acceptedQuestions.push(question)
    acceptedNormalizedQuestions.push(normalizedQuestion)
  }
  onProgress?.(4, 'กำลังตรวจสอบโครงสร้าง JSON และจัดเรียงตาราง...')
  await waitForProgressTransition()
  return acceptedQuestions
}
