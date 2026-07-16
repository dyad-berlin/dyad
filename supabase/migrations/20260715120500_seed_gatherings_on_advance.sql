-- Additive seeding of the unified gathering tables at slot advance
-- (feat: unified gathering feedback, U4).
--
-- KTD7 — STAND ALONGSIDE, DO NOT REWRITE. This CREATE OR REPLACE keeps the whole
-- existing body of advance_scheduled_meetings (20260529100300_group_feedback.sql)
-- VERBATIM: the Phase-1 advance of due meetings to 'awaiting_feedback', the
-- group-vs-one-on-one branch that mints legacy group_feedback / feedback_forms
-- rows, and the group-branch transition of meetings to 'completed'. None of that
-- changes. The live submit_feedback simultaneous-reveal machine is untouched.
--
-- What it ADDS: per advancing slot, an idempotent upsert into the NEW unified
-- tables (U1/U3) — one `gatherings` row, one `participation` row per DISTINCT
-- participant, and one `gathering_feedback` row per DISTINCT participant. This
-- runs at the TOP of the per-slot loop, while every advanced meeting on the slot
-- is still 'awaiting_feedback' (Phase 1 just set it) and BEFORE the group branch
-- moves them to 'completed' — so the participant set is read uniformly for both
-- shapes (a 1-on-1 is the n=2 case, KTD1). Everything is ON CONFLICT DO NOTHING,
-- so re-running advance is a no-op on the new tables exactly as it is on legacy.
--
-- Turnout is left UNCONFIRMED: participation.turned_up keeps its NOT NULL DEFAULT
-- false and self_report / attested_by stay NULL until the member self-reports via
-- the U5 attendance RPC. gathering_feedback.meet_again stays NULL (collect-only,
-- filled on submit). This is a "due"-equivalent seed: the rows exist, the answers
-- do not. gathering_feedback has no state column, so the pending row IS just its
-- creation (mirrors the U3 table shape).
--
-- Mirrors the legacy group branch's distinct-participant expansion:
-- CROSS JOIN LATERAL (VALUES (participant_a),(participant_b)) collapsed by
-- ON CONFLICT — the author (participant_a) is emitted once per pair and folded to
-- a single row.
--
-- Origin: docs/plans/2026-07-15-001-feat-unified-gathering-feedback-plan.md
-- (R6, KTD7).

CREATE OR REPLACE FUNCTION advance_scheduled_meetings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  advanced_count INTEGER := 0;
  v_meeting RECORD;
  v_slot RECORD;
  v_active_count INTEGER;
  v_advanced_slots UUID[] := ARRAY[]::UUID[];
  v_gathering_id UUID;
BEGIN
  -- Phase 1: advance due meetings to awaiting_feedback (verbatim original
  -- behaviour), collecting the affected slot ids.
  FOR v_meeting IN
    UPDATE meetings
    SET state = 'awaiting_feedback', resolved_at = NOW()
    WHERE state = 'scheduled' AND scheduled_time <= NOW()
    RETURNING id, slot_id
  LOOP
    v_advanced_slots := array_append(v_advanced_slots, v_meeting.slot_id);
    advanced_count := advanced_count + 1;
  END LOOP;

  -- Phase 2: per DISTINCT affected slot, branch on the active-meeting count.
  FOR v_slot IN
    SELECT DISTINCT unnest(v_advanced_slots) AS slot_id
  LOOP
    -- ------------------------------------------------------------------
    -- ADDITIVE (U4): seed the unified gathering tables for this slot.
    -- Runs FIRST, while every advanced meeting on the slot is still
    -- 'awaiting_feedback' (before the group branch below moves them to
    -- 'completed'), so the participant set reads uniformly for 1-on-1 and
    -- group. Purely additive to the legacy minting that follows; idempotent.
    -- ------------------------------------------------------------------

    -- One gatherings row per slot. host_id = the author (participant_a, the
    -- same identity across every pair on the slot); prompt_id from the same.
    -- SELECT DISTINCT collapses the identical (slot, prompt, author) rows to
    -- one. ON CONFLICT (slot_id) keeps re-runs a no-op.
    INSERT INTO gatherings (slot_id, prompt_id, host_id, closed_at)
    SELECT DISTINCT m.slot_id, m.prompt_id, m.participant_a, NOW()
    FROM meetings m
    WHERE m.slot_id = v_slot.slot_id
      AND m.state = 'awaiting_feedback'
    ON CONFLICT (slot_id) DO NOTHING;

    SELECT id INTO v_gathering_id
    FROM gatherings
    WHERE slot_id = v_slot.slot_id;

    IF v_gathering_id IS NOT NULL THEN
      -- One participation row per DISTINCT participant. is_host flags the
      -- author. turned_up keeps its NOT NULL DEFAULT false and self_report /
      -- attested_by stay NULL — turnout is unconfirmed until self-reported (U5).
      INSERT INTO participation (gathering_id, member_id, is_host)
      SELECT DISTINCT v_gathering_id, p.participant, (p.participant = m.participant_a)
      FROM meetings m
      CROSS JOIN LATERAL (
        VALUES (m.participant_a), (m.participant_b)
      ) AS p(participant)
      WHERE m.slot_id = v_slot.slot_id
        AND m.state = 'awaiting_feedback'
      ON CONFLICT (gathering_id, member_id) DO NOTHING;

      -- One collect-only meet-again row per DISTINCT participant. meet_again
      -- stays NULL (pending) until submit (U5). No state column on this table.
      INSERT INTO gathering_feedback (gathering_id, reviewer_id)
      SELECT DISTINCT v_gathering_id, p.participant
      FROM meetings m
      CROSS JOIN LATERAL (
        VALUES (m.participant_a), (m.participant_b)
      ) AS p(participant)
      WHERE m.slot_id = v_slot.slot_id
        AND m.state = 'awaiting_feedback'
      ON CONFLICT (gathering_id, reviewer_id) DO NOTHING;
    END IF;

    -- ------------------------------------------------------------------
    -- LEGACY (unchanged): mint group_feedback / feedback_forms + state machine.
    -- ------------------------------------------------------------------
    SELECT COUNT(*) INTO v_active_count
    FROM meetings
    WHERE slot_id = v_slot.slot_id
      AND state IN ('scheduled', 'awaiting_feedback');

    IF v_active_count >= 2 THEN
      -- GROUP gathering: one group_feedback row per DISTINCT participant.
      -- participant_a is the author (the same identity across every pair on the
      -- slot); participant_b is each joiner. The LATERAL expansion emits the
      -- author once per pair (so N times for N joiners); ON CONFLICT (slot_id,
      -- reviewer_id) DO NOTHING collapses those repeats to the single author row
      -- and also keeps the whole INSERT idempotent across re-runs.
      INSERT INTO group_feedback (prompt_id, slot_id, reviewer_id, state)
      SELECT m.prompt_id, m.slot_id, participant, 'due'
      FROM meetings m
      CROSS JOIN LATERAL (
        VALUES (m.participant_a), (m.participant_b)
      ) AS p(participant)
      WHERE m.slot_id = v_slot.slot_id
        AND m.state = 'awaiting_feedback'
      ON CONFLICT (slot_id, reviewer_id) DO NOTHING;

      -- The gathering happened; feedback is tracked via group_feedback, so move
      -- these meetings straight to 'completed'. This keeps them out of the 1:1
      -- simultaneous-reveal machine (no per-pair feedback_forms are created).
      UPDATE meetings
      SET state = 'completed', resolved_at = NOW()
      WHERE slot_id = v_slot.slot_id
        AND state = 'awaiting_feedback';
    ELSE
      -- ONE-ON-ONE: original per-pair behaviour, unchanged. Mint two directional
      -- feedback_forms for the single awaiting_feedback meeting on this slot.
      FOR v_meeting IN
        SELECT id, participant_a, participant_b
        FROM meetings
        WHERE slot_id = v_slot.slot_id
          AND state = 'awaiting_feedback'
      LOOP
        INSERT INTO feedback_forms (meeting_id, reviewer_id, reviewee_id, state)
        VALUES
          (v_meeting.id, v_meeting.participant_a, v_meeting.participant_b, 'due'),
          (v_meeting.id, v_meeting.participant_b, v_meeting.participant_a, 'due');
      END LOOP;
    END IF;
  END LOOP;

  RETURN advanced_count;
END;
$$;

-- Preserve the original grant surface EXACTLY (service_role only). CREATE OR
-- REPLACE keeps existing grants, but we re-assert them to keep the surface
-- explicit and the migration self-contained.
REVOKE EXECUTE ON FUNCTION advance_scheduled_meetings FROM public;
GRANT EXECUTE ON FUNCTION advance_scheduled_meetings TO service_role;
