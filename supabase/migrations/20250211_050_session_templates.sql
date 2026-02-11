-- ============================================
-- QuickVote Phase 20: Session Templates
-- ============================================

-- Session templates table for saving and loading session structures
CREATE TABLE session_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  blueprint JSONB NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at timestamp (inline PL/pgSQL - moddatetime extension not available)
CREATE OR REPLACE FUNCTION update_session_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_session_templates_updated_at
  BEFORE UPDATE ON session_templates
  FOR EACH ROW
  EXECUTE PROCEDURE update_session_templates_updated_at();

-- ============================================
-- RLS Policies
-- ============================================

-- Enable RLS on session_templates
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

-- Session templates accessible to all authenticated users
CREATE POLICY "Anyone can read session templates"
  ON session_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create session templates"
  ON session_templates FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update session templates"
  ON session_templates FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete session templates"
  ON session_templates FOR DELETE TO authenticated
  USING (true);
