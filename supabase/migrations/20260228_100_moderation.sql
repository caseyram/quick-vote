-- Migration: Add response moderation columns to votes table
-- Facilitators can hide inappropriate/sensitive responses during live sessions.
-- Hidden responses are not shown in the presentation view but remain visible
-- (greyed out) in the admin view and auditable in the session review.

alter table votes
  add column if not exists moderated_at timestamptz default null,
  add column if not exists moderated_by text default null;

-- Index to efficiently query moderated votes for a session review
create index if not exists idx_votes_moderated_at
  on votes (session_id, moderated_at)
  where moderated_at is not null;
