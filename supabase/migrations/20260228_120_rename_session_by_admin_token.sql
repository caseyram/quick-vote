-- Allow renaming a session by admin_token (proof of ownership)
-- SECURITY DEFINER bypasses RLS
CREATE OR REPLACE FUNCTION rename_session_by_admin_token(p_admin_token TEXT, p_title TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sessions SET title = p_title WHERE admin_token = p_admin_token;
END;
$$;
