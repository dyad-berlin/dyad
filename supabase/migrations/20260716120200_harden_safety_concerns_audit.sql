-- Close a blind spot in the safety_concerns confidentiality regression guard
-- (code-review follow-up to #118, U2).
--
-- FINDING (P2, security): audit_safety_concerns_read_paths() checked only
-- role_table_grants WHERE grantee IN ('authenticated','anon'). That misses two
-- ways a read path could reopen:
--   * GRANT SELECT ON safety_concerns TO PUBLIC — grantee is 'PUBLIC', not an app
--     role, so the row filter skips it, yet every authenticated session inherits it.
--   * A column-level grant (GRANT SELECT (detail) ...) — surfaces in
--     column_privileges, not table-level role_table_grants.
-- Either would silently break R3 while the companion test still passed.
--
-- Replace the grant probe with the privilege-resolving functions, which account
-- for PUBLIC and inheritance (has_table_privilege) and for column-level grants
-- (has_any_column_privilege). The policy probe is unchanged. service_role-only.

CREATE OR REPLACE FUNCTION public.audit_safety_concerns_read_paths()
RETURNS TABLE (
  kind text,     -- 'grant' | 'policy'
  detail text    -- grantee/privilege, or policyname/command
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  -- Any SELECT reachable by an app role — table-level or column-level, whether
  -- granted directly, via a role, or via PUBLIC. has_*_privilege resolves all
  -- three, unlike a grantee-name filter on role_table_grants.
  SELECT
    'grant'::text AS kind,
    (r.role || ':SELECT')::text AS detail
  FROM (VALUES ('authenticated'), ('anon')) AS r(role)
  WHERE has_table_privilege(r.role, 'public.safety_concerns', 'SELECT')
     OR has_any_column_privilege(r.role, 'public.safety_concerns', 'SELECT')

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
