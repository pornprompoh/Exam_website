-- ============================================================================
-- Migration: Upgrade Staging & Checkpoints for 3-Pass Deferred Answer Pipeline
-- Purpose:
--   1. Add granular answer lifecycle fields to `public.question_staging_items`:
--      - `source_section` (ensured if missing)
--      - `answer_status`: 'pending_answer' | 'book_verified' | 'ai_overridden' | 'ai_solved'
--      - `book_answer`: original 0-based choice index from the book (never overwritten)
--      - `book_explanation`: original explanation from the book if present
--      - `override_reason`: analytical comparison explaining why AI overrode book_answer
--   2. Allow `correct_option` to be NULL while `answer_status = 'pending_answer'`
--      (Pass 1 Extract-Only never forces AI to guess answers mid-file).
--   3. Upgrade `public.question_extraction_checkpoints` to persist full-file
--      `answer_key_pool`, `current_pass`, `last_section`, and Pass 3 progress
--      across Pause / Resume cycles.
--   4. Zero impact on `public.questions` or student `ExamSession.jsx`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Upgrade public.question_staging_items
-- ----------------------------------------------------------------------------
ALTER TABLE public.question_staging_items
  ADD COLUMN IF NOT EXISTS source_section text,
  ADD COLUMN IF NOT EXISTS answer_status text NOT NULL DEFAULT 'pending_answer',
  ADD COLUMN IF NOT EXISTS book_answer integer,
  ADD COLUMN IF NOT EXISTS book_explanation text,
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS verified_by_model text;

-- Allow NULL correct_option during Pass 1 ('pending_answer') before Pass 2/3 resolves it
ALTER TABLE public.question_staging_items
  ALTER COLUMN correct_option DROP NOT NULL;

-- Backfill pre-existing rows created before 3-Pass migration
UPDATE public.question_staging_items
SET
  book_answer = CASE
    WHEN has_source_answer = true AND book_answer IS NULL THEN correct_option
    ELSE book_answer
  END,
  answer_status = CASE
    WHEN answer_status = 'pending_answer' AND is_ai_solved = true AND correct_option IS NOT NULL THEN 'ai_solved'
    WHEN answer_status = 'pending_answer' AND has_source_answer = true AND correct_option IS NOT NULL THEN 'book_verified'
    ELSE answer_status
  END
WHERE answer_status = 'pending_answer'
  AND (is_ai_solved = true OR has_source_answer = true);

-- Replace constraints cleanly
ALTER TABLE public.question_staging_items
  DROP CONSTRAINT IF EXISTS question_staging_correct_option_valid;

ALTER TABLE public.question_staging_items
  DROP CONSTRAINT IF EXISTS question_staging_answer_status_valid;

ALTER TABLE public.question_staging_items
  DROP CONSTRAINT IF EXISTS question_staging_book_answer_valid;

ALTER TABLE public.question_staging_items
  ADD CONSTRAINT question_staging_answer_status_valid CHECK (
    answer_status IN ('pending_answer', 'book_verified', 'ai_overridden', 'ai_solved')
  );

ALTER TABLE public.question_staging_items
  ADD CONSTRAINT question_staging_book_answer_valid CHECK (
    book_answer IS NULL
    OR (book_answer >= 0 AND book_answer < jsonb_array_length(options))
  );

ALTER TABLE public.question_staging_items
  ADD CONSTRAINT question_staging_correct_option_valid CHECK (
    (
      answer_status = 'pending_answer'
      AND (
        correct_option IS NULL
        OR (correct_option >= 0 AND correct_option < jsonb_array_length(options))
      )
    )
    OR
    (
      answer_status <> 'pending_answer'
      AND correct_option IS NOT NULL
      AND correct_option >= 0
      AND correct_option < jsonb_array_length(options)
    )
  );

-- Indexes for Pass 2 matching, Pass 3 pending batch fetch, and UI status filters
CREATE INDEX IF NOT EXISTS idx_question_staging_answer_status
  ON public.question_staging_items (category_id, answer_status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_question_staging_section_qnum
  ON public.question_staging_items (category_id, source_file_fingerprint, source_section, source_question_number);

-- ----------------------------------------------------------------------------
-- 2. Upgrade public.question_extraction_checkpoints
-- ----------------------------------------------------------------------------
ALTER TABLE public.question_extraction_checkpoints
  ADD COLUMN IF NOT EXISTS current_pass integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_section text,
  ADD COLUMN IF NOT EXISTS answer_key_pool jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS escalation_queue jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pass3_processed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pass3_total_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.question_extraction_checkpoints
  DROP CONSTRAINT IF EXISTS question_extraction_checkpoints_current_pass_valid;

ALTER TABLE public.question_extraction_checkpoints
  ADD CONSTRAINT question_extraction_checkpoints_current_pass_valid CHECK (
    current_pass IN (1, 2, 3)
  );
