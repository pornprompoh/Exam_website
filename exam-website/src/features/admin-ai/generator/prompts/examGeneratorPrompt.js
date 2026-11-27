export const DIFFICULTY_DIRECTIVES = {
  balanced:
    'Use a balanced distribution: 30% easy (recall/definition), 50% medium (understanding/application), and 20% hard (analysis/problem-solving).',
  easy: 'Focus on basic recall and understanding. Avoid questions that require multi-step reasoning.',
  medium: 'Focus on understanding and applying concepts from the documents.',
  hard: 'Emphasize analysis, problem-solving, and case studies grounded in the provided content.'
}

export const LANGUAGE_DIRECTIVES = {
  th_tech:
    'Write all questions, options, answers, and explanations in Thai. Retain English technical terms in parentheses after their Thai translations when appropriate.',
  th: 'Write all questions, options, answers, and explanations entirely in Thai. Avoid English except for necessary proper nouns.',
  en: 'Write all questions, options, answers, and explanations entirely in English.',
  original: 'Strictly follow the language used in each relevant part of the source documents.'
}

export const GENERATOR_SYSTEM_INSTRUCTION =
  'You are an institutional assessment engine. Follow the requested cognitive level, output language, content distribution, and JSON schema exactly. Ground every answer in the source documents. Return exactly four options per question and ensure the correct answer is supported by the source.'

export const GENERATOR_PROMPT_PRESETS = [
  'หลีกเลี่ยงข้อถูกทุกข้อ/ผิดทุกข้อ',
  'สร้างตัวลวงที่ใกล้เคียงความจริง',
  'เน้นโจทย์แนวสถานการณ์สมมติ',
  'เน้นจุดสำคัญที่น่าจะออกสอบบ่อย',
  'มีเฉลยอธิบายละเอียดทุกตัวเลือก'
]

export function buildExamGeneratorPrompt({
  categoryName,
  questionCount,
  language,
  difficulty,
  evenDistribution,
  quotas,
  promptHint,
  existingQuestionTexts,
  sourceParts
}) {
  return `You are an expert assessment designer for the subject "${categoryName || 'unspecified'}".
Analyze the documents below and create ${questionCount} multiple-choice questions.
Return only a JSON array, with no Markdown or surrounding text.
Each question must be distinct, have exactly four options, and set correct_answer to an integer from 0 to 3.
The output language is determined by this instruction: ${LANGUAGE_DIRECTIVES[language]}
Difficulty and cognitive level: ${DIFFICULTY_DIRECTIVES[difficulty]}
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
}
