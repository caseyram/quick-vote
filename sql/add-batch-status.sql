-- Add status column to batches table for activation state management
-- Status transitions: pending -> active -> closed (one-time activation only)
-- A batch can only be activated once - it cannot return to pending state

ALTER TABLE batches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Add CHECK constraint to enforce valid status values
-- This ensures only 'pending', 'active', or 'closed' can be stored
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_status_check;
ALTER TABLE batches ADD CONSTRAINT batches_status_check
  CHECK (status IN ('pending', 'active', 'closed'));

-- Note: Application logic must enforce transition rules:
-- - pending -> active (activation)
-- - active -> closed (completion)
-- - No other transitions allowed (no re-activation)
