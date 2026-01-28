-- Enable moddatetime extension for auto-updating timestamps
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- Auto-update updated_at on vote changes (upsert conflict updates)
CREATE TRIGGER handle_votes_updated_at
  BEFORE UPDATE ON votes
  FOR EACH ROW
  EXECUTE PROCEDURE moddatetime(updated_at);
