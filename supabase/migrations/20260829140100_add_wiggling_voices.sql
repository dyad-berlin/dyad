-- Wiggling voices as rows: the second content type behind the ContentService
-- port (plan R2; shape decided at U6 — docs/plans/2026-08-05-001-source-decision.md).
-- A separate table from unfolding_entries: the two types share nothing but
-- the port. Written by /admin/unfolding behind Cloudflare Access; read via
-- service-role behind the port. Members never touch it directly.

CREATE TABLE IF NOT EXISTS wiggling_voices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  -- Reel path within the videos bucket, resolved against videoBase at read
  -- time. A path, never a URL — R4 stays structural.
  src          TEXT NOT NULL,
  -- Poster-frame path within the "newsletter assets" bucket (the videos
  -- bucket accepts video MIME types only), resolved via storageUrl().
  poster       TEXT NOT NULL,
  -- Outbound link to the full conversation — a link, never an embed.
  episode      TEXT NOT NULL,
  state        TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'published')),
  -- Display order. The retired content module encoded order as array order;
  -- voices have no date to sort by, so the order is explicit.
  position     INT NOT NULL,
  -- "Finished but not currently shown" — distinct from draft. The Kaspar
  -- entry exercised this state: written and ready while its reel was not yet
  -- in the bucket, restored once it was.
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   TEXT
);

ALTER TABLE wiggling_voices ENABLE ROW LEVEL SECURITY;

-- No policies: service-role only, the copy_overrides / unfolding_entries
-- posture. See 20260829140000 for the full note.
