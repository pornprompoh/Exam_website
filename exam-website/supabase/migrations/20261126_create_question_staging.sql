-- ============================================================================
-- Migration: Dedicated Question Staging & Extraction Checkpoint Tables
-- Purpose:
--   1. Isolate AI-extracted draft questions from `public.questions` so students
--      in `ExamSession.jsx` can NEVER see unreviewed drafts.
--   2. Persist extraction checkpoints for large 300+ page PDFs (resume / skip
--      already-processed pages safely across refreshes or rate-limit pauses).
--   3. Restrict all Staging & Checkpoint access strictly to Admins via RLS.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Staging Table: public.question_staging_items
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_staging_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,

  -- Core question fields (aligned 100% with public.questions)
  question_text text NOT NULL,
  options jsonb NOT NULL,
  correct_option integer NOT NULL,
  explanation text,
  is_options_randomized boolean NOT NULL DEFAULT true,
  image_url text,
  explanation_image_url text,

  -- Extraction & Traceability Metadata
  source_file_fingerprint text NOT NULL,
  source_file_name text NOT NULL,
  source_question_number text,
  source_section text,
  source_page integer,
  has_source_answer boolean NOT NULL DEFAULT false,
  is_ai_solved boolean NOT NULL DEFAULT false,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Strict 4-5 choice MCQ integrity constraints
  CONSTRAINT question_staging_options_is_array CHECK (
    jsonb_typeof(options) = 'array'
    AND jsonb_array_length(options) BETWEEN 4 AND 5
  ),
  CONSTRAINT question_staging_correct_option_valid CHECK (
    correct_option >= 0
    AND correct_option < jsonb_array_length(options)
  )
);

-- Indexes for fast category review, answer-key mapping, and exact-match dedup
CREATE INDEX IF NOT EXISTS idx_question_staging_category_created
  ON public.question_staging_items (category_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_question_staging_category_fingerprint
  ON public.question_staging_items (category_id, source_file_fingerprint);

CREATE INDEX IF NOT EXISTS idx_question_staging_answer_key_lookup
  ON public.question_staging_items (category_id, source_file_fingerprint, source_question_number);

-- ----------------------------------------------------------------------------
-- 2. Checkpoint Table: public.question_extraction_checkpoints
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_extraction_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  source_file_fingerprint text NOT NULL,
  source_file_name text NOT NULL,
  total_pages integer NOT NULL DEFAULT 1,
  last_completed_page integer NOT NULL DEFAULT 0,
  pending_tail_text text,
  pending_tail_page integer,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'paused', 'completed', 'error')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_question_extraction_checkpoint UNIQUE (category_id, source_file_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_question_extraction_checkpoints_category
  ON public.question_extraction_checkpoints (category_id, updated_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Auto-update `updated_at` Trigger Function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_question_staging_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_question_staging_items_updated_at ON public.question_staging_items;
CREATE TRIGGER trg_question_staging_items_updated_at
  BEFORE UPDATE ON public.question_staging_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_question_staging_updated_at();

DROP TRIGGER IF EXISTS trg_question_extraction_checkpoints_updated_at ON public.question_extraction_checkpoints;
CREATE TRIGGER trg_question_extraction_checkpoints_updated_at
  BEFORE UPDATE ON public.question_extraction_checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION public.set_question_staging_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Row Level Security (RLS): Strictly Admin-Only
-- ----------------------------------------------------------------------------
ALTER TABLE public.question_staging_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_extraction_checkpoints ENABLE ROW LEVEL SECURITY;

-- Helper check: current authenticated user has role = 'admin' in public.profiles
DROP POLICY IF EXISTS "Admins can select staging items" ON public.question_staging_items;
CREATE POLICY "Admins can select staging items"
  ON public.question_staging_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert staging items" ON public.question_staging_items;
CREATE POLICY "Admins can insert staging items"
  ON public.question_staging_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update staging items" ON public.question_staging_items;
CREATE POLICY "Admins can update staging items"
  ON public.question_staging_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete staging items" ON public.question_staging_items;
CREATE POLICY "Admins can delete staging items"
  ON public.question_staging_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Checkpoints RLS (Strictly Admin-Only)
DROP POLICY IF EXISTS "Admins can select extraction checkpoints" ON public.question_extraction_checkpoints;
CREATE POLICY "Admins can select extraction checkpoints"
  ON public.question_extraction_checkpoints
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert extraction checkpoints" ON public.question_extraction_checkpoints;
CREATE POLICY "Admins can insert extraction checkpoints"
  ON public.question_extraction_checkpoints
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update extraction checkpoints" ON public.question_extraction_checkpoints;
CREATE POLICY "Admins can update extraction checkpoints"
  ON public.question_extraction_checkpoints
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete extraction checkpoints" ON public.question_extraction_checkpoints;
CREATE POLICY "Admins can delete extraction checkpoints"
  ON public.question_extraction_checkpoints
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Optional Performance Index on main questions table for category-scoped exact dedup
CREATE INDEX IF NOT EXISTS idx_questions_category_id
  ON public.questions (category_id);
