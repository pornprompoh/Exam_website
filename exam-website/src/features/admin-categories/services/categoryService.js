import { supabase } from '../../../shared/lib/supabase'
import { fetchAllPaginated, runInBatches } from '../../../shared/lib/supabasePagination'

export async function getAdminUserSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  return { userId: session.user.id, role: data?.role || 'creator' }
}

export async function fetchManagedCategories(role, userId) {
  return fetchAllPaginated(
    (client) => {
      let query = client.from('categories').select('*')
      if (role !== 'admin' && userId) {
        query = query.or(`created_by.eq.${userId},co_owners.cs.{${userId}}`)
      }
      return query.order('created_at', { ascending: true })
    },
    { pageSize: 1000, orderColumn: 'id', ascending: true }
  )
}

export async function saveCategory({ editingCat, name, description, currentUserId }) {
  const payload = {
    name: name.trim(),
    description: description.trim(),
    is_active: true,
    created_by: editingCat ? editingCat.created_by : currentUserId || null
  }
  if (editingCat) {
    const { error } = await supabase.from('categories').update(payload).eq('id', editingCat.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('categories').insert([payload])
    if (error) throw error
  }
}

export async function updateCategoryActiveStatus(id, isActive) {
  const { error } = await supabase.from('categories').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

export async function batchUpdateCategoryStatus(ids, isActive) {
  const { error } = await supabase.from('categories').update({ is_active: isActive }).in('id', ids)
  if (error) throw error
}

export async function deleteCategoriesWithImages(categoryIds) {
  const questionsInCat = await fetchAllPaginated(
    (client) =>
      client
        .from('questions')
        .select('id, image_url, explanation_image_url')
        .in('category_id', categoryIds),
    { pageSize: 1000, orderColumn: 'id', ascending: true }
  )

  if (questionsInCat && questionsInCat.length > 0) {
    const filesToRemove = []
    questionsInCat.forEach((q) => {
      if (q.image_url) filesToRemove.push(q.image_url.split('/').pop())
      if (q.explanation_image_url) filesToRemove.push(q.explanation_image_url.split('/').pop())
    })
    if (filesToRemove.length > 0) {
      await runInBatches(filesToRemove, 200, async (batch) => {
        await supabase.storage.from('exam-images').remove(batch)
      })
    }
  }

  const { error } = await supabase.from('categories').delete().in('id', categoryIds)
  if (error) throw error
}

export async function fetchCoOwnerProfiles(coOwnerIds) {
  if (!Array.isArray(coOwnerIds) || coOwnerIds.length === 0) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role')
    .in('id', coOwnerIds)
  if (error) throw error
  return data || []
}

export async function findProfileByEmail(email) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role')
    .eq('email', email.trim())
    .single()
  if (error) return null
  return data
}

export async function updateCategoryCoOwners(categoryId, updatedCoOwners) {
  const { error } = await supabase
    .from('categories')
    .update({ co_owners: updatedCoOwners })
    .eq('id', categoryId)
  if (error) throw error
}
