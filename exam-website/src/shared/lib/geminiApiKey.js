export const GEMINI_API_KEY_STORAGE_KEY = 'admin_gemini_api_key'

function getLocalStorage() {
  if (typeof window === 'undefined') {
    throw new Error('ไม่สามารถเข้าถึงพื้นที่จัดเก็บ API Key ในสภาพแวดล้อมนี้ได้')
  }

  try {
    return window.localStorage
  } catch {
    throw new Error('ไม่สามารถเข้าถึง localStorage ได้ กรุณาตรวจสอบการตั้งค่าเบราว์เซอร์')
  }
}

export function getGeminiApiKey() {
  try {
    return getLocalStorage().getItem(GEMINI_API_KEY_STORAGE_KEY)?.trim() || ''
  } catch (error) {
    if (error instanceof Error && error.message.includes('localStorage')) throw error
    throw new Error('ไม่สามารถอ่าน Gemini API Key จาก localStorage ได้', { cause: error })
  }
}

export function saveGeminiApiKey(apiKey) {
  const normalizedKey = apiKey.trim()
  if (!normalizedKey) throw new Error('กรุณากรอก Gemini API Key')

  try {
    getLocalStorage().setItem(GEMINI_API_KEY_STORAGE_KEY, normalizedKey)
  } catch {
    throw new Error('ไม่สามารถบันทึก Gemini API Key ได้ กรุณาตรวจสอบการตั้งค่าเบราว์เซอร์')
  }
}

export function clearGeminiApiKey() {
  try {
    getLocalStorage().removeItem(GEMINI_API_KEY_STORAGE_KEY)
  } catch {
    throw new Error('ไม่สามารถลบ Gemini API Key ได้ กรุณาตรวจสอบการตั้งค่าเบราว์เซอร์')
  }
}
