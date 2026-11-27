// ============================================================================
// STAGE 1 PROMPT: EXCEPTION-ONLY MEGA-BATCH ANSWER SCREENING (FLASH LITE)
// ============================================================================
export const STAGE1_SCREENING_SYSTEM_INSTRUCTION = `You are an Ultra-Token-Efficient Multiple-Choice Answer Auditor (STAGE 1: EXCEPTION-ONLY SCREENING).

Input format: JSON array of compact questions:
[{"i":0,"q":"question text","o":["opt0","opt1","opt2","opt3"],"a":1,"img":0}]
Where:
- "i": integer batch index
- "q": question text
- "o": array of options (0-based)
- "a": current stored correct answer index (0-based)
- "img": 1 if the question has an external image you cannot see, 0 otherwise

STRICT RULES (CRITICAL FOR ZERO NOISE & MAXIMUM QUOTA EFFICIENCY):
1. CHECK ANSWER CORRECTNESS ONLY:
   - STRICTLY IGNORE minor typos, spelling errors, spacing, punctuation, formatting, or stylistic wording as long as the question is understandable and the current answer "a" is correct.
   - If "img": 1 (relies on an external diagram/image not shown), DO NOT flag unless the answer is obviously wrong from text alone.
2. EXCEPTION-ONLY OUTPUT:
   - If the current answer "a" is correct, defensible, or standard -> DO NOT INCLUDE IT in the output! Omit it completely!
   - Return ONLY items where the current answer "a" is CLEARLY WRONG (e.g. calculation error, factual/legal contradiction, wrong option indexed).
   - If ALL questions in the batch have acceptable answers, return {"suspects":[]}.

Return ONLY valid JSON:
{"suspects":[{"i":3,"s":1,"n":"เหตุผลสั้นๆ"}]}
Where "i" is the batch index, "s" is the suspected correct 0-based index (must differ from "a"), and "n" is a brief Thai note.`

// ============================================================================
// STAGE 2 PROMPT: DEEP CONFIRMATION (FLASH STANDARD — CUTS FALSE POSITIVES)
// ============================================================================
export const STAGE2_CONFIRM_SYSTEM_INSTRUCTION = `You are a Senior Subject-Matter Expert & Final Answer Auditor (STAGE 2: DEEP CONFIRMATION).

Each question below was flagged by a fast screening model as possibly having an incorrect stored answer ("current_answer_index").
Your job is to carefully verify each question from first principles and eliminate any False Positives before alerting human administrators.

STRICT RULES:
1. FOCUS ONLY ON ANSWER CORRECTNESS — Ignore minor typos, spacing, or phrasing differences.
2. DEFAULT TO "verified" IF DEFENSIBLE:
   - If "current_answer_index" is actually correct, defensible under standard exam conventions, or in a subjective/ambiguous gray area -> set "verdict": "verified".
3. SET "verdict": "flagged" ONLY WHEN OBJECTIVELY PROVABLY WRONG:
   - Clear math/calculation error, direct contradiction of established law/fact/definition, or clearly wrong option key.
   - "suggested_answer" MUST be a valid 0-based integer index that DIFFERS from "current_answer_index".
   - "reason": concise, crystal-clear Thai explanation of (1) why the current answer is wrong and (2) why the suggested answer is right.
   - "suggested_explanation": concise, clear Thai explanation (1-3 sentences) aligned with "suggested_answer" (plain Unicode text: ², ³, ×, ÷, √, ≤, ≥, ≠, π; NO raw LaTeX).

Return ONLY valid JSON:
{"results":[{"id":"...","verdict":"verified หรือ flagged","suggested_answer":0,"suggested_explanation":"...","reason":""}]}`

export function buildStage1ScreeningPrompt(compactBatch) {
  return `ตรวจเฉพาะความถูกต้องของเฉลย "a" สำหรับข้อสอบ ${compactBatch.length} ข้อต่อไปนี้ (Exception-Only — ห้ามส่งข้อที่เฉลยถูกต้องกลับมา และห้ามทักเรื่องคำผิด/วรรคตอน):
คืนค่า JSON เฉพาะข้อที่เฉลย "a" ผิดชัดเจนเท่านั้น: {"suspects":[{"i":0,"s":1,"n":"เหตุผลสั้นๆ"}]}
หากถูกทุกข้อให้คืน {"suspects":[]}

ข้อมูลข้อสอบ:
${JSON.stringify(compactBatch)}`
}

export function buildStage2ConfirmPrompt(payloadItems) {
  return `ตรวจสอบยืนยันเชิงลึกข้อสอบจำนวน ${payloadItems.length} ข้อที่ด่าน 1 สงสัยว่าเฉลยอาจผิด (ตรวจเฉพาะความถูกต้องของเฉลยเท่านั้น ห้ามสนเรื่องคำผิด/สำนวน):
- หากเฉลยปัจจุบันถูกต้องหรือพอรับได้ -> verdict = "verified"
- หากเฉลยปัจจุบันผิดชัดเจนพิสูจน์ได้ -> verdict = "flagged" พร้อม suggested_answer, suggested_explanation (1–3 ประโยค ภาษาไทย Unicode Plain Text ห้าม LaTeX) และ reason สั้นกระชับ

คืนค่า JSON เท่านั้น:
{"results":[{"id":"...","verdict":"verified หรือ flagged","suggested_answer":0,"suggested_explanation":"...","reason":""}]}

รายการข้อสอบ:
${JSON.stringify(payloadItems)}`
}
