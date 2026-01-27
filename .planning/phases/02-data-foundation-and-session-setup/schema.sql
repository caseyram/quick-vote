-- ============================================
-- QuickVote Phase 2: Database Schema
-- ============================================

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  admin_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Untitled Session',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'lobby', 'active', 'ended')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_session_id ON sessions(session_id);
CREATE INDEX idx_sessions_admin_token ON sessions(admin_token);

-- Questions table
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('agree_disagree', 'multiple_choice')),
  options JSONB,
  position INTEGER NOT NULL DEFAULT 0,
  anonymous BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'closed', 'revealed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_questions_session_id ON questions(session_id);

-- Votes table (schema only -- used in Phase 3)
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  participant_id UUID NOT NULL,
  value TEXT NOT NULL,
  display_name TEXT,
  locked_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(question_id, participant_id)
);

CREATE INDEX idx_votes_session_id ON votes(session_id);
CREATE INDEX idx_votes_question_id ON votes(question_id);

-- ============================================
-- RLS Policies
-- ============================================

-- Sessions RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can create sessions"
  ON sessions FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read sessions"
  ON sessions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Creator can update own sessions"
  ON sessions FOR UPDATE TO authenticated
  USING ((select auth.uid()) = created_by);

CREATE POLICY "Creator can delete own sessions"
  ON sessions FOR DELETE TO authenticated
  USING ((select auth.uid()) = created_by);

-- Questions RLS
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read questions"
  ON questions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Session creator can insert questions"
  ON questions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = questions.session_id
      AND sessions.created_by = (select auth.uid())
    )
  );

CREATE POLICY "Session creator can update questions"
  ON questions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = questions.session_id
      AND sessions.created_by = (select auth.uid())
    )
  );

CREATE POLICY "Session creator can delete questions"
  ON questions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.session_id = questions.session_id
      AND sessions.created_by = (select auth.uid())
    )
  );

-- Votes RLS
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert votes"
  ON votes FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = participant_id);

CREATE POLICY "Anyone can read votes"
  ON votes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own votes"
  ON votes FOR UPDATE TO authenticated
  USING ((select auth.uid()) = participant_id);
