import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// สร้างและส่งออกตัวเชื่อมต่อ เพื่อให้ไฟล์อื่นเอาไปดึงข้อมูลได้เลย
export const supabase = createClient(supabaseUrl, supabaseAnonKey)