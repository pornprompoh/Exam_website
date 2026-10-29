import process from 'node:process'

const MAX_PROMPT_LENGTH = 1_500_000
const SYSTEM_INSTRUCTION = 'คุณเป็น Assessment Engine ระดับสถาบันการศึกษา ปฏิบัติตามระดับพุทธิพิสัย ภาษา การกระจายเนื้อหา และรูปแบบ JSON ที่ผู้ใช้ระบุอย่างเคร่งครัด ตรวจสอบว่าแต่ละข้อมีตัวเลือก 4 ข้อและเฉลยถูกต้องจากเอกสารเท่านั้น'

export default async function generateExam(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'รองรับเฉพาะ POST request' })
  }

  const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1]
  if (!token) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนสร้างข้อสอบ' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const geminiApiKey = process.env.GEMINI_API_KEY
  if (!supabaseUrl || !supabaseAnonKey || !geminiApiKey) {
    console.error('AI generation endpoint is missing server environment configuration')
    return res.status(500).json({ error: 'บริการสร้างข้อสอบยังตั้งค่าไม่สมบูรณ์' })
  }

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` }
    })
    if (!userResponse.ok) return res.status(401).json({ error: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' })
    const user = await userResponse.json()
    const roleResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}`,
      { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` } }
    )
    if (!roleResponse.ok) return res.status(403).json({ error: 'ไม่สามารถตรวจสอบสิทธิ์สร้างข้อสอบได้' })
    const profileRows = await roleResponse.json()
    if (!['admin', 'creator'].includes(profileRows?.[0]?.role)) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ใช้บริการสร้างข้อสอบ' })
    }

    const { prompt } = req.body || {}
    if (typeof prompt !== 'string' || prompt.trim().length === 0 || prompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({ error: 'ข้อมูลสำหรับสร้างข้อสอบไม่ถูกต้องหรือมีขนาดใหญ่เกินไป' })
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.3 }
        })
      }
    )

    const payload = await geminiResponse.json().catch(() => null)
    if (!geminiResponse.ok) {
      console.error('Gemini generation request failed:', geminiResponse.status)
      return res.status(502).json({ error: payload?.error?.message || `เรียก Gemini ไม่สำเร็จ (HTTP ${geminiResponse.status})` })
    }
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return res.status(502).json({ error: 'AI ไม่ส่งผลลัพธ์ข้อสอบกลับมา' })
    return res.status(200).json({ text })
  } catch (error) {
    console.error('AI generation endpoint failed:', error)
    return res.status(500).json({ error: 'ไม่สามารถติดต่อบริการสร้างข้อสอบได้ กรุณาลองใหม่อีกครั้ง' })
  }
}
