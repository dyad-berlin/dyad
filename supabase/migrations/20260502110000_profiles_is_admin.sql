-- Move admin role from auth.users.app_metadata (Supabase-specific) to
-- profiles.is_admin (application-owned). Admin status now lives on the
-- application identity rather than the auth substrate — it survives a
-- provider swap.
--
-- Security model:
--   - Only service_role can write is_admin (not in the authenticated UPDATE grant)
--   - Authenticated users can read is_admin (added to SELECT grant)
--   - INSERT is table-level; the INSERT RLS policy WITH CHECK now enforces is_admin = false
--     so authenticated users cannot self-elevate via PostgREST INSERT
--   - Default false; explicit grant required for every admin

ALTER TABLE profiles
  ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;

-- Extend the column-level SELECT grant to include is_admin.
GRANT SELECT (is_admin) ON profiles TO authenticated;

-- Harden the INSERT RLS policy: require is_admin = false on all authenticated inserts.
-- Prevents privilege escalation via PostgREST: an authenticated user with no profile row
-- cannot POST {"id": "...", "is_admin": true} to elevate themselves.
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (app.current_user_id() = id AND is_admin = false);

-- Signal PostgREST to reload its schema cache so the new column/grant are visible.
-- supabase db push triggers this automatically; included here as an explicit safety net.
SELECT pg_notify('pgrst', 'reload schema');

-- Backfill from Supabase app_metadata — one-time, substrate-specific.
-- After this migration, is_admin is the authoritative source.
UPDATE profiles
SET is_admin = true
FROM auth.users
WHERE profiles.id = auth.users.id
  AND (auth.users.raw_app_meta_data->>'role') = 'admin';
