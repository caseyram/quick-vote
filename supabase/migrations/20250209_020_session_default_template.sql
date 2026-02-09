-- ============================================
-- QuickVote Phase 12: Session Default Template
-- ============================================

-- Add default_template_id foreign key to sessions table
-- This allows each session to have a default template that auto-applies to new multiple choice questions
ALTER TABLE sessions ADD COLUMN default_template_id UUID REFERENCES response_templates(id) ON DELETE SET NULL;

-- Index for efficient template default lookups
CREATE INDEX idx_sessions_default_template_id ON sessions(default_template_id);

COMMENT ON COLUMN sessions.default_template_id IS 'Session-level default template for new multiple choice questions. Optional, can be overridden per question.';
