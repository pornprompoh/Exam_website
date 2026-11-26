import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker
}

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_TEXT_PER_FILE = 120000
const MAX_FILES = 10

export async function extractFileText(file) {
  if (file.size > MAX_FILE_SIZE) throw new Error(`ไฟล์ "${file.name}" มีขนาดเกิน 10 MB`)
  if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) return (await file.text()).slice(0, MAX_TEXT_PER_FILE)
  if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) throw new Error(`ไม่รองรับไฟล์ "${file.name}" กรุณาเลือกเฉพาะ PDF หรือ TXT`)

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  let pdf = null
  try {
    pdf = await loadingTask.promise
    const pages = []
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      try {
        const content = await page.getTextContent()
        const text = content.items.map((item) => item.str).join(' ').trim()
        if (text) pages.push(`(หน้า ${pageNumber})\n${text}`)
      } finally {
        page?.cleanup?.()
      }
    }
    return pages.join('\n\n').slice(0, MAX_TEXT_PER_FILE)
  } finally {
    try {
      await pdf?.cleanup?.()
    } finally {
      await loadingTask?.destroy?.()
    }
  }
}

export function validateFileCount(files) {
  if (!files?.length) throw new Error('กรุณาเลือกไฟล์ PDF หรือ TXT อย่างน้อย 1 ไฟล์')
  if (files.length > MAX_FILES) throw new Error(`เลือกไฟล์ได้ไม่เกิน ${MAX_FILES} ไฟล์ต่อครั้ง`)
}

// ============================================================================
// Lazy Hybrid PDF & Multimodal Image Pipeline (Supports 300+ Page PDFs)
// Strictly additive exports — does NOT affect existing extractFileText().
// ============================================================================

export const MAX_EXTRACTOR_PDF_SIZE_MB = 200
export const MAX_EXTRACTOR_IMAGE_SIZE_MB = 20
export const MAX_EXTRACTOR_FILES = 30

const MIN_TEXT_CHARS_FOR_TEXT_MODE = 45
const MAX_VISION_RENDER_DIMENSION = 1600
const DEFAULT_VISION_RENDER_SCALE = 1.65
const DEFAULT_VISION_JPEG_QUALITY = 0.82

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
])

export function isPdfFile(file) {
  if (!file) return false
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function isSupportedImageFile(file) {
  if (!file) return false
  if (SUPPORTED_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) return true
  return /\.(jpe?g|png|webp)$/i.test(file.name)
}

export function validateExtractorFiles(files) {
  if (!files?.length) {
    throw new Error('กรุณาเลือกไฟล์ PDF หรือรูปภาพ (JPG, PNG, WebP) อย่างน้อย 1 ไฟล์')
  }
  if (files.length > MAX_EXTRACTOR_FILES) {
    throw new Error(`เลือกไฟล์ได้สูงสุด ${MAX_EXTRACTOR_FILES} ไฟล์ต่อครั้ง`)
  }
  const hasPdf = files.some(isPdfFile)
  if (hasPdf && files.length > 1) {
    throw new Error('สำหรับการสกัดข้อสอบจาก PDF กรุณาเลือกทีละ 1 ไฟล์ (หรือเลือกหลายไฟล์เฉพาะรูปภาพ JPG/PNG/WebP)')
  }
  for (const file of files) {
    if (isPdfFile(file)) {
      if (file.size > MAX_EXTRACTOR_PDF_SIZE_MB * 1024 * 1024) {
        throw new Error(`ไฟล์ PDF "${file.name}" มีขนาดเกิน ${MAX_EXTRACTOR_PDF_SIZE_MB} MB`)
      }
    } else if (isSupportedImageFile(file)) {
      if (file.size > MAX_EXTRACTOR_IMAGE_SIZE_MB * 1024 * 1024) {
        throw new Error(`ไฟล์รูปภาพ "${file.name}" มีขนาดเกิน ${MAX_EXTRACTOR_IMAGE_SIZE_MB} MB`)
      }
    } else {
      throw new Error(`ไม่รองรับไฟล์ "${file.name}" กรุณาเลือกเฉพาะ PDF หรือรูปภาพ JPG, PNG, WebP`)
    }
  }
}

function fnv1aHex(bytes) {
  let hash = 0x811c9dc5
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i]
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Compute a fast, stable fingerprint for large files (even 200MB+ PDFs) without
 * loading the entire file into RAM: combines metadata + head/middle/tail byte slices.
 */
export async function computeFileFingerprint(filesInput) {
  const files = Array.isArray(filesInput) ? filesInput : [filesInput]
  const SAMPLE_BYTES = 64 * 1024
  const chunks = []
  const encoder = new TextEncoder()

  for (const file of files) {
    chunks.push(encoder.encode(`${file.name}|${file.size}|${file.type || ''}|`))
    const head = new Uint8Array(await file.slice(0, Math.min(SAMPLE_BYTES, file.size)).arrayBuffer())
    chunks.push(head)
    if (file.size > SAMPLE_BYTES * 2) {
      const midStart = Math.floor((file.size - SAMPLE_BYTES) / 2)
      const mid = new Uint8Array(await file.slice(midStart, midStart + SAMPLE_BYTES).arrayBuffer())
      chunks.push(mid)
    }
    if (file.size > SAMPLE_BYTES) {
      const tailStart = Math.max(0, file.size - SAMPLE_BYTES)
      const tail = new Uint8Array(await file.slice(tailStart, file.size).arrayBuffer())
      chunks.push(tail)
    }
  }

  const totalLength = chunks.reduce((acc, part) => acc + part.byteLength, 0)
  const combined = new Uint8Array(totalLength)
  let offset = 0
  for (const part of chunks) {
    combined.set(part, offset)
    offset += part.byteLength
  }

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const digest = await crypto.subtle.digest('SHA-256', combined)
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
      return `sha256:${hex.slice(0, 32)}`
    } catch {
      // Fallback below
    }
  }

  return `fnv:${fnv1aHex(combined)}:${totalLength}`
}

/**
 * Reconstruct readable lines from pdf.js textContent items using Y-position & hasEOL.
 */
function reconstructPageText(textContent) {
  const items = textContent?.items || []
  if (items.length === 0) return ''

  const lines = []
  let currentLine = ''
  let lastY = null

  for (const item of items) {
    const str = typeof item.str === 'string' ? item.str : ''
    const y = Array.isArray(item.transform) ? item.transform[5] : null

    if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
      if (currentLine.trim()) lines.push(currentLine.trimEnd())
      currentLine = ''
    }

    if (str) {
      currentLine += currentLine && !currentLine.endsWith(' ') && !str.startsWith(' ')
        ? ` ${str}`
        : str
    }

    if (item.hasEOL) {
      if (currentLine.trim()) lines.push(currentLine.trimEnd())
      currentLine = ''
      lastY = null
    } else if (y !== null) {
      lastY = y
    }
  }

  if (currentLine.trim()) lines.push(currentLine.trimEnd())
  return lines.join('\n').trim()
}

/**
 * Analyze extracted PDF text layer quality to detect scanned pages or broken Thai font encoding.
 */
function analyzeTextLayerQuality(text) {
  const compact = String(text || '').replace(/\s+/g, '')
  const charCount = compact.length
  if (charCount === 0) {
    return { charCount: 0, isUsableText: false, isGarbled: false }
  }

  // Detect replacement chars, private-use glyphs, or excessive control chars (common in broken Thai PDFs)
  let garbledCount = 0
  for (let i = 0; i < charCount; i += 1) {
    const code = compact.charCodeAt(i)
    if (
      code === 0xFFFD ||
      (code >= 0xE000 && code <= 0xF8FF) ||
      (code <= 0x08) ||
      code === 0x0B ||
      code === 0x0C ||
      (code >= 0x0E && code <= 0x1F)
    ) {
      garbledCount += 1
    }
  }
  const garbledRatio = garbledCount / charCount

  // Meaningful Thai / Latin / Digit characters
  const readableMatches = compact.match(/[ก-๛a-zA-Z0-9]/g) || []
  const readableRatio = readableMatches.length / charCount

  const isGarbled = garbledRatio > 0.12 || (charCount >= 20 && readableRatio < 0.35)
  const isUsableText = charCount >= MIN_TEXT_CHARS_FOR_TEXT_MODE && !isGarbled

  return {
    charCount,
    isUsableText,
    isGarbled
  }
}

/**
 * Deterministic local pre-filter for front-matter & blank pages (Text mode).
 * Strictly conservative: NEVER skips a page that has exam choice or answer-key signals.
 */
export function classifyNonExamPage(text, pageNumber, totalPages) {
  const raw = String(text || '').trim()
  const compact = raw.replace(/\s+/g, '')

  // Blank or page-number-only page
  if (compact.length < 18 || /^(?:หน้า|page)?\s*[-–—]?\s*[0-9๐-๙]{1,4}\s*[-–—]?$/i.test(raw)) {
    return { skip: true, reason: 'blank', detail: 'หน้าว่างหรือมีเฉพาะเลขหน้า' }
  }

  // Strong exam signals — NEVER locally skip if present
  const hasThaiChoices = /[ก]\s*[.)]/.test(raw) && /[ข]\s*[.)]/.test(raw) && /[ค]\s*[.)]/.test(raw)
  const hasEngChoices = /(?:^|\s)A\s*[.)]\s+\S/.test(raw) && /(?:^|\s)B\s*[.)]\s+\S/.test(raw) && /(?:^|\s)C\s*[.)]\s+\S/.test(raw)
  const hasAnswerKeyPattern =
    /(?:เฉลย|คำตอบ|answer\s*key)/i.test(raw) &&
    /(?:[0-9๐-๙]{1,3}\s*[.)]\s*(?:[กขคงจ]|[A-Ea-e]|[1-5]))/.test(raw)
  const hasMultipleNumberedQuestions = (raw.match(/(?:^|\n)\s*(?:ข้อ(?:ที่)?\s*)?[0-9๐-๙]{1,4}\s*[.)]\s+\S/g) || []).length >= 2

  if (hasThaiChoices || hasEngChoices || hasAnswerKeyPattern) {
    return { skip: false, reason: null, detail: '' }
  }

  // Table of Contents detection (สารบัญ / dotted leaders)
  const hasTocHeading = /(?:^|\n)\s*(?:สารบัญ|สารบาญ|table\s+of\s+contents|contents)\b/i.test(raw)
  const dottedLeaderCount = (raw.match(/\.{4,}\s*[0-9๐-๙]+/g) || []).length
  if (hasTocHeading || dottedLeaderCount >= 4) {
    return { skip: true, reason: 'toc', detail: 'หน้าสารบัญ' }
  }

  // Preface / Foreword / Instructions / Acknowledgements (especially without questions)
  const isEarlyPage = pageNumber <= Math.max(15, Math.ceil(totalPages * 0.15))
  const hasFrontMatterHeading =
    /(?:^|\n)\s*(?:คำนำ|คำชี้แจง|บทนำ|กิตติกรรมประกาศ|เกี่ยวกับผู้เขียน|ลิขสิทธิ์|สงวนลิขสิทธิ์|ข้อมูลทางบรรณานุกรม|preface|foreword|acknowledg(?:e)?ments|copyright|isbn)\b/i.test(raw)

  if (hasFrontMatterHeading && !hasMultipleNumberedQuestions) {
    return { skip: true, reason: 'preface', detail: 'หน้าคำนำ/คำชี้แจง/ข้อมูลหนังสือ' }
  }

  // Cover / Title / Copyright page (very early pages with short text and no questions)
  if (isEarlyPage && pageNumber <= 4 && compact.length < 320 && !hasMultipleNumberedQuestions) {
    const looksLikeCoverOrMeta =
      /(?:isbn|พิมพ์ครั้งที่|สำนักพิมพ์|ผู้แต่ง|ผู้เขียน|เรียบเรียง|รวบรวม|คู่มือ|แนวข้อสอบ|เตรียมสอบ|สงวนลิขสิทธิ์|ราคา\s*\d)/i.test(raw) ||
      pageNumber === 1
    if (looksLikeCoverOrMeta) {
      return { skip: true, reason: 'cover', detail: 'หน้าปก/หน้าชื่อเรื่อง/หน้าลิขสิทธิ์' }
    }
  }

  return { skip: false, reason: null, detail: '' }
}

/**
 * Render a SINGLE PDF page to JPEG base64 and immediately release canvas memory.
 */
async function renderSinglePdfPageToJpegBase64(page, {
  scale = DEFAULT_VISION_RENDER_SCALE,
  maxDimension = MAX_VISION_RENDER_DIMENSION,
  quality = DEFAULT_VISION_JPEG_QUALITY
} = {}) {
  const baseViewport = page.getViewport({ scale: 1 })
  const maxSide = Math.max(baseViewport.width, baseViewport.height)
  const cappedScale = maxSide * scale > maxDimension ? maxDimension / maxSide : scale
  const viewport = page.getViewport({ scale: Math.max(1, cappedScale) })

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const context = canvas.getContext('2d', { alpha: false })

  try {
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: context, viewport }).promise
    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    const commaIdx = dataUrl.indexOf(',')
    return {
      mimeType: 'image/jpeg',
      base64Data: commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl,
      width: canvas.width,
      height: canvas.height
    }
  } finally {
    // Immediately release GPU/RAM backing store for 300+ page safety
    context?.clearRect?.(0, 0, canvas.width, canvas.height)
    canvas.width = 0
    canvas.height = 0
  }
}

/**
 * Inspect whether a low-text PDF page has painted images/paths (scanned page) vs truly blank.
 */
async function pageHasVisualContent(page) {
  try {
    const opList = await page.getOperatorList()
    const ops = pdfjsLib.OPS || {}
    const visualOps = new Set([
      ops.paintImageXObject,
      ops.paintInlineImageXObject,
      ops.paintImageMaskXObject,
      ops.paintJpegXObject,
      ops.paintFormXObjectBegin
    ].filter((val) => val !== undefined))

    let pathCount = 0
    for (const fn of opList.fnArray || []) {
      if (visualOps.has(fn)) return true
      if (fn === ops.stroke || fn === ops.fill || fn === ops.eoFill) {
        pathCount += 1
        if (pathCount > 25) return true
      }
    }
    return false
  } catch {
    // If operator inspection fails, err on the side of Vision rendering
    return true
  }
}

/**
 * Open a PDF document for Lazy Page-by-Page Processing (supports 300+ page PDFs).
 * Never loads or renders all pages into memory simultaneously.
 */
export async function openLazyPdfDocument(file) {
  let objectUrl = null
  let loadingTask = null
  let pdf = null

  try {
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      objectUrl = URL.createObjectURL(file)
      loadingTask = pdfjsLib.getDocument({
        url: objectUrl,
        disableAutoFetch: true,
        disableStream: false
      })
    } else {
      loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
    }
    pdf = await loadingTask.promise
  } catch {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      objectUrl = null
    }
    // Fallback to ArrayBuffer if blob URL loading failed
    loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
    pdf = await loadingTask.promise
  }

  const numPages = pdf.numPages

  return {
    numPages,
    /**
     * Read & classify a single page lazily, immediately cleaning up pdf.js page resources.
     */
    async readPage(pageNumber, options = {}) {
      const page = await pdf.getPage(pageNumber)
      try {
        const textContent = await page.getTextContent()
        const text = reconstructPageText(textContent)
        const quality = analyzeTextLayerQuality(text)

        if (quality.isUsableText) {
          const skipCheck = classifyNonExamPage(text, pageNumber, numPages)
          if (skipCheck.skip) {
            return {
              pageNumber,
              mode: 'skipped',
              skipReason: skipCheck.reason,
              skipDetail: skipCheck.detail,
              text: '',
              image: null
            }
          }
          return {
            pageNumber,
            mode: 'text',
            skipReason: null,
            skipDetail: '',
            text,
            image: null
          }
        }

        // Low-text or garbled page -> verify if blank vs scanned visual content
        const hasVisual = quality.isGarbled || quality.charCount > 12 || (await pageHasVisualContent(page))
        if (!hasVisual) {
          return {
            pageNumber,
            mode: 'skipped',
            skipReason: 'blank',
            skipDetail: 'หน้าว่าง (ไม่พบข้อความหรือภาพสแกน)',
            text: '',
            image: null
          }
        }

        const rendered = await renderSinglePdfPageToJpegBase64(page, options)
        return {
          pageNumber,
          mode: 'vision',
          skipReason: null,
          skipDetail: '',
          text: quality.isGarbled ? '' : text,
          image: rendered
        }
      } finally {
        page?.cleanup?.()
      }
    },

    /**
     * Quick sample of first few pages to estimate Text vs Vision ratio for auto batch sizing.
     */
    async sampleDocumentProfile() {
      const samplePages = []
      const candidates = [
        1,
        Math.min(numPages, 3),
        Math.min(numPages, Math.max(5, Math.floor(numPages * 0.15))),
        Math.min(numPages, Math.max(8, Math.floor(numPages * 0.5))),
        Math.min(numPages, Math.max(10, Math.floor(numPages * 0.85)))
      ]
      for (const p of [...new Set(candidates)]) {
        if (p >= 1 && p <= numPages) samplePages.push(p)
      }

      let textCount = 0
      let visionCount = 0

      for (const pageNumber of samplePages) {
        const page = await pdf.getPage(pageNumber)
        try {
          const textContent = await page.getTextContent()
          const text = reconstructPageText(textContent)
          const quality = analyzeTextLayerQuality(text)
          if (quality.isUsableText) textCount += 1
          else visionCount += 1
        } finally {
          page?.cleanup?.()
        }
      }

      const dominantMode = visionCount === 0
        ? 'text'
        : textCount === 0
          ? 'vision'
          : 'mixed'

      return {
        numPages,
        dominantMode,
        sampledTextPages: textCount,
        sampledVisionPages: visionCount,
        recommended: recommendBatchConfig(numPages, dominantMode)
      }
    },

    async destroy() {
      try {
        await pdf?.cleanup?.()
      } finally {
        try {
          await loadingTask?.destroy?.()
        } finally {
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl)
            objectUrl = null
          }
        }
      }
    }
  }
}

/**
 * Convert an uploaded JPG/PNG/WebP image file into a resized JPEG/WebP base64 payload
 * for Gemini Multimodal Vision while keeping memory usage low.
 */
export async function readImageFileAsInlineData(file, maxDimension = MAX_VISION_RENDER_DIMENSION) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error(`ไม่สามารถอ่านไฟล์รูปภาพ "${file.name}" ได้`))
      image.src = objectUrl
    })

    let width = img.naturalWidth || img.width
    let height = img.naturalHeight || img.height
    const maxSide = Math.max(width, height)
    if (maxSide > maxDimension) {
      const ratio = maxDimension / maxSide
      width = Math.max(1, Math.round(width * ratio))
      height = Math.max(1, Math.round(height * ratio))
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { alpha: false })
    try {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      const commaIdx = dataUrl.indexOf(',')
      return {
        mimeType: 'image/jpeg',
        base64Data: commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl,
        width,
        height
      }
    } finally {
      ctx?.clearRect?.(0, 0, width, height)
      canvas.width = 0
      canvas.height = 0
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * Auto-First batch size & adaptive pacing recommendation based on page count & document type.
 */
export function recommendBatchConfig(totalPages, dominantMode = 'text') {
  if (dominantMode === 'vision') {
    return {
      pagesPerBatch: totalPages <= 10 ? 2 : 3,
      maxVisionPagesPerBatch: 3,
      baseDelayMs: 2200,
      label: 'โหมดภาพสแกน (Vision) · แนะนำ 3 หน้า/รอบ เพื่อความคมชัดและประหยัดโควตา'
    }
  }

  if (dominantMode === 'mixed') {
    return {
      pagesPerBatch: totalPages >= 100 ? 6 : 5,
      maxVisionPagesPerBatch: 3,
      baseDelayMs: 1800,
      label: 'โหมดผสม (Text + Vision) · แนะนำ 5–6 หน้า/รอบ (จำกัดภาพสแกนไม่เกิน 3 หน้า/รอบ)'
    }
  }

  // Pure Text PDF
  if (totalPages >= 150) {
    return {
      pagesPerBatch: 10,
      maxVisionPagesPerBatch: 3,
      baseDelayMs: 1400,
      label: 'โหมดข้อความขนาดใหญ่ (150+ หน้า) · แนะนำ 10 หน้า/รอบ พร้อมหน่วงเวลาอัตโนมัติ'
    }
  }
  if (totalPages >= 40) {
    return {
      pagesPerBatch: 8,
      maxVisionPagesPerBatch: 3,
      baseDelayMs: 1200,
      label: 'โหมดข้อความ (Text) · แนะนำ 8 หน้า/รอบ'
    }
  }
  return {
    pagesPerBatch: Math.min(Math.max(totalPages, 1), 6),
    maxVisionPagesPerBatch: 3,
    baseDelayMs: 1000,
    label: 'โหมดข้อความ (Text) · แนะนำ 6 หน้า/รอบ'
  }
}

