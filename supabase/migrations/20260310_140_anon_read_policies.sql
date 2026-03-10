-- ============================================
-- Fix: Allow anon role to read participant-facing tables
-- ============================================
-- All SELECT policies were scoped to "authenticated" only.
-- Participants use the anon key and were blocked from reading
-- sessions, batches, questions, votes, and session_items via REST.
-- Broadcasts bypass RLS which masked this bug (connected participants
-- saw data, but fresh page loads / refreshes returned empty).
-- ============================================

-- Sessions: participants need to read to join by session_id
DROP POLICY IF EXISTS "Anyone can read sessions" ON sessions;
CREATE POLICY "Anyone can read sessions"
  ON sessions FOR SELECT TO anon, authenticated
  USING (true);

-- Batches: participants need to read active batch on load/refresh
DROP POLICY IF EXISTS "Anyone can read batches" ON batches;
CREATE POLICY "Anyone can read batches"
  ON batches FOR SELECT TO anon, authenticated
  USING (true);

-- Questions: participants need to read questions in active batch
DROP POLICY IF EXISTS "Anyone can read questions" ON questions;
CREATE POLICY "Anyone can read questions"
  ON questions FOR SELECT TO anon, authenticated
  USING (true);

-- Votes: participants need to read to check hasVoted and view results
DROP POLICY IF EXISTS "Anyone can read votes" ON votes;
CREATE POLICY "Anyone can read votes"
  ON votes FOR SELECT TO anon, authenticated
  USING (true);

-- Session items: participants need to read sequence items
DROP POLICY IF EXISTS "Anyone can read session_items" ON session_items;
CREATE POLICY "Anyone can read session_items"
  ON session_items FOR SELECT TO anon, authenticated
  USING (true);
