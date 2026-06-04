-- cancel_gathering: the author calls off a whole gathering in one act.
--
-- A gathering = N pair-meetings (author = participant_a on every row) sharing
-- one time_slot. Cancelling them one by one would require N reasons, run N
-- late free-pass checks, and leave the slot open for fresh invitations.
-- This RPC performs the act once, in one transaction:
--
--   * host-only (caller must be the prompt author) — SECURITY DEFINER
--     bypasses RLS, so the check is explicit, mirroring
--     get_prompt_slot_occupancy's author branch;
--   * tier (early/late, 12h rule) judged ONCE — every pair shares
--     scheduled_time, so the tier is uniform by construction;
--   * early requires one reason (>=10 chars), recorded on every pair's
--     cancellation_records row;
--   * ONE free-pass act: rows share a group_key (see 20260604150000) and the
--     distinct-act count treats them as a single late cancellation;
--   * every joiner gets a meeting_cancelled notification (same payload shape
--     as cancel_meeting's);
--   * pending invitations on the slot are resolved to cancelled so they don't
--     linger on inviters' profiles;
--   * the slot is RETIRED (see 20260604150100) — the time is withdrawn, not
--     re-opened.
--
-- Returns one row per cancelled pair (tier, joiner_id) so the API layer can
-- fan out transactional emails per recipient.

CREATE OR REPLACE FUNCTION cancel_gathering(p_meeting_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS TABLE(tier TEXT, joiner_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := app.current_user_id();
  v_meeting meetings%ROWTYPE;
  v_author UUID;
  v_tier TEXT;
  v_free_pass BOOLEAN := FALSE;
  v_late_count INTEGER;
  v_group_key UUID := gen_random_uuid();
  v_pair RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Anchor: any of the author's pair-meetings on the slot. Must be live.
  SELECT * INTO v_meeting FROM meetings
  WHERE id = p_meeting_id AND state = 'scheduled'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meeting not found or not cancellable';
  END IF;

  -- Host-only: the caller must author the prompt behind this gathering.
  SELECT author_id INTO v_author FROM prompts WHERE id = v_meeting.prompt_id;
  IF v_author IS NULL OR v_author != v_caller THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Serialize against concurrent accepts/cancels on this slot.
  PERFORM 1 FROM time_slots WHERE id = v_meeting.slot_id FOR UPDATE;

  IF v_meeting.scheduled_time - INTERVAL '12 hours' > NOW() THEN
    v_tier := 'early';
  ELSE
    v_tier := 'late';
  END IF;

  IF v_tier = 'early' AND (p_reason IS NULL OR char_length(p_reason) < 10) THEN
    RAISE EXCEPTION 'Early cancellation requires an explanation (min 10 characters)';
  END IF;

  IF v_tier = 'late' THEN
    -- Distinct ACTS (shared definition with cancel_meeting, 20260604150000).
    SELECT COUNT(DISTINCT COALESCE(cr.group_key, cr.id)) INTO v_late_count
    FROM cancellation_records cr
    WHERE cr.cancelled_by = v_caller
      AND cr.tier = 'late'
      AND cr.cancelled_at > NOW() - INTERVAL '90 days';

    IF v_late_count = 0 THEN
      v_free_pass := TRUE;
    END IF;
  END IF;

  -- Cancel every live pair on the slot. participant_a = v_caller is belt and
  -- braces — the author is participant_a on every pair of their own slot.
  FOR v_pair IN
    SELECT m.id, m.participant_b FROM meetings m
    WHERE m.slot_id = v_meeting.slot_id
      AND m.state = 'scheduled'
      AND m.participant_a = v_caller
    FOR UPDATE
  LOOP
    UPDATE meetings
    SET state = CASE WHEN v_tier = 'early' THEN 'cancelled_early' ELSE 'cancelled_late' END,
        resolved_at = NOW()
    WHERE id = v_pair.id;

    INSERT INTO cancellation_records (meeting_id, cancelled_by, tier, reason, free_pass_used, group_key)
    VALUES (v_pair.id, v_caller, v_tier, p_reason, v_free_pass, v_group_key);

    INSERT INTO notifications (user_id, type, data)
    VALUES (v_pair.participant_b, 'meeting_cancelled', jsonb_build_object(
      'meeting_id', v_pair.id,
      'cancelled_by', v_caller,
      'scheduled_time', v_meeting.scheduled_time,
      'reason', p_reason
    ));
  END LOOP;

  -- Pending invitations on a withdrawn time must not linger as actionable.
  UPDATE prompt_invitations
  SET state = 'cancelled', resolved_at = NOW()
  WHERE slot_id = v_meeting.slot_id AND state = 'pending';

  -- Withdraw the time itself.
  UPDATE time_slots
  SET retired_at = NOW(), accepted = FALSE
  WHERE id = v_meeting.slot_id;

  RETURN QUERY
  SELECT v_tier, m.participant_b
  FROM cancellation_records cr
  JOIN meetings m ON m.id = cr.meeting_id
  WHERE cr.group_key = v_group_key;
END;
$$;

COMMENT ON FUNCTION cancel_gathering(UUID, TEXT) IS
  'Host-only whole-gathering cancellation: cancels every scheduled pair on the anchor meeting''s slot in one act (one tier, one reason, one free-pass), notifies every joiner, resolves pending invitations, retires the slot. Returns (tier, joiner_id) per cancelled pair for app-layer email fan-out.';

REVOKE EXECUTE ON FUNCTION cancel_gathering FROM public;
GRANT EXECUTE ON FUNCTION cancel_gathering TO authenticated;
