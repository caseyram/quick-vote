-- Allow ending a session by admin_token (proof of ownership)
CREATE OR REPLACE FUNCTION end_session_by_admin_token(p_admin_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sessions SET status = 'ended' WHERE admin_token = p_admin_token::uuid;
END;
$$;
