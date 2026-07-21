-- Copy overrides: user-facing copy edited from the admin plane without a
-- deploy. Each row overrides one string-valued leaf of the typed defaults in
-- src/lib/copy.ts, keyed by dot-path (e.g. 'membership.guestIntro'). Deleting
-- a row restores the default; copy.ts stays the source of truth for
-- structure, types, and function-valued (parameterized) copy, which is not
-- overridable here.
--
-- Read on the user plane through a cached service-role fetch that fails to
-- the typed defaults on any error (src/lib/server/copy-overrides.ts); written
-- only by the admin plane (/admin/copy).

CREATE TABLE IF NOT EXISTS copy_overrides (
  key              TEXT PRIMARY KEY,
  value            TEXT NOT NULL,
  -- Snapshot of the copy.ts default at save time. Unused by the runtime;
  -- enables a later "the default changed underneath this override" flag in
  -- the editor without another migration.
  default_at_save  TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Cloudflare Access operator email (verified JWT claim, written server-
  -- side). Plain TEXT, no FK: admin operators are CF Access principals, not
  -- Supabase users or identities (same reasoning as app_settings).
  updated_by       TEXT
);

ALTER TABLE copy_overrides ENABLE ROW LEVEL SECURITY;

-- No policies: anon and authenticated roles have no access. The service-role
-- client (makeAdminClient) bypasses RLS and is the only reader/writer.
--
-- Security posture: RLS-on + no-grants. If a future change needs to expose
-- this table to authenticated callers, you must ADD A POLICY *and* the
-- matching column GRANTs (see 20260417100200 for the pattern). Flipping only
-- one of them is a silent vulnerability.
