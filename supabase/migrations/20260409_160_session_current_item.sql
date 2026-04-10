-- ============================================
-- Add durable navigation pointer to sessions
-- ============================================
-- Previously, the currently-active slide or batch was tracked only in admin
-- memory and propagated via ephemeral Supabase broadcasts. If the presenter
-- missed a broadcast (common on Wi-Fi), there was no recovery path.
--
-- current_session_item_id now serves as the authoritative "what is on screen"
-- pointer. Admin writes it on every navigation action; presenters subscribe
-- to Postgres Changes on the sessions row and reconcile from it on reconnect.

ALTER TABLE sessions
  ADD COLUMN current_session_item_id UUID
    REFERENCES session_items(id) ON DELETE SET NULL;

CREATE INDEX idx_sessions_current_session_item_id
  ON sessions(current_session_item_id);
