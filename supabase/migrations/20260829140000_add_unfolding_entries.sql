-- Unfolding essays as rows: the content source chosen at the plan's U6 gate
-- (docs/plans/2026-08-05-001-source-decision.md — Branch B, admin plane over
-- Postgres). Written by /admin/unfolding behind Cloudflare Access; read on
-- the user plane through a service-role fetch behind the ContentService port
-- (src/lib/services/content-supabase.ts), cached in KV with last-known-good
-- fallback. Members never touch this table directly.
--
-- Two body representations, one populated per row:
--   paragraphs — plain-string paragraphs using the inline-markup grammar of
--                src/routes/(zine)/newsletter/[slug]/segments.ts; carries the
--                essays migrated from src/lib/content/unfolding.ts at U8.
--   body       — TipTap JSON (the plan's KTD2 body variant), authored in the
--                admin editor, rendered by the allowlist renderer
--                (src/lib/utils/tiptap-html.ts). New essays use this.

CREATE TABLE IF NOT EXISTS unfolding_entries (
  slug             TEXT PRIMARY KEY,
  kicker           TEXT NOT NULL,
  title            TEXT NOT NULL,
  dek              TEXT,
  quote            TEXT NOT NULL,
  quote_attr       TEXT,
  -- Published date shown on the page (display order key, newest first).
  date             DATE NOT NULL,
  -- Array of strings (legacy body). NULL when body carries the essay.
  paragraphs       JSONB,
  -- TipTap JSON (KTD2 body variant). NULL when paragraphs carries the essay.
  body             JSONB,
  -- Path within the "newsletter assets" bucket, resolved via storageUrl().
  -- Never a full URL: R4 (no third-party asset reaches a visitor) is
  -- structural when only paths are stored.
  hero_image       TEXT,
  hero_credit      TEXT,
  hero_credit_url  TEXT,
  state            TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Cloudflare Access operator email (verified JWT claim, written server-
  -- side). Plain TEXT, no FK: admin operators are CF Access principals, not
  -- Supabase users (same reasoning as copy_overrides.updated_by).
  updated_by       TEXT
);

ALTER TABLE unfolding_entries ENABLE ROW LEVEL SECURITY;

-- No policies: anon and authenticated roles have no access. The service-role
-- client (makeAdminClient) bypasses RLS and is the only reader/writer — the
-- copy_overrides posture (migration 20260721100000).
--
-- Security posture: RLS-on + no-grants. If a future change needs to expose
-- this table to authenticated callers, you must ADD A POLICY *and* the
-- matching column GRANTs. Flipping only one of them is a silent vulnerability.
