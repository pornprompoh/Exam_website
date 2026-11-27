import { supabase } from '../../../shared/lib/supabase'
import { fetchAllPaginated } from '../../../shared/lib/supabasePagination'

export async function fetchAllUserProfiles() {
  const { data: { session } } = await supabase.auth.getSession()
  const currentUserId = session?.user?.id || ''

  const users = await fetchAllPaginated(
    (client) => client.from('profiles').select('*').order('created_at', { ascending: false }),
    { pageSize: 1000, orderColumn: 'id', ascending: true }
  )

  return { currentUserId, users: users || [] }
}

export async function updateUserRole(userId, newRole) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId)
    .select()

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('ถูกบล็อกโดยระบบความปลอดภัย RLS ของ Supabase กรุณาตรวจสอบนโยบายตาราง profiles')
  }
  return data[0]
}
