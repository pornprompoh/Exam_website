export const GEMINI_MODEL_STORAGE_KEY = 'admin_gemini_model'
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

export const GEMINI_MODELS = [
  {
    value: 'gemini-2.5-flash',
    label: 'Gemini Flash',
    description: 'แนะนำ · มาตรฐาน รวดเร็ว'
  },
  {
    value: 'gemini-2.5-flash-lite',
    label: 'Gemini Flash Lite',
    description: 'โควตาสูง · เหมาะกับการสร้างจำนวนมากหรือใช้สำรอง'
  },
  {
    value: 'gemini-2.5-pro',
    label: 'Gemini Pro',
    description: 'วิเคราะห์ลึก · เหมาะกับข้อสอบยากและซับซ้อน'
  }
]

const supportedModels = new Set(GEMINI_MODELS.map(({ value }) => value))

export function getGeminiModel() {
  if (typeof window === 'undefined') return DEFAULT_GEMINI_MODEL

  try {
    const storedModel = window.localStorage.getItem(GEMINI_MODEL_STORAGE_KEY)
    return supportedModels.has(storedModel) ? storedModel : DEFAULT_GEMINI_MODEL
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
