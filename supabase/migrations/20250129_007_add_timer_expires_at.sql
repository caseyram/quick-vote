-- Add timer_expires_at column to sessions table
-- This stores the absolute expiration timestamp for active timers,
-- allowing participants to restore countdown on reconnection.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS timer_expires_at TIMESTAMPTZ DEFAULT NULL;
