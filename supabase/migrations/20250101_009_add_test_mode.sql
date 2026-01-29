-- Add test_mode setting to sessions for enabling fake vote generation
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS test_mode boolean DEFAULT false;
