-- Unified gathering anchor + attendance roster (feat: unified gathering feedback, U1).
--
-- KTD1 — the GATHERING is the anchor; a 1-on-1 is the n=2 case. One thin
-- `gatherings` row per time_slot that took place (slot_id UNIQUE), carrying the
-- prompt, the host (the author / participant_a), and a close timestamp. This
-- gives the retrospective attendee count (#66) and any future reveal state a
-- home, and makes "a 1-on-1 is a gathering with two participants" literal — no
-- 1-on-1-vs-group branch anywhere downstream.
--
-- KTD2 — TURNOUT is the primitive; occurrence is DERIVED. Per-person
-- `participation.turned_up`; whether the gathering happened is the SQL function
-- `app.gathering_happened(gathering)` = count(turned_up) >= 2, never a stored
-- column. This is what makes host-no-show, everyone-but-host, and
-- dwindle-to-pair (R6 / #56) fall out uniformly.
--
-- KTD8 — identity basis is `identities`, resolved via app.current_user_id()
-- (the vendor-neutrality wrapper), never auth.uid() directly.
--
-- Writes go through SECURITY DEFINER RPCs in a later unit (U5: attendance
-- submission + host attestation). This migration grants NO INSERT/UPDATE/DELETE
-- to authenticated — a participant can only SELECT the gatherings/participation
-- they belong to. Single `turned_up` + `attested_by` for now; conflicting
-- attestations (host-says-present / subject-says-absent) are deferred.

-- ============================================
-- GATHERINGS — one row per slot that took place
-- ============================================

CREATE TABLE IF NOT EXISTS gatherings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One gathering per time_slot. UNIQUE enforces "a slot took place at most once".
  slot_id UUID NOT NULL UNIQUE REFERENCES time_slots(id) ON DELETE CASCADE,
  prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE RESTRICT,
  -- The host is the author / participant_a; carries the extra attestation duty.
  host_id UUID NOT NULL REFERENCES identities(id) ON DELETE NO ACTION,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gatherings_prompt ON gatherings(prompt_id);
CREATE INDEX IF NOT EXISTS idx_gatherings_host ON gatherings(host_id);

-- ============================================
-- PARTICIPATION — attendance roster, one row per member per gathering
-- ============================================

CREATE TABLE IF NOT EXISTS participation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gathering_id UUID NOT NULL REFERENCES gatherings(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES identities(id) ON DELETE NO ACTION,
  is_host BOOLEAN NOT NULL DEFAULT false,
  -- turned_up = self-report + witnessed. Occurrence is derived from the count
  -- of turned_up rows (>= 2); it is never asserted per-gathering.
  turned_up BOOLEAN NOT NULL DEFAULT false,
  -- The person's own account of what happened. Only meaningful once submitted.
  self_report TEXT CHECK (self_report IS NULL OR self_report IN ('attended', 'cancelled_before', 'absent')),
  -- Free text, only meaningful when the self_report is 'absent'. Length-capped.
  absence_reason TEXT CHECK (absence_reason IS NULL OR char_length(absence_reason) <= 500),
  -- Who attested this person's turnout (the host, or a co-present participant
  -- when the host is the absentee). NULL until attested.
  attested_by UUID REFERENCES identities(id) ON DELETE NO ACTION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One participation row per member per gathering.
  CONSTRAINT uq_participation_member_per_gathering UNIQUE (gathering_id, member_id)
);

-- Hot path for app.gathering_happened / both_present: count turned_up per gathering.
CREATE INDEX IF NOT EXISTS idx_participation_gathering ON participation(gathering_id);
CREATE INDEX IF NOT EXISTS idx_participation_member ON participation(member_id);

-- ============================================
-- DERIVED OCCURRENCE + CO-PRESENCE FUNCTIONS
-- ============================================
-- SECURITY DEFINER so they see the full participation set regardless of the
-- caller's RLS (the occurrence question is not per-actor). STABLE — one
-- evaluation per statement. No actor needed for gathering_happened; both_present
-- is used by later units' public-feedback INSERT gate (KTD4).

CREATE OR REPLACE FUNCTION app.gathering_happened(p_gathering UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) >= 2
  FROM participation
  WHERE gathering_id = p_gathering
    AND turned_up;
$$;

CREATE OR REPLACE FUNCTION app.both_present(p_gathering UUID, p_a UUID, p_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM participation
      WHERE gathering_id = p_gathering AND member_id = p_a AND turned_up
    )
    AND EXISTS (
      SELECT 1 FROM participation
      WHERE gathering_id = p_gathering AND member_id = p_b AND turned_up
    );
$$;

-- Membership check used by the gatherings SELECT policy. SECURITY DEFINER so it
-- bypasses participation's own RLS (avoids a policy that reads its own table),
-- and keyed on app.current_user_id() (the vendor-neutrality wrapper).
CREATE OR REPLACE FUNCTION app.is_gathering_participant(p_gathering UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM participation
    WHERE gathering_id = p_gathering
      AND member_id = app.current_user_id()
  );
$$;

-- ============================================
-- RLS
-- ============================================
-- A participant may SELECT the gathering(s) they belong to and their own
-- participation row. All writes are service-role only (minted / updated by the
-- SECURITY DEFINER RPCs in U5). Mirrors the memberships pattern: REVOKE ALL from
-- the app roles, then GRANT SELECT back, so a future stray grant cannot reopen
-- a write hole.

ALTER TABLE gatherings ENABLE ROW LEVEL SECURITY;
ALTER TABLE participation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participant reads own gatherings" ON gatherings;
CREATE POLICY "Participant reads own gatherings"
  ON gatherings FOR SELECT TO authenticated
  USING (app.is_gathering_participant(id));

DROP POLICY IF EXISTS "Participant reads own participation" ON participation;
CREATE POLICY "Participant reads own participation"
  ON participation FOR SELECT TO authenticated
  USING (app.current_user_id() = member_id);

-- No INSERT/UPDATE/DELETE policy for users — rows are minted and mutated only by
-- SECURITY DEFINER RPCs (U5). Pare the default app-role grants back to SELECT.
REVOKE ALL ON gatherings FROM authenticated, anon;
REVOKE ALL ON participation FROM authenticated, anon;
GRANT SELECT ON gatherings TO authenticated;
GRANT SELECT ON participation TO authenticated;

COMMENT ON TABLE gatherings IS
  'Thin anchor: one row per time_slot that took place (slot_id UNIQUE). A 1-on-1 is the n=2 case. Holds the host and close timestamp; occurrence is derived from participation, never stored.';
COMMENT ON TABLE participation IS
  'Attendance roster: one row per member per gathering. turned_up is the primitive; app.gathering_happened(gathering) = count(turned_up) >= 2 derives whether it happened.';
