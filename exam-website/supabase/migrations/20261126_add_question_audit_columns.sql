-- ============================================================================
-- Migration: Lightweight AI Answer Auditor Columns on `public.questions`
-- Design Goals:
--   1. NO separate Audit History table (keeps database lightweight and fast).
--   2. Zero impact on existing columns or student `ExamSession.jsx` queries.
--   3. Composite & partial indexes for instant filtering on 1,000+ questions.
--   4. Temporary suggestion columns (`audit_suggested_*`, `audit_reason`) are
--      auto-cleared to NULL immediately once an Admin resolves a flagged item.
-- ============================================================================

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS audit_status text NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS audit_suggested_answer integer,
  ADD COLUMN IF NOT EXISTS audit_suggested_explanation text,
  ADD COLUMN IF NOT EXISTS audit_reason text,
  ADD COLUMN IF NOT EXISTS audit_model text,
  ADD COLUMN IF NOT EXISTS audit_checked_at timestamptz;

ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_audit_status_valid;

ALTER TABLE public.questions
  ADD CONSTRAINT questions_audit_status_valid CHECK (
    audit_status IN ('unchecked', 'verified', 'flagged')
  );

-- Composite index for fast category-scoped `unchecked` and `flagged` lookups
CREATE INDEX IF NOT EXISTS idx_questions_category_audit_status
  ON public.questions (category_id, audit_status);

-- Partial index for ultra-fast Flagged Review badge counts & list queries
CREATE INDEX IF NOT EXISTS idx_questions_audit_flagged
  ON public.questions (category_id, audit_checked_at DESC)
  WHERE audit_status = 'flagged';
