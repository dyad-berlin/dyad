-- Confidentiality regression guard for safety_concerns (feat: unified gathering
-- feedback, U2 — the safeguarding invariant, R3).
--
-- The confidentiality of safety_concerns is STRUCTURAL: it rests on the ABSENCE
-- of any authenticated/anon read path (see 20260715120100_create_safety_concerns.sql,
-- KTD3). Absence is fragile — a future migration that copy-pastes a permissive
-- SELECT policy, or a stray `GRANT SELECT ... TO authenticated`, would silently
-- reopen the row to the reported person and break R3 with no error.
--
-- This function makes that absence ASSERTABLE. It returns one row per offending
-- read path on safety_concerns:
--   * a SELECT privilege granted to authenticated or anon, or
--   * a policy whose command exposes reads (SELECT or ALL) — regardless of role.
-- The companion integration test (tests/integration/safety-concerns-rls.test.ts)
-- asserts the list is empty, so any migration that adds a read path fails the
-- suite. This mirrors audit_rls_policies_using_auth_uid()
-- (20260512000000_test_rls_policy_audit.sql): a SECURITY DEFINER audit function
-- the service-role test client calls, because supabase-js cannot query
-- pg_policies / information_schema grants through PostgREST.
--
-- service_role-only EXECUTE; nobody else.

CREATE OR REPLACE FUNCTION public.audit_safety_concerns_read_paths()
RETURNS TABLE (
  kind text,     -- 'grant' | 'policy'
  detail text    -- grantee/privilege, or policyname/command
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  -- Any SELECT table privilege handed to the app roles.
  SELECT
    'grant'::text AS kind,
    (g.grantee || ':' || g.privilege_type)::text AS detail
  FROM information_schema.role_table_grants g
  WHERE g.table_schema = 'public'
    AND g.table_name = 'safety_concerns'
    AND g.privilege_type = 'SELECT'
    AND g.grantee IN ('authenticated', 'anon')

  UNION ALL

  -- Any policy whose command permits reads (SELECT or the catch-all ALL).
  SELECT
    'policy'::text AS kind,
    (p.policyname || ':' || p.cmd)::text AS detail
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename = 'safety_concerns'
    AND p.cmd IN ('SELECT', 'ALL');
$$;

REVOKE EXECUTE ON FUNCTION public.audit_safety_concerns_read_paths() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_safety_concerns_read_paths() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_safety_concerns_read_paths() FROM anon;
GRANT EXECUTE ON FUNCTION public.audit_safety_concerns_read_paths() TO service_role;
