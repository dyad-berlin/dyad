-- Feedback-gate dual-read for the unified gathering obligation
-- (feat: unified gathering feedback, U9).
--
-- U4 (20260715120500) made advance_scheduled_meetings DUAL-WRITE: for a GROUP
-- slot it mints BOTH the legacy group_feedback 'due' rows AND the new-model
-- `gatherings` + `participation` (self_report NULL = unconfirmed) rows. This
-- migration teaches the feedback gate to enforce the NEW mandatory obligation —
-- confirming attendance (plan R10) — WITHOUT double-prompting alongside the
-- legacy group_feedback gate for the SAME slot.
--
-- The new obligation: a `participation` row for the caller with self_report
-- NULL on a GROUP gathering (a gathering whose slot also carries group_feedback,
-- which is exactly the legacy group branch's marker). Submitting attendance
-- (U5 submit_attendance sets self_report) clears it.
--
-- NO DOUBLE-PROMPT (the crux): a group slot that has a `gatherings` row is
-- driven by the NEW participation obligation, and its legacy group_feedback
-- 'due' gate is SUPPRESSED. The two candidates are symmetric on the same key
-- (a gathering row for the slot):
--   * group gathering (gatherings + group_feedback both present, post-U4)
--       -> participation gate fires, group_feedback gate suppressed.
--   * legacy group_feedback with NO gathering row (pre-U4 rows)
--       -> participation gate excluded (no participation rows), group fires.
-- 1-on-1 slots carry feedback_forms (never group_feedback), so the participation
-- candidate excludes them and the one-on-one gate (prio 1) is untouched — the
-- deferred 1-on-1 reveal path is not touched, and a 1-on-1 member is never
-- routed to the new-model form. Priority: one_on_one > gathering > group.
--
-- The behaviour is behind an APP-LAYER flag: the caller passes
-- p_gathering_gate_enabled (sourced from getGatheringFeedbackGateEnabled ->
-- app_settings 'gathering_feedback_gate_enabled', default TRUE, fail-safe TRUE).
-- With the flag OFF the two new predicates collapse to the pre-U9 behaviour
-- (participation candidate yields nothing; group_feedback never suppressed), so
-- the whole unit is rollback-able without a migration. DEFAULT true so a bare
-- call ships the live group-flow behaviour; the service layer passes false for
-- legacy callers that predate U9.
--
-- SECURITY DEFINER, keyed on app.current_user_id() (never auth.uid()) — same
-- posture and counterpart-expiry exclusion as 20260605100600.
--
-- The old zero-arg my_feedback_gate() is DROPPED first: adding a defaulted
-- parameter creates an OVERLOAD rather than replacing it, which would make a
-- bare my_feedback_gate() call ambiguous. DROP + recreate keeps one signature.

DROP FUNCTION IF EXISTS my_feedback_gate();

CREATE OR REPLACE FUNCTION my_feedback_gate(p_gathering_gate_enabled BOOLEAN DEFAULT true)
RETURNS TABLE (kind TEXT, form_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT kind, form_id FROM (
    -- 1. ONE-ON-ONE (verbatim from 20260605100600). Highest priority, untouched:
    --    excludes forms whose counterpart is access-expired so a vanished guest
    --    never gates their partner on a reveal that cannot complete.
    (
      SELECT 1 AS prio, 'one_on_one'::TEXT AS kind, ff.id AS form_id
      FROM feedback_forms ff
      JOIN meetings m ON m.id = ff.meeting_id
      JOIN profiles counterpart ON counterpart.id =
        CASE WHEN m.participant_a = app.current_user_id()
             THEN m.participant_b
             ELSE m.participant_a
        END
      WHERE ff.reviewer_id = app.current_user_id()
        AND ff.state = 'due'
        AND (counterpart.access_expires_at IS NULL OR counterpart.access_expires_at > NOW())
      LIMIT 1
    )
    UNION ALL
    -- 2. NEW gathering obligation (U9): an unconfirmed self_report on a GROUP
    --    gathering (its slot carries group_feedback — the legacy group marker).
    --    form_id = the gathering id (routes to /feedback/gathering/[id]).
    --    Dormant when the flag is off.
    (
      SELECT 2 AS prio, 'gathering'::TEXT AS kind, g.id AS form_id
      FROM participation p
      JOIN gatherings g ON g.id = p.gathering_id
      WHERE p_gathering_gate_enabled
        AND p.member_id = app.current_user_id()
        AND p.self_report IS NULL
        AND EXISTS (
          SELECT 1 FROM group_feedback gf2 WHERE gf2.slot_id = g.slot_id
        )
      LIMIT 1
    )
    UNION ALL
    -- 3. LEGACY group_feedback gate. Suppressed (no double-prompt) for a slot
    --    that has a gathering row when the flag is on — that slot's obligation is
    --    carried by candidate 2. Pre-U4 group_feedback (no gathering row) still
    --    fires here, preserving dual-read.
    (
      SELECT 3 AS prio, 'group'::TEXT AS kind, gf.id AS form_id
      FROM group_feedback gf
      WHERE gf.reviewer_id = app.current_user_id()
        AND gf.state = 'due'
        AND NOT (
          p_gathering_gate_enabled
          AND EXISTS (SELECT 1 FROM gatherings g WHERE g.slot_id = gf.slot_id)
        )
      LIMIT 1
    )
  ) candidates
  ORDER BY prio
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION my_feedback_gate(BOOLEAN) FROM public;
REVOKE EXECUTE ON FUNCTION my_feedback_gate(BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION my_feedback_gate(BOOLEAN) TO authenticated;

COMMENT ON FUNCTION my_feedback_gate(BOOLEAN) IS
  'Per-request feedback-gate check (one_on_one > gathering > group). Dual-reads the U9 gathering obligation (unconfirmed participation on a group gathering) alongside the legacy feedback_forms/group_feedback gates, suppressing the legacy group_feedback gate for any slot that has a gathering row so the same slot never double-prompts. Gated by p_gathering_gate_enabled (app_settings gathering_feedback_gate_enabled). Own gate only via app.current_user_id().';

-- Discoverability seed (default TRUE — ships live for the group flow). Absent-key
-- reads already fail safe to TRUE in getGatheringFeedbackGateEnabled(), so this
-- is for the /admin/settings surface, not correctness.
INSERT INTO app_settings (key, value)
VALUES ('gathering_feedback_gate_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
