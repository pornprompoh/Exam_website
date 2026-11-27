import { supabase } from '../../../../shared/lib/supabase'

export const CHECKPOINT_TABLE = 'question_extraction_checkpoints'
const LOCAL_CHECKPOINT_PREFIX = 'ai_exam_extractor_checkpoint:'

function getLocalCheckpointKey(categoryId, fingerprint) {
  return `${LOCAL_CHECKPOINT_PREFIX}${categoryId}:${fingerprint}`
}

function readLocalCheckpoint(categoryId, fingerprint) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(getLocalCheckpointKey(categoryId, fingerprint))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function readAllLocalCheckpointsForCategory(categoryId) {
  if (typeof window === 'undefined' || !categoryId) return []
  const prefix = `${LOCAL_CHECKPOINT_PREFIX}${categoryId}:`
  const list = []
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        const raw = window.localStorage.getItem(key)
        if (raw) list.push(JSON.parse(raw))
      }
    }
  } catch {
    // Ignore storage errors
  }
  return list
}

function writeLocalCheckpoint(categoryId, fingerprint, data) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(getLocalCheckpointKey(categoryId, fingerprint), JSON.stringify(data))
  } catch {
    // Ignore storage quota errors
  }
}

export function removeLocalCheckpoint(categoryId, fingerprint) {
  if (typeof window === 'undefined') return
  try {
    if (fingerprint) {
      window.localStorage.removeItem(getLocalCheckpointKey(categoryId, fingerprint))
      return
    }
    const prefix = `${LOCAL_CHECKPOINT_PREFIX}${categoryId}:`
    const keysToRemove = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key && key.startsWith(prefix)) keysToRemove.push(key)
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Ignore storage errors
  }
}

export async function loadExtractionCheckpoint(categoryId, fingerprint) {
  if (!categoryId || !fingerprint) return null
  const local = readLocalCheckpoint(categoryId, fingerprint)

  try {
    const { data, error } = await supabase
      .from(CHECKPOINT_TABLE)
      .select('*')
      .eq('category_id', categoryId)
      .eq('source_file_fingerprint', fingerprint)
      .maybeSingle()

    if (error) return local

    if (data && local) {
      const dbPass = Number(data.current_pass || 1)
      const localPass = Number(local.current_pass || 1)
      if (dbPass !== localPass) return dbPass > localPass ? data : local
      const dbPoolLen = Array.isArray(data.answer_key_pool) ? data.answer_key_pool.length : 0
      const localPoolLen = Array.isArray(local.answer_key_pool) ? local.answer_key_pool.length : 0
      if (Number(data.last_completed_page || 0) === Number(local.last_completed_page || 0)) {
        return dbPoolLen >= localPoolLen ? data : local
      }
      return Number(data.last_completed_page || 0) >= Number(local.last_completed_page || 0) ? data : local
    }
    return data || local
  } catch {
    return local
  }
}

export async function loadCategoryCheckpoints(categoryId) {
  if (!categoryId) return []
  const localList = readAllLocalCheckpointsForCategory(categoryId)

  try {
    const { data, error } = await supabase
      .from(CHECKPOINT_TABLE)
      .select('*')
      .eq('category_id', categoryId)
      .order('updated_at', { ascending: false })

    if (error) return localList

    const byFingerprint = new Map()
    for (const row of localList) {
      if (row?.source_file_fingerprint) byFingerprint.set(row.source_file_fingerprint, row)
    }
    for (const row of data || []) {
      if (row?.source_file_fingerprint) byFingerprint.set(row.source_file_fingerprint, row)
    }
    return [...byFingerprint.values()]
  } catch {
    return localList
  }
}

export async function saveExtractionCheckpoint(checkpoint) {
  if (!checkpoint?.category_id || !checkpoint?.source_file_fingerprint) return

  const record = {
    category_id: checkpoint.category_id,
    source_file_fingerprint: checkpoint.source_file_fingerprint,
    source_file_name: checkpoint.source_file_name || 'unknown',
    total_pages: Number(checkpoint.total_pages) || 1,
    last_completed_page: Number(checkpoint.last_completed_page) || 0,
    pending_tail_text: checkpoint.pending_tail_text || null,
    pending_tail_page: checkpoint.pending_tail_page || null,
    current_pass: Number(checkpoint.current_pass) || 1,
    last_section: checkpoint.last_section || null,
    answer_key_pool: Array.isArray(checkpoint.answer_key_pool) ? checkpoint.answer_key_pool : [],
    escalation_queue: Array.isArray(checkpoint.escalation_queue) ? checkpoint.escalation_queue : [],
    pass3_processed_count: Number(checkpoint.pass3_processed_count) || 0,
    pass3_total_count: Number(checkpoint.pass3_total_count) || 0,
    stats: checkpoint.stats || {},
    status: checkpoint.status || 'in_progress',
    created_by: checkpoint.created_by || null
  }

  writeLocalCheckpoint(record.category_id, record.source_file_fingerprint, {
    ...record,
    updated_at: new Date().toISOString()
  })

  try {
    await supabase.from(CHECKPOINT_TABLE).upsert(record, { onConflict: 'category_id,source_file_fingerprint' })
  } catch {
    // LocalStorage mirror preserves checkpoint & Answer Key Pool even if DB table lags
  }
}

export async function clearExtractionCheckpoint(categoryId, fingerprint) {
  if (!categoryId || !fingerprint) return
  removeLocalCheckpoint(categoryId, fingerprint)

  try {
    await supabase
      .from(CHECKPOINT_TABLE)
      .delete()
      .eq('category_id', categoryId)
      .eq('source_file_fingerprint', fingerprint)
  } catch {
    // Ignore if checkpoint table doesn't exist
  }
}
