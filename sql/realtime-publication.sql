-- Realtime Publication Setup for QuickVote
--
-- Run these statements in the Supabase SQL Editor before testing
-- Phase 4 realtime features. They add the votes and questions tables
-- to the supabase_realtime publication so Postgres Changes events
-- are emitted when rows are inserted/updated/deleted.
--
-- Run these one at a time; skip if already added (will error with
-- "relation already exists in publication" if previously executed).

ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE questions;
