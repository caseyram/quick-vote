-- Add teams column to sessions table
ALTER TABLE sessions ADD COLUMN teams JSONB DEFAULT '[]'::jsonb NOT NULL;

-- Add constraint to limit max 5 teams
ALTER TABLE sessions ADD CONSTRAINT max_5_teams CHECK (jsonb_array_length(teams) <= 5);

-- Add team_id column to votes table
ALTER TABLE votes ADD COLUMN team_id TEXT NULL;

-- Create index on team_id for efficient filtering
CREATE INDEX idx_votes_team_id ON votes(team_id);

-- Create composite index for session+team queries
CREATE INDEX idx_votes_session_team ON votes(session_id, team_id);

-- Add comments for documentation
COMMENT ON COLUMN sessions.teams IS 'Array of team names (max 5). Participants can join a team during lobby phase.';
COMMENT ON COLUMN votes.team_id IS 'Team identifier for the voter. NULL if participant has no team.';
