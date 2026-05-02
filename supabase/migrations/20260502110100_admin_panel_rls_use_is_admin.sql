-- Update admin panel RLS policies from app_metadata check to profiles.is_admin.
-- Migration 20260408_admin_panel.sql created these policies using
--   auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
-- which is Supabase-specific and incompatible with substrate-agnostic admin grants.
-- Now that profiles.is_admin is the authoritative admin source (20260502110000),
-- these four policies must align.
--
-- The subquery is intentionally SECURITY DEFINER via app.current_user_id() —
-- the profiles table read runs as the function owner, bypassing any RLS on profiles
-- that might block the lookup.

DROP POLICY IF EXISTS "Admins can view contacts" ON contacts;
CREATE POLICY "Admins can view contacts"
  ON contacts FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = app.current_user_id() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can create invitations" ON invitations;
CREATE POLICY "Admins can create invitations"
  ON invitations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = app.current_user_id() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Admins can read invitations" ON invitations;
CREATE POLICY "Admins can read invitations"
  ON invitations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = app.current_user_id() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Admins read all feedback" ON feedback;
CREATE POLICY "Admins read all feedback"
  ON feedback FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = app.current_user_id() AND is_admin = true)
  );
