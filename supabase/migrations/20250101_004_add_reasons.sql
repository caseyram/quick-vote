-- Add reasons feature to sessions and votes
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS reasons_enabled boolean DEFAULT false;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS reason text;
