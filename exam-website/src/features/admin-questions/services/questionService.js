import { supabase } from '../../../shared/lib/supabase'
import { runInBatches } from '../../../shared/lib/supabasePagination'

export const QUESTIONS_PER_PAGE = 10

export async function getQuestionManagerSession() {
  const {
    data: { session }
  } = await supabase.auth.getSession()
  if (!session) return null

  const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
  return {
    userId: session.user.id,
    role: data?.role || 'creator'
  }
}

export async function fetchCategoryQuestionsPage({
  categoryId,
  page = 1,
  sortOrder = 'asc',
  role = 'creator',
  userId = ''
}) {
  const fromIndex = (page - 1) * QUESTIONS_PER_PAGE
  const toIndex = fromIndex + QUESTIONS_PER_PAGE - 1

  let query = supabase.from('questions').select('*', { count: 'exact' }).eq('category_id', categoryId)
  if (role !== 'admin' && userId) query = query.eq('created_by', userId)

  const { data, error, count } = await query
    .order('created_at', { ascending: sortOrder === 'asc' })
    .order('id', { ascending: sortOrder === 'asc' })
    .range(fromIndex, toIndex)
  if (error) throw error

  return {
    questions: data || [],
    totalCount: count || 0
  }
}

export async function deleteStorageFile(url) {
  if (!url) return
  try {
    const fileName = url.split('/').pop()
    if (fileName) await supabase.storage.from('exam-images').remove([fileName])
  } catch (err) {
    console.error('ลบไฟล์รูปเก่าจาก Storage ไม่สำเร็จ:', err)
  }
}

function compressImageToWebp(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 1000
        let width = img.width
        let height = img.height
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width
          width = MAX_WIDTH
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.webp', { type: 'image/webp' }))
          },
          'image/webp',
          0.8
        )
      }
    }
  })
}

export async function uploadQuestionImage(file) {
  if (!file) return null
  const compressedFile = await compressImageToWebp(file)
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.webp`

  const { error } = await supabase.storage.from('exam-public-images').upload(fileName, compressedFile, {
    contentType: 'image/webp',
    cacheControl: '3600',
    upsert: false
  })

  if (error) throw error
  const {
    data: { publicUrl }
  } = supabase.storage.from('exam-public-images').getPublicUrl(fileName)
  return publicUrl
}

export async function saveQuestionWithImages({
  editingQuestion,
  categoryId,
  currentUserId,
  questionText,
  options,
  correctOption,
  explanation,
  isRandomized,
  isActive,
  imageFile,
  expImageFile,
  existingImageUrl,
  existingExpImageUrl
}) {
  let imageUrl = existingImageUrl
  if (imageFile) imageUrl = await uploadQuestionImage(imageFile)

  let expImageUrl = existingExpImageUrl
  if (expImageFile) expImageUrl = await uploadQuestionImage(expImageFile)

  const payload = {
    category_id: categoryId,
    question_text: questionText,
    options,
    correct_option: correctOption,
    explanation,
    is_options_randomized: isRandomized,
    image_url: imageUrl,
    explanation_image_url: expImageUrl,
    is_active: isActive,
    created_by: currentUserId || null
  }

  if (editingQuestion) {
    const { error } = await supabase.from('questions').update(payload).eq('id', editingQuestion.id)
    if (error) throw error

    if (editingQuestion.image_url && editingQuestion.image_url !== imageUrl) {
      await deleteStorageFile(editingQuestion.image_url)
    }
    if (editingQuestion.explanation_image_url && editingQuestion.explanation_image_url !== expImageUrl) {
      await deleteStorageFile(editingQuestion.explanation_image_url)
    }
  } else {
    const { error } = await supabase.from('questions').insert([payload])
    if (error) throw error
  }
}

export async function toggleQuestionActiveStatus(id, nextIsActive) {
  const { error } = await supabase.from('questions').update({ is_active: nextIsActive }).eq('id', id)
  if (error) throw error
}

export async function deleteQuestionWithImages(question) {
  if (question.image_url) await deleteStorageFile(question.image_url)
  if (question.explanation_image_url) await deleteStorageFile(question.explanation_image_url)
  const { error } = await supabase.from('questions').delete().eq('id', question.id)
  if (error) throw error
}

export async function bulkUpdateQuestionStatus(ids, isActive) {
  const { error } = await supabase.from('questions').update({ is_active: isActive }).in('id', ids)
  if (error) throw error
}

export async function bulkMoveQuestionCategory(ids, targetCategoryId) {
  const { error } = await supabase.from('questions').update({ category_id: targetCategoryId }).in('id', ids)
  if (error) throw error
}

export async function bulkDeleteQuestionsWithImages(ids, visibleQuestions) {
  const toDeleteQuestions = visibleQuestions.filter((q) => ids.includes(q.id))
  const filesToRemove = []
  toDeleteQuestions.forEach((q) => {
    if (q.image_url) filesToRemove.push(q.image_url.split('/').pop())
    if (q.explanation_image_url) filesToRemove.push(q.explanation_image_url.split('/').pop())
  })

  if (filesToRemove.length > 0) {
    await supabase.storage.from('exam-images').remove(filesToRemove)
  }

  const { error } = await supabase.from('questions').delete().in('id', ids)
  if (error) throw error
}

export async function insertBulkQuestions({ categoryId, currentUserId, parsedQuestions, asActive }) {
  const payloadToInsert = parsedQuestions.map((q) => ({
    category_id: categoryId,
    question_text: q.question_text,
    options: q.options,
    correct_option: q.correct_option,
    explanation: q.explanation || null,
    is_options_randomized: true,
    image_url: null,
    explanation_image_url: null,
    is_active: asActive,
    created_by: currentUserId || null
  }))

  await runInBatches(payloadToInsert, 100, async (batch) => {
    const { error } = await supabase.from('questions').insert(batch)
    if (error) throw error
  })
}
