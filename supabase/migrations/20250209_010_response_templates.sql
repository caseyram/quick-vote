-- ============================================
-- QuickVote Phase 11: Response Templates
-- ============================================

-- Response templates table for global reusable response options
CREATE TABLE response_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  options JSONB NOT NULL CHECK (jsonb_array_length(options) >= 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GIN index for efficient JSONB operations
CREATE INDEX idx_response_templates_options ON response_templates USING GIN (options);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_response_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_response_templates_updated_at
  BEFORE UPDATE ON response_templates
  FOR EACH ROW
  EXECUTE PROCEDURE update_response_templates_updated_at();

-- Add template_id foreign key to questions table
ALTER TABLE questions ADD COLUMN template_id UUID REFERENCES response_templates(id) ON DELETE SET NULL;

-- Index for efficient template usage lookups
CREATE INDEX idx_questions_template_id ON questions(template_id);

-- ============================================
-- RLS Policies
-- ============================================

-- Enable RLS on response_templates
ALTER TABLE response_templates ENABLE ROW LEVEL SECURITY;

-- Global templates accessible to all authenticated users
CREATE POLICY "Anyone can read templates"
  ON response_templates FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create templates"
  ON response_templates FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update templates"
  ON response_templates FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete templates"
  ON response_templates FOR DELETE TO authenticated
  USING (true);

-- ============================================
-- Realtime Publication
-- ============================================

-- Add response_templates to realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE response_templates;
