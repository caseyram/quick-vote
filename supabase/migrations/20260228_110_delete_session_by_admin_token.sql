-- Allow deleting a session by admin_token (proof of ownership)
-- SECURITY DEFINER bypasses RLS
CREATE OR REPLACE FUNCTION delete_session_by_admin_token(p_admin_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM sessions WHERE admin_token = p_admin_token;
END;
$$;
