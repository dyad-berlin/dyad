-- Confidential safeguarding concerns (feat: unified gathering feedback, U2).
--
-- KTD3 — CONFIDENTIALITY IS STRUCTURAL, NOT DISCIPLINARY. A concern about a
-- co-participant (or the meeting) is the safeguarding core of the feature. Its
-- confidentiality is enforced by the SHAPE of this table, not by a WHERE clause
-- any future permissive policy could silently defeat:
--   * INSERT is the ONLY user-facing verb (GRANT INSERT TO authenticated).
--   * There is NO SELECT policy and NO authenticated/anon SELECT grant — so with
--     RLS on, an authenticated or anonymous caller can read NOTHING, ever. The
--     reported person, the reporter, and every other participant are all blind
--     to the row.
--   * The ONLY read path is the service-role admin plane (which bypasses RLS) —
--     the steward-only guarantee, wired in a later unit (U7). See
--     src/lib/server/admin-auth.ts + SECURITY.md.
-- The guarantee is provable-by-ABSENCE: the RLS audit migration
-- (20260715120150_assert_safety_concerns_no_read.sql) fails the test suite if any
-- future migration adds a SELECT grant or SELECT/ALL policy to this table.
--
-- KTD4 — the report gate is SCHEDULED CO-MEMBERSHIP (app.is_slot_participant),
-- turnout-BLIND: a no-show is reportable even though the subject was absent, so
-- the gate keys off who was scheduled onto the slot (meetings), not who turned
-- up. The INSERT WITH CHECK constrains the TARGET (both reporter and subject must
-- be slot participants), not just the actor — a participant cannot file a concern
-- naming an outsider, nor an outsider file about a participant.
--
-- KTD6 — safety_concerns + app.is_slot_participant are built FRESH on this
-- branch (design mirrors PR #113 `feat/safety-concerns`, reimplemented — no
-- dependency on that branch merging). If #113 merges first, dedupe at rebase.
--
-- KTD8 — identity basis is `identities`, resolved via app.current_user_id()
-- (the vendor-neutrality wrapper), never auth.uid() directly.
--
-- Origin: docs/plans/2026-07-15-001-feat-unified-gathering-feedback-plan.md
-- (R1, R2, R3, R4); docs/brainstorms/2026-07-08-group-feedback-requirements.md.

-- ============================================
-- SAFETY_CONCERNS — confidential, insert-only, no authenticated read
-- ============================================

CREATE TABLE IF NOT EXISTS safety_concerns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Schedule-time anchor: available at booking, turnout-blind. The gate
  -- (app.is_slot_participant) keys off this slot's scheduled meetings.
  -- ON DELETE RESTRICT (not CASCADE): a safeguarding record must not be
  -- erasable by tearing down its slot. time_slots.prompt_id is ON DELETE
  -- CASCADE and the author can deletePrompt(), so CASCADE here would let a
  -- reported host wipe concerns about themselves by deleting the prompt. A
  -- slot with concerns is pinned; deletion is governed by the retention
  -- policy (R9, a go-live gate), never by incidental teardown.
  slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE RESTRICT,
  -- Optional finer context: the gathering that (may have) taken place on the
  -- slot. NULLABLE — a concern can be filed before/without a gathering row.
  gathering_id UUID REFERENCES gatherings(id) ON DELETE SET NULL,
  reporter_id UUID NOT NULL REFERENCES identities(id) ON DELETE NO ACTION,
  -- NULLABLE: a gathering-scoped concern (scope='gathering') names no person.
  subject_id UUID REFERENCES identities(id) ON DELETE NO ACTION,
  scope TEXT NOT NULL CHECK (scope IN ('person', 'gathering')),
  kind TEXT NOT NULL CHECK (kind IN ('no_show', 'felt_unsafe', 'other')),
  -- Free text, length-capped.
  detail TEXT CHECK (detail IS NULL OR char_length(detail) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- scope <-> subject coherence: a person-scoped concern names a subject; a
  -- gathering-scoped concern names none.
  CONSTRAINT scope_subject_coherent CHECK (
    (scope = 'person' AND subject_id IS NOT NULL)
    OR (scope = 'gathering' AND subject_id IS NULL)
  ),
  -- No self-reports (only meaningful when a subject is named).
  CONSTRAINT no_self_report CHECK (reporter_id <> subject_id OR subject_id IS NULL)
);

-- Steward lookups: per-person history newest-first (R2/R4), and by slot.
CREATE INDEX IF NOT EXISTS idx_safety_concerns_subject ON safety_concerns(subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_concerns_slot ON safety_concerns(slot_id);

-- ============================================
-- SCHEDULED-MEMBERSHIP GATE (turnout-blind)
-- ============================================
-- Was p_actor scheduled onto this slot (participant_a/b of ANY meeting on it)?
-- SECURITY DEFINER so the INSERT policy can see meetings the reporter cannot
-- directly read. STABLE — one evaluation per statement. Turnout-BLIND by
-- construction: it reads scheduled meetings, not participation.turned_up, so a
-- co-participant who did NOT turn up is still reportable (KTD4).

CREATE OR REPLACE FUNCTION app.is_slot_participant(p_actor UUID, p_slot UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM meetings m
    WHERE m.slot_id = p_slot
      AND p_actor IN (m.participant_a, m.participant_b)
  );
$$;

-- ============================================
-- RLS — INSERT is the only user-facing verb; no read path
-- ============================================

ALTER TABLE safety_concerns ENABLE ROW LEVEL SECURITY;

-- The ONLY user-facing policy: a slot participant files a concern about a
-- co-participant (person scope) or the meeting (gathering scope). WITH CHECK
-- constrains the TARGET, not just the actor:
--   * the actor is the reporter,
--   * no self-report,
--   * the reporter was scheduled onto the slot,
--   * if a subject is named, the subject was ALSO scheduled onto the slot.
DROP POLICY IF EXISTS "Participant files a concern about a co-participant" ON safety_concerns;
CREATE POLICY "Participant files a concern about a co-participant"
  ON safety_concerns FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = app.current_user_id()
    AND (subject_id IS NULL OR reporter_id <> subject_id)
    AND app.is_slot_participant(reporter_id, slot_id)
    AND (subject_id IS NULL OR app.is_slot_participant(subject_id, slot_id))
  );

-- Insert only for authenticated. NO SELECT policy exists → users read nothing.
-- Reads go through the service-role admin client, which bypasses RLS (U7).
GRANT INSERT ON safety_concerns TO authenticated;
REVOKE SELECT, UPDATE, DELETE ON safety_concerns FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION app.is_slot_participant(UUID, UUID) TO authenticated;

COMMENT ON TABLE safety_concerns IS
  'Confidential safeguarding reports about a gathering participant or the meeting itself. Steward-only read (service role bypasses RLS); users may only INSERT about a co-participant. NO SELECT policy or grant exists — never revealed to the reported person or any participant. Guarded by 20260715120150_assert_safety_concerns_no_read.sql. See docs/plans/2026-07-15-001-feat-unified-gathering-feedback-plan.md.';
