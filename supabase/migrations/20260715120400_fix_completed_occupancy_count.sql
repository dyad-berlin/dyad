-- Fix #66: retrospective attendee count for COMPLETED gatherings (feat: unified
-- gathering feedback, U8).
--
-- THE BUG. get_prompt_slot_occupancy (20260529100200) counts a seat as occupied
-- only while its meeting is in ('scheduled', 'awaiting_feedback'). That predicate
-- is correct for the PRE-EVENT seat cap — a joiner deciding whether a still-future
-- slot has room — and it is the SAME set accept_invitation's capacity cap and
-- cancel_meeting use. But the conversation/profile "who came" gathering card reuses
-- that same occupancy count to size the attendee circle AFTER the gathering has
-- ended, and by then advance_scheduled_meetings has moved the meetings to
-- 'completed'. 'completed' is (deliberately) excluded from the seat predicate, so an
-- ended gathering of N reports 0 others — the #66 undercount.
--
-- KTD9 — KEEP THE TWO NOTIONS SEPARATE. The pre-event seat CAP (turnout-blind,
-- meeting-state based, excludes 'completed') and the retrospective TURNOUT count
-- (includes 'completed') answer different questions. Re-pointing the capacity path
-- at turnout would let a full-then-completed slot mis-gate. So this migration leaves
-- get_prompt_slot_occupancy UNTOUCHED and adds a DISTINCT companion RPC for the
-- retrospective count.
--
-- WHY OVER meetings, NOT participation. U1 gives us participation/gatherings as the
-- eventual home for turnout, but the writer that mints participation rows is U5
-- (attendance submission), not yet built — participation is empty today, so counting
-- over it would report 0 for every real gathering. The minimal fix that is correct
-- NOW counts over `meetings` including the 'completed' state (the seat predicate plus
-- 'completed'). When U5 lands and participation carries real turnout, this body can be
-- re-pointed at participation without touching any caller.
--
-- Idempotent / rerunnable: CREATE OR REPLACE only. No table/column/index changes.
-- SECURITY DEFINER body uses app.current_user_id() (the vendor-neutrality wrapper),
-- never auth.uid() — mirrors get_prompt_slot_occupancy.

CREATE OR REPLACE FUNCTION get_prompt_slot_attendance(p_prompt_id TEXT)
RETURNS TABLE (slot_id UUID, attended INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := app.current_user_id();
BEGIN
  -- Auth + audience gate: byte-identical to get_prompt_slot_occupancy. Because
  -- SECURITY DEFINER bypasses RLS, re-implement every check RLS would apply, and
  -- return an empty set (never raise) for unauthorized callers so the prompt id's
  -- existence never leaks.
  IF v_caller IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM prompts p
    WHERE p.id = p_prompt_id
      AND (
        -- Author always reads their own prompt's attendance.
        p.author_id = v_caller
        OR (
          -- Non-authors: published, not hidden, and in the prompt's audience.
          p.state = 'published'
          AND p.hidden_at IS NULL
          AND (
            p.audience_scope IS NULL
            OR EXISTS (
              SELECT 1 FROM identity_scopes
              WHERE identity_scopes.identity_id = v_caller
                AND identity_scopes.scope = p.audience_scope
                AND identity_scopes.revoked_at IS NULL
            )
          )
        )
      )
  ) THEN
    RETURN;
  END IF;

  -- One row per slot with its attendee (turnout) count. The ONLY difference from
  -- get_prompt_slot_occupancy is the meeting-state predicate: 'completed' is
  -- INCLUDED here so an ended gathering counts the joiners who were on it, while
  -- cancelled states stay excluded. LEFT JOIN so slots with no attendance still
  -- return attended = 0.
  RETURN QUERY
  SELECT ts.id AS slot_id,
         COUNT(m.id)::INTEGER AS attended
  FROM time_slots ts
  LEFT JOIN meetings m
    ON m.slot_id = ts.id
   AND m.state IN ('scheduled', 'awaiting_feedback', 'completed')
  WHERE ts.prompt_id = p_prompt_id
  GROUP BY ts.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_prompt_slot_attendance(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION get_prompt_slot_attendance(TEXT) TO authenticated;

COMMENT ON FUNCTION get_prompt_slot_attendance(TEXT) IS
  'Returns (slot_id, attended) per slot of a prompt — attended = count of meetings in state (scheduled, awaiting_feedback, completed). Retrospective TURNOUT count for the "who came" gathering card; distinct from get_prompt_slot_occupancy (the pre-event seat cap, which excludes completed). Viewer-safe: same auth + published/hidden + audience-scope checks, count-only. Returns empty set for unauthorized callers. Fixes #66.';
