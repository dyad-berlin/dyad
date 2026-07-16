-- Write path for the collect-only "meet again" soft signal (feat: unified
-- gathering feedback, U6 — completes U3/U5).
--
-- U3 (20260715120200) created gathering_feedback (one row per reviewer per
-- gathering, meet_again BOOLEAN) with NO user INSERT/UPDATE grant, and its
-- header states the row is "written by SECURITY DEFINER RPCs in later units
-- (U4 seeding, U5 submit)". U4 seeds the pending row (meet_again NULL); the U5
-- write-path migration (20260715120300) shipped submit_attendance /
-- submit_public_feedback / promote / submit_concern but NOT the meet_again
-- submit. This additive RPC fills that gap so the post-gathering form's
-- gathering-level "would you meet again" (plan step 5, R7) can persist. It does
-- not touch any U1–U5 object — it only writes gathering_feedback, which has no
-- user grant, so this DEFINER path is the only way a member records the signal.
--
-- Collect-only (R7/AE5): the value is wired to nothing user-visible or
-- match-affecting. Owner-scoped: the RPC only ever updates the CALLER's own row.
--
-- KTD8 — keyed on app.current_user_id() (the vendor-neutrality wrapper), never
-- auth.uid() directly.
--
-- Origin: docs/plans/2026-07-15-001-feat-unified-gathering-feedback-plan.md
-- (R7, KTD5).

CREATE OR REPLACE FUNCTION submit_meet_again(
  p_gathering UUID,
  p_meet_again BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := app.current_user_id();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- The caller must be a participant of this gathering (their pending
  -- gathering_feedback row was seeded at advance). UPSERT so a form re-submit is
  -- idempotent and a missing seed row (defensive) still records the signal.
  IF NOT EXISTS (
    SELECT 1 FROM participation p
    WHERE p.gathering_id = p_gathering
      AND p.member_id = v_caller
  ) THEN
    RAISE EXCEPTION 'Not a participant of this gathering';
  END IF;

  INSERT INTO gathering_feedback (gathering_id, reviewer_id, meet_again)
  VALUES (p_gathering, v_caller, p_meet_again)
  ON CONFLICT (gathering_id, reviewer_id) DO UPDATE SET
    meet_again = EXCLUDED.meet_again;
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_meet_again(UUID, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION submit_meet_again(UUID, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION submit_meet_again(UUID, BOOLEAN) IS
  'Records the caller''s collect-only "would you meet again" answer for a gathering (gathering_feedback.meet_again). Owner-scoped, idempotent upsert; caller must be a participant. Wired to nothing user-visible or match-affecting (R7/AE5). Fills the U5 write-path gap for the U3 table.';
