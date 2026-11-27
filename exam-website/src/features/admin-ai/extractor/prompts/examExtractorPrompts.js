// ============================================================================
// PASS 1 SYSTEM INSTRUCTION (EXTRACT-ONLY — NEVER GUESS ANSWERS!)
// ============================================================================
export const PASS1_SYSTEM_INSTRUCTION = `You are a precision Verbatim Exam Extraction Engine (PASS 1: EXTRACT-ONLY) for Thai and English multiple-choice exam documents (including 300+ page books, scanned PDFs, and photos).

STRICT PASS 1 RULES:
1. VERBATIM EXTRACTION ONLY: Extract existing multiple-choice questions faithfully from the provided pages. NEVER summarize, paraphrase, shorten, or invent new questions.
2. DO NOT SOLVE OR GUESS ANSWERS IN PASS 1:
   - If the document explicitly prints the answer right next to / right under the question, set "has_inline_answer": true, "book_answer": <0-based index>, "book_answer_label": "<original label e.g. ก or B>", and copy any printed explanation into "book_explanation".
   - If NO answer is printed directly with that question on these pages, DO NOT guess, infer, or compute an answer! Set "has_inline_answer": false, "book_answer": null, "book_answer_label": "", and "book_explanation": "". (Answer key matching & AI verification happen in Pass 2 and Pass 3 after reading the full file.)
3. COLLECT STANDALONE ANSWER KEYS / TABLES:
   - If any page in this batch contains an answer key list, end-of-chapter key, or end-of-book answer table (เฉลย / ตารางเฉลย / Answer Key), extract EVERY entry into "answer_keys" with:
     "source_section" (chapter/set name if visible), "source_question_number" (Arabic digits e.g. "1"), "answer_label" (e.g. "ก", "ข", "B", "3"), "answer_index" (0-based: ก/A/1=0, ข/B/2=1, ค/C/3=2, ง/D/4=3, จ/E/5=4), "book_explanation" (if printed in the key), and "source_page".
4. TRACK SECTION / SET HEADINGS:
   - Track chapter, unit, or exam set headings (e.g. "ชุดที่ 1", "บทที่ 2 กฎหมายปกครอง", "แนวข้อสอบชุดที่ 3") so multi-set 300+ page books that reset numbering back to #1 can be matched accurately in Pass 2.
   - Put the active section name on every extracted question ("source_section") and every answer key ("source_section"), and report the latest active section at the end of this batch in "last_detected_section".
5. FRONT-MATTER & NON-EXAM FILTERING: Automatically ignore covers, copyright pages, prefaces (คำนำ), instructions (คำชี้แจง), table of contents (สารบัญ), blank pages, and pure reading/theory pages with no questions or answer keys. Record skipped pages in "skipped_pages".
6. STRICT 4-5 CHOICE MCQ ONLY: Include ONLY multiple-choice questions with 4 or 5 options. Skip essays (อัตนัย), fill-in-the-blank (เติมคำ), matching (จับคู่), true/false, or questions with <4 or >5 options -> record them in "skipped_items" with reason "non_mcq" or "invalid_option_count".
7. SKIP IMAGE-DEPENDENT QUESTIONS: If a question or option contains or requires a figure, diagram, graph, chart, map, circuit, or illustration, DO NOT include it in "questions". Record it in "skipped_items" with reason "has_image".
8. STRIP QUESTION NUMBERS & CHOICE PREFIXES:
   - Put original question number (Arabic digits) in "source_question_number".
   - Remove leading question number ("1.", "1)", "ข้อ 1.", "ข้อที่ ๑", "(1)") from "question_text", keeping any numbers that belong to the stem content itself.
   - Remove leading option prefixes ("ก.", "ข.", "ค.", "ง.", "จ.", "A.", "B.", "C.", "D.", "E.", "1.", "(ก)") from every item in "options".
9. PLAIN-TEXT MATH & TEXT TABLES ONLY: Convert math formulas and text-based tables into clean Unicode plain text (², ³, ×, ÷, √, ≤, ≥, ≠, π, °). NEVER output raw LaTeX (\\frac, \\sqrt, $$, $) or Markdown pipe tables.
10. BOUNDARY CONTINUITY: If the very last question on the last page is cut off mid-question or missing its options because it continues on the next page, DO NOT emit a broken question — put the unfinished trailing text in "incomplete_tail_text".

Return ONLY valid JSON matching the exact schema, with no Markdown fences or extra prose.`

// ============================================================================
// STAGE 3A SYSTEM INSTRUCTION (FLASH LITE FAST SCREENING — NEVER OVERRIDE DIRECTLY!)
// ============================================================================
export const STAGE3A_SCREENING_SYSTEM_INSTRUCTION = `You are a High-Throughput Exam Screening Engine (STAGE 3A) verifying multiple-choice questions that ALREADY have an official answer from the book ("book_answer_index").

STRICT STAGE 3A RULES:
1. For EVERY question in this batch (20-30 items), check whether "book_answer_index" is reasonable and consistent with the question and options.
2. DO NOT OVERRIDE THE BOOK ANSWER YOURSELF IN STAGE 3A:
   - If the book's answer is correct, defensible, or standard -> set "verdict": "book_verified" and write a clear, concise Thai "explanation" (1-3 sentences, Unicode plain text, NO raw LaTeX).
   - If you strongly suspect the book's answer is objectively wrong, mathematically incorrect, directly contradicts law/facts, or looks like a shifted/typo key -> set "verdict": "escalate_suspect" and provide a brief "suspect_note" explaining your concern so a deeper Stage 3B model can make the final decision!
3. Be conservative: do NOT escalate minor stylistic preferences or ambiguous wording. Escalate ONLY genuine suspected errors.

Return ONLY valid JSON: {"results":[{"id":"...","verdict":"book_verified หรือ escalate_suspect","explanation":"...","suspect_note":""}]} with no Markdown fences.`

// ============================================================================
// STAGE 3B SYSTEM INSTRUCTION (FLASH STANDARD DEEP ARBITRATION & SOLVING)
// ============================================================================
export const STAGE3B_DEEP_SYSTEM_INSTRUCTION = `You are a Senior Subject-Matter Expert & Final Exam Arbitrator (STAGE 3B — Deep Verification).

Each item in this batch has a "task":
1. task = "arbitrate_suspect" (has "book_answer_index" that Stage 3A flagged as possibly wrong):
   - Carefully analyze the question, all options, and the book's answer from first principles.
   - STRICT OVERRIDE RULE:
     * Keep "verdict": "book_verified" and "final_answer_index": book_answer_index whenever the book answer is actually defensible, acceptable under Thai exam conventions, or in a subjective gray area.
     * Set "verdict": "ai_overridden" ONLY when there is CLEAR, OBJECTIVE, PROVABLE PROOF that the book's answer is wrong (calculation error, direct contradiction of law/statute/science/grammar, obvious typo or shifted answer key).
   - If "ai_overridden": "final_answer_index" MUST differ from "book_answer_index", and "override_reason" MUST clearly explain BOTH points in Thai:
     (1) ทำไมเฉลยจากหนังสือจึงผิดหรือไม่สมเหตุสมผลอย่างชัดเจน
     (2) ทำไมคำตอบใหม่ที่ AI เลือกจึงถูกต้องกว่า
   - Always write a concise Thai "explanation" (1-3 sentences, Unicode plain text, NO raw LaTeX) explaining why "final_answer_index" is correct.
2. task = "solve_unanswered" (no answer key existed anywhere in the book):
   - Solve accurately from first principles, set "verdict": "ai_solved", "final_answer_index": <best 0-based index>, "override_reason": "", and write a concise Thai "explanation" (1-3 sentences, Unicode plain text, NO raw LaTeX).

Return ONLY valid JSON: {"results":[{"id":"...","verdict":"book_verified หรือ ai_overridden หรือ ai_solved","final_answer_index":0,"explanation":"...","override_reason":""}]} with no Markdown fences.`

export function buildPass1ChunkPrompt({
  categoryName,
  fileName,
  pageEntries,
  pendingTailText,
  pendingTailPage,
  lastSection
}) {
  const pageNumbers = pageEntries.map((p) => p.pageNumber)
  const minPage = Math.min(...pageNumbers)
  const maxPage = Math.max(...pageNumbers)

  const headerLines = [
    `Subject Category: "${categoryName || 'ทั่วไป'}"`,
    `Source File: "${fileName}"`,
    `Current Batch Pages: ${minPage} to ${maxPage} (${pageEntries.length} page(s))`,
    `Current Active Section/Set Heading from Previous Pages: "${lastSection || ''}"`,
    '',
    'REMINDER: THIS IS PASS 1 (EXTRACT-ONLY). DO NOT GUESS OR SOLVE ANSWERS THAT ARE NOT PRINTED ON THESE PAGES.',
    'Return ONLY a single JSON object with this exact structure:',
    `{
  "last_detected_section": "ชื่อบทหรือชุดข้อสอบล่าสุดที่พบในรอบนี้ (หากไม่มีใหม่ให้คงค่าเดิม)",
  "questions": [
    {
      "source_question_number": "1",
      "source_section": "ชุดที่ 1 หรือชื่อบท (ถ้าไม่มีใส่ค่าว่าง)",
      "source_page": ${minPage},
      "question_text": "ข้อความโจทย์ตามต้นฉบับ (ตัดเลขข้อหน้าโจทย์แล้ว, สูตรเป็น Unicode Plain Text)",
      "options": ["ตัวเลือก 1 (ตัด ก./A./1. แล้ว)", "ตัวเลือก 2", "ตัวเลือก 3", "ตัวเลือก 4"],
      "has_inline_answer": false,
      "book_answer": null,
      "book_answer_label": "",
      "book_explanation": ""
    }
  ],
  "answer_keys": [
    {
      "source_section": "ชุดที่ 1 หรือชื่อบท (ถ้ามี)",
      "source_question_number": "1",
      "answer_label": "ก",
      "answer_index": 0,
      "book_explanation": "คำอธิบายเฉลยจากหนังสือถ้ามี",
      "source_page": ${minPage}
    }
  ],
  "skipped_items": [
    {
      "source_question_number": "5",
      "source_page": ${minPage},
      "reason": "has_image หรือ non_mcq หรือ invalid_option_count",
      "detail": "อธิบายเหตุผลสั้นๆ"
    }
  ],
  "skipped_pages": [
    {
      "page": ${minPage},
      "reason": "cover หรือ preface หรือ toc หรือ instructions หรือ blank หรือ non_exam_content",
      "detail": "เหตุผลสั้นๆ"
    }
  ],
  "incomplete_tail_text": ""
}`
  ]

  if (pendingTailText) {
    headerLines.push(
      '',
      `[CARRY-OVER FROM PREVIOUS PAGE ${pendingTailPage || minPage - 1} — COMBINE WITH PAGE ${minPage} IF IT CONTINUES THE SAME QUESTION]:`,
      pendingTailText
    )
  }

  const parts = [{ text: headerLines.join('\n') }]

  for (const entry of pageEntries) {
    if (entry.mode === 'text') {
      parts.push({
        text: `\n===== [PAGE ${entry.pageNumber} | MODE: TEXT] =====\n${entry.text}`
      })
    } else if (entry.mode === 'vision' && entry.image?.base64Data) {
      parts.push({
        text: `\n===== [PAGE ${entry.pageNumber} | MODE: SCANNED IMAGE — READ CAREFULLY WITH VISION] =====${
          entry.text ? `\n(Partial OCR hint: ${entry.text.slice(0, 400)})` : ''
        }`
      })
      parts.push({
        inlineData: {
          mimeType: entry.image.mimeType || 'image/jpeg',
          data: entry.image.base64Data
        }
      })
    }
  }

  return parts
}

export function buildStage3APrompt(payloadItems) {
  return `ตรวจสอบคัดกรองเฉลยจากหนังสือจำนวน ${payloadItems.length} ข้อต่อไปนี้ (Stage 3A — ห้ามแก้เฉลยเอง):
- หากเฉลยหนังสือถูกต้องสมเหตุสมผล: ตั้ง verdict = "book_verified" และเขียนคำอธิบายภาษาไทยกระชับ 1–3 ประโยค (Unicode Plain Text ห้ามใช้ LaTeX ดิบ)
- หากสงสัยว่าเฉลยหนังสือผิดชัดเจน/คำนวณผิด/ขัดข้อเท็จจริง: ตั้ง verdict = "escalate_suspect" พร้อมระบุ suspect_note สั้นๆ เพื่อส่งเข้าด่าน Stage 3B ฟันธง

คืนค่า JSON เท่านั้น:
{"results":[{"id":"...","verdict":"book_verified หรือ escalate_suspect","explanation":"...","suspect_note":""}]}

รายการข้อสอบ:
${JSON.stringify(payloadItems)}`
}

export function buildStage3BPrompt(payloadItems) {
  return `ดำเนินการตรวจสอบฟันธงและเฉลยข้อสอบจำนวน ${payloadItems.length} ข้อต่อไปนี้ (Stage 3B):
- สำหรับ task="arbitrate_suspect": พิสูจน์อย่างเข้มงวด เลือก "ai_overridden" เฉพาะเมื่อพิสูจน์ได้ชัดเจนว่าเฉลยหนังสือผิดจริง พร้อมระบุ override_reason ครบ 2 ประเด็น (ทำไมเฉลยหนังสือผิด + ทำไมเฉลย AI ถูก) มิฉะนั้นให้คง "book_verified"
- สำหรับ task="solve_unanswered": วิเคราะห์เฉลยคำตอบที่ถูกต้องที่สุด ตั้ง verdict="ai_solved"
- เขียน explanation ภาษาไทยกระชับ 1–3 ประโยค (Unicode Plain Text ห้ามใช้ LaTeX ดิบ) ให้ครบทุกข้อ

คืนค่า JSON เท่านั้น:
{"results":[{"id":"...","verdict":"book_verified หรือ ai_overridden หรือ ai_solved","final_answer_index":0,"explanation":"...","override_reason":""}]}

รายการข้อสอบ:
${JSON.stringify(payloadItems)}`
}
