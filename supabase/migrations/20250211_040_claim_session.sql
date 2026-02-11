-- ============================================
-- QuickVote: Session ownership reclaim
-- ============================================
-- When anonymous auth identity changes (browser data cleared, different device),
-- the admin_token proves session ownership. This SECURITY DEFINER function
-- updates created_by to the current auth.uid() so RLS checks pass.

CREATE OR REPLACE FUNCTION claim_session(p_admin_token TEXT)
RETURNS void AS $$
BEGIN
  UPDATE sessions SET created_by = auth.uid()
  WHERE admin_token = p_admin_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
