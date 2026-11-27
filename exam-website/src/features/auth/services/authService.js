import { supabase } from '../../../shared/lib/supabase'

export async function getAuthSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export function subscribeAuthStateChange(callback) {
  const { data: authListener } = supabase.auth.onAuthStateChange(callback)
  return () => authListener.subscription.unsubscribe()
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  })
  if (error) throw error
}

export async function signInWithEmailPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    if (error.message.includes('Email not confirmed')) {
      throw new Error('กรุณากดยืนยันตัวตนในอีเมลของคุณก่อนเข้าสู่ระบบครับ')
    }
    throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง')
  }
}

export async function signUpWithEmailPassword(email, password) {
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
}

export async function sendPasswordResetEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/login`
  })
  if (error) throw error
}

export async function updateUserPassword(password) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}
