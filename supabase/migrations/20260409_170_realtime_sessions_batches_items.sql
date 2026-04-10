-- ============================================
-- Expand the realtime publication to include navigation tables
-- ============================================
-- Only `votes` and `questions` were in the publication (003_realtime_publication).
-- The presenter needs Postgres CDC on sessions (current_session_item_id changes),
-- batches (status changes), and session_items (Go Live creates new items).

ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE batches;
ALTER PUBLICATION supabase_realtime ADD TABLE session_items;
