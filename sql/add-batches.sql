-- ============================================
-- QuickVote Phase 6: Batches Schema
-- ============================================
-- Adds support for grouping questions into batches.
-- Batches are runtime containers for activating questions together.

-- Batches table
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Batch',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index foreign key (PostgreSQL does NOT auto-index FKs)
CREATE INDEX idx_batches_session_id ON batches(session_id);

-- Add batch_id column to questions table
-- Nullable to preserve v1.0 unbatched questions
-- ON DELETE SET NULL: deleting batch unbatches questions (non-destructive)
ALTER TABLE questions
  ADD COLUMN batch_id UUID REFERENCES batches(id) ON DELETE SET NULL;

-- Index foreign key for query performance
CREATE INDEX idx_questions_batch_id ON questions(batch_id);

-- ============================================
-- RLS Policies for batches
-- ============================================

ALTER TABLE batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read batches"
  ON batches FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Session creator can insert batches"
  ON batches FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = batches.session_id
      AND sessions.created_by = (select auth.uid())
    )
  );

CREATE POLICY "Session creator can update batches"
  ON batches FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = batches.session_id
      AND sessions.created_by = (select auth.uid())
    )
  );

CREATE POLICY "Session creator can delete batches"
  ON batches FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = batches.session_id
      AND sessions.created_by = (select auth.uid())
    )
  );
