// 7-day Auto-Save TTL (Pause-on-Close Timer, Lightweight ID-only payload)
export const EXAM_AUTOSAVE_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const AUTOSAVE_TIMER_INTERVAL_SEC = 5

export function getExamAutosaveKey(userId, categoryId) {
  return `exam_autosave_${userId || 'anonymous'}_${categoryId}`
}

export function clearLegacyDraftKey(categoryId, userId) {
  try {
    localStorage.removeItem(`exam-session-draft:${userId || 'anonymous'}:${categoryId}`)
  } catch {
    // Ignore storage errors
  }
}

export function clearExamAutosave(key) {
  if (!key) return
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.error('ไม่สามารถลบข้อมูล Auto-Save ออกจากเครื่องได้:', error)
  }
}

export function readExamAutosave(key, categoryId) {
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const data = JSON.parse(raw)

    if (!Number.isFinite(data?.expiresAt) || Date.now() > data.expiresAt) {
      localStorage.removeItem(key)
      return null
    }

    const isValid =
      data.categoryId === categoryId &&
      Array.isArray(data.questionIds) &&
      data.questionIds.length > 0 &&
      data.answers &&
      typeof data.answers === 'object' &&
      !Array.isArray(data.answers) &&
      Number.isInteger(data.currentIndex) &&
      data.currentIndex >= 0 &&
      Number.isFinite(data.remainingSeconds) &&
      data.remainingSeconds >= 0 &&
      Number.isFinite(data?.timerConfig?.totalTimeSeconds) &&
      data.timerConfig.totalTimeSeconds >= 0

    if (isValid) return data
    localStorage.removeItem(key)
  } catch (error) {
    console.error('ไม่สามารถอ่านข้อมูล Auto-Save จากเครื่องได้:', error)
    clearExamAutosave(key)
  }
  return null
}

export function writeExamAutosave(key, payload) {
  if (!key || !payload?.questionIds?.length) return
  try {
    const now = Date.now()
    const compactPayload = {
      version: 2,
      categoryId: payload.categoryId,
      questionIds: payload.questionIds,
      choiceOrders: payload.choiceOrders || {},
      answers: payload.answers || {},
      flaggedIds: Array.isArray(payload.flaggedIds) ? payload.flaggedIds : [],
      currentIndex: Number(payload.currentIndex) || 0,
      timerConfig: {
        totalTimeSeconds: Math.max(0, Number(payload.totalTimeSeconds) || 0)
      },
      remainingSeconds: Math.max(0, Number(payload.remainingSeconds) || 0),
      savedAt: now,
      expiresAt: now + EXAM_AUTOSAVE_TTL_MS
    }
    localStorage.setItem(key, JSON.stringify(compactPayload))
  } catch (error) {
    console.warn('ไม่สามารถบันทึก Auto-Save ลง localStorage ได้:', error)
  }
}
