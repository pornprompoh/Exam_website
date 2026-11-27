import { supabase } from '../../../shared/lib/supabase'

export async function fetchCurrentUserProfile() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', session.user.id)
    .single()

  return {
    userId: session.user.id,
    email: session.user.email || '',
    role: !error && data ? data.role || 'student' : 'student',
    displayName:
      !error && data
        ? data.display_name || session.user.email?.split('@')[0] || ''
        : session.user.email?.split('@')[0] || ''
  }
}

export async function updateProfileDisplayName(displayName) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName.trim() })
    .eq('id', session.user.id)
  if (error) throw error
}

export async function updateAccountPassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
