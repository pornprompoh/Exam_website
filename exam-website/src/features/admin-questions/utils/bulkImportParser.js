export const BULK_IMPORT_MAGIC_PROMPT = `ทำหน้าที่เป็นผู้เชี่ยวชาญด้านการแปลงข้อสอบ ช่วยอ่านโจทย์และตัวเลือกทั้งหมดจากรูปภาพนี้ โดยตัดลายน้ำ หัวกระดาษ และส่วนที่ไม่เกี่ยวข้องออก อ่านเรียงข้อให้ถูกต้อง และพิมพ์แปลงออกมาเป็นข้อความตามฟอร์แมตด้านล่างนี้เท่านั้น (ห้ามใส่ข้อความเกริ่นนำหรือท้ายบท):

1. [พิมพ์โจทย์คำถามที่นี่]
A. [พิมพ์ตัวเลือกแรก]
B. [พิมพ์ตัวเลือกที่สอง]
C. [พิมพ์ตัวเลือกที่สาม]
D. [พิมพ์ตัวเลือกที่สี่]
ANS: [ใส่เฉลยเป็น A, B, C หรือ D หากในรูปไม่มีเฉลยให้ใส่ A]
EXP: [พิมพ์คำอธิบายเฉลยหากมี ถ้าไม่มีให้เว้นว่างไว้]
---
(ใช้เครื่องหมาย --- คั่นระหว่างข้อเสมอ)`

export function parseBulkImportText(rawText) {
  const blocks = String(rawText || '')
    .split('---')
    .map((b) => b.trim())
    .filter((b) => b.length > 10)
  const parsedList = []

  blocks.forEach((block) => {
    try {
      const lines = block
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l !== '')
      let qText = ''
      let opts = []
      let correctIdx = 0
      let expText = ''

      lines.forEach((line) => {
        if (
          /^\d+\./.test(line) ||
          (!line.startsWith('A.') &&
            !line.startsWith('B.') &&
            !line.startsWith('C.') &&
            !line.startsWith('D.') &&
            !line.startsWith('ANS:') &&
            !line.startsWith('EXP:') &&
            qText === '')
        ) {
          qText += line.replace(/^\d+\.\s*/, '') + '\n'
        } else if (/^[A-D]\./i.test(line)) {
          opts.push(line.replace(/^[A-D]\.\s*/i, ''))
        } else if (/^ANS:/i.test(line)) {
          const ansStr = line.replace(/^ANS:\s*/i, '').toUpperCase()
          const mapping = { A: 0, B: 1, C: 2, D: 3 }
          if (mapping[ansStr] !== undefined) correctIdx = mapping[ansStr]
        } else if (/^EXP:/i.test(line)) {
          expText += line.replace(/^EXP:\s*/i, '') + '\n'
        } else if (qText !== '' && opts.length === 0) {
          qText += line + '\n'
        }
      })

      while (opts.length < 4) opts.push('ไม่มีข้อมูลตัวเลือก')
      if (opts.length > 4) opts = opts.slice(0, 4)

      if (qText.trim()) {
        parsedList.push({
          question_text: qText.trim(),
          options: opts,
          correct_option: correctIdx,
          explanation: expText.trim()
        })
      }
    } catch (err) {
      console.error('Parse Error on block:', block, err)
    }
  })

  return parsedList
}
