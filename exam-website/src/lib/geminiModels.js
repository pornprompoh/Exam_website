export const GEMINI_MODEL_STORAGE_KEY = 'admin_gemini_model'
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite'

export const GEMINI_MODELS = [
  {
    value: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash Lite',
    description: 'แนะนำ · โควตาสูง เหมาะกับการอ่านเอกสารและสร้างข้อสอบจำนวนมาก'
  },
  {
    value: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    description: 'สำรอง · ในภาพมีโควตา 500 RPD เหมาะเมื่อต้องสลับจากโมเดลหลัก'
  },
  {
    value: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    description: 'มาตรฐาน · รวดเร็วและวิเคราะห์ได้ดี'
  },
  {
    value: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    description: 'ทางเลือกสำรอง · เหมาะกับงานอ่านและวิเคราะห์เอกสาร'
  }
]

const supportedModels = new Set(GEMINI_MODELS.map(({ value }) => value))

export function getGeminiModel() {
  if (typeof window === 'undefined') return DEFAULT_GEMINI_MODEL

  try {
    const storedModel = window.localStorage.getItem(GEMINI_MODEL_STORAGE_KEY)
    if (supportedModels.has(storedModel)) return storedModel
    if (storedModel) window.localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, DEFAULT_GEMINI_MODEL)
    return DEFAULT_GEMINI_MODEL
  } catch {
    throw new Error('ไม่สามารถอ่านการตั้งค่าโมเดล Gemini ได้ กรุณาตรวจสอบการตั้งค่าเบราว์เซอร์')
  }
}

export function saveGeminiModel(model) {
  if (!supportedModels.has(model)) {
    throw new Error('โมเดล Gemini ที่เลือกไม่รองรับ')
  }
  if (typeof window === 'undefined') {
    throw new Error('ไม่สามารถบันทึกการตั้งค่าโมเดล Gemini ในสภาพแวดล้อมนี้ได้')
  }

  try {
    window.localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, model)
  } catch {
    throw new Error('ไม่สามารถบันทึกการตั้งค่าโมเดล Gemini ได้ กรุณาตรวจสอบการตั้งค่าเบราว์เซอร์')
  }
}

// ============================================================================
// Two-Stage Hybrid Model Routing Helpers (Additive — Backward-Compatible)
// - Flash Lite tier: 15 RPM / 250K TPM / 500 RPD (Pass 1 Extraction & Stage 3A Screening)
// - Flash Standard tier: 5 RPM / 250K TPM / 20 RPD (Stage 3B Deep Escalation & Solve)
// ============================================================================

export function isFlashLiteModel(modelValue) {
  return String(modelValue || '').toLowerCase().includes('lite')
}

export const GEMINI_LITE_MODELS = GEMINI_MODELS.filter((m) => isFlashLiteModel(m.value))
export const GEMINI_STANDARD_MODELS = GEMINI_MODELS.filter((m) => !isFlashLiteModel(m.value))

export const DEFAULT_LITE_MODEL = GEMINI_LITE_MODELS[0]?.value || DEFAULT_GEMINI_MODEL
export const DEFAULT_STANDARD_MODEL = GEMINI_STANDARD_MODELS[0]?.value || DEFAULT_GEMINI_MODEL

export function getGeminiModelLabel(modelValue) {
  return GEMINI_MODELS.find((m) => m.value === modelValue)?.label || modelValue || ''
}

export function resolveHybridModelPair(preferredDeepModel = '') {
  let stored
  try {
    stored = getGeminiModel() || DEFAULT_GEMINI_MODEL
  } catch {
    stored = DEFAULT_GEMINI_MODEL
  }

  const liteModel = isFlashLiteModel(stored) ? stored : DEFAULT_LITE_MODEL
  const deepModel = preferredDeepModel && supportedModels.has(preferredDeepModel)
    ? preferredDeepModel
    : !isFlashLiteModel(stored)
      ? stored
      : DEFAULT_STANDARD_MODEL

  return { liteModel, deepModel }
}
