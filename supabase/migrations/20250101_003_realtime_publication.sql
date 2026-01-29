-- Realtime Publication Setup for QuickVote
--
-- Adds the votes and questions tables to the supabase_realtime publication
-- so Postgres Changes events are emitted when rows are inserted/updated/deleted.

ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE questions;
