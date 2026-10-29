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
