-- Add archive support for session templates
ALTER TABLE session_templates
  ADD COLUMN archived BOOLEAN NOT NULL DEFAULT false;
