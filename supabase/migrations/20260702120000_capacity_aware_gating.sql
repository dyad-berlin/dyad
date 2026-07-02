-- Capacity-aware membership gating (plan: granular gating).
--
-- The two meeting-flow gated actions split by the TARGET conversation's size so
-- a one-on-one and a group can be gated INDEPENDENTLY. Size = prompts.capacity
-- (1 = one-on-one; NULL or 2..7 = group). create_conversation stays size-agnostic.
--
-- app.gating_allows(action, identity) is UNCHANGED — its quota clause is
-- load-bearing (20260701120000). Callers now hand it a size-scoped action string
-- ('respond_take_slot_1on1' / '_group', 'invite_to_meet_1on1' / '_group')
-- computed from the target prompt's capacity. Two new helper functions do that
-- derivation inside the RLS FOR INSERT policies and the accept_invitation body,
-- and the two INSERT policies + the RPC gate call are recreated to use them.
--
-- One logical change. Idempotent / rerunnable: CREATE OR REPLACE for functions,
-- DROP POLICY IF EXISTS + CREATE for the two recreated policies, CREATE OR
-- REPLACE for the RPC. app.gating_allows, app.has_active_membership,
-- app.free_gated_actions_used, and the create_conversation / prompts INSERT
-- policy are NOT touched.

-- ── app.prompt_capacity(prompt) — read a conversation's size for the gate ──
-- SECURITY DEFINER so the capacity read is not subject to the caller's RLS (a
-- responder cannot SELECT the prompt row otherwise). STABLE, search_path public,
-- and NO auth.uid() in the body — mirrors the sibling gate functions
-- (has_active_membership / gating_allows / free_gated_actions_used). No row =>
-- NULL, which app.gating_action_for_capacity maps to the GROUP action.
CREATE OR REPLACE FUNCTION app.prompt_capacity(p_prompt_id TEXT)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT capacity FROM prompts WHERE id = p_prompt_id
$$;

REVOKE EXECUTE ON FUNCTION app.prompt_capacity(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION app.prompt_capacity(TEXT) TO authenticated, service_role;

-- ── app.gating_action_for_capacity(base, cap) — SQL twin of the TS mapper ──
-- Returns the size-scoped action string: capacity 1 => '<base>_1on1'; anything
-- else (NULL / >=2) => '<base>_group'. IMMUTABLE, plain sql — pure text math, no
-- table reads. The result is fed to app.gating_allows unchanged.
CREATE OR REPLACE FUNCTION app.gating_action_for_capacity(p_base TEXT, p_capacity INT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
	SELECT p_base || CASE WHEN p_capacity = 1 THEN '_1on1' ELSE '_group' END
$$;

REVOKE EXECUTE ON FUNCTION app.gating_action_for_capacity(TEXT, INT) FROM public;
GRANT EXECUTE ON FUNCTION app.gating_action_for_capacity(TEXT, INT) TO authenticated, service_role;

-- ── prompt_comments INSERT policy: size-scoped respond_take_slot gate ──
-- prompt_id is the inserted row's own column; app.prompt_capacity reads that
-- conversation's size, and app.gating_action_for_capacity picks the 1on1/group
-- action handed to the (unchanged) app.gating_allows.
DROP POLICY IF EXISTS "Authors create gated comments" ON prompt_comments;
CREATE POLICY "Authors create gated comments" ON prompt_comments FOR INSERT
	WITH CHECK (
		app.current_user_id() = author_id
		AND app.gating_allows(
			app.gating_action_for_capacity('respond_take_slot', app.prompt_capacity(prompt_id)),
			app.current_user_id()
		)
	);

-- ── prompt_invitations INSERT policy: size-scoped invite_to_meet gate ──
DROP POLICY IF EXISTS "Inviter creates gated invitations" ON prompt_invitations;
CREATE POLICY "Inviter creates gated invitations" ON prompt_invitations FOR INSERT
	WITH CHECK (
		app.current_user_id() = inviter_id
		AND app.gating_allows(
			app.gating_action_for_capacity('invite_to_meet', app.prompt_capacity(prompt_id)),
			app.current_user_id()
		)
	);

-- ── accept_invitation: size-scoped "take a slot" gate ──
-- Reproduces the full body of 20260624120500 (the authoritative version)
-- VERBATIM, changing ONLY the membership-gate call from the size-blind
-- app.gating_allows('respond_take_slot', v_caller) to the size-scoped
-- app.gating_allows(app.gating_action_for_capacity('respond_take_slot',
-- v_capacity), v_caller). The function already computes the conversation's
-- capacity into v_capacity for its capacity-cap check, but that SELECT sits
-- AFTER the gate. So this version moves the v_capacity fetch UP — to right after
-- the invitee-authorization check, before the gate — and the later capacity-cap
-- block reuses the already-fetched value (its own SELECT into v_capacity is
-- removed). No other logic changes: the idempotent return-existing branches
-- (Gate A/B), access-window guard, inviter-duplicate rejection, and capacity cap
-- are all preserved exactly.
CREATE OR REPLACE FUNCTION accept_invitation(p_invitation_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot_id UUID;
  v_invitee_id UUID;
  v_inviter_id UUID;
  v_prompt_id TEXT;
  v_slot_start TIMESTAMPTZ;
  v_slot_retired_at TIMESTAMPTZ;
  v_meeting_id UUID;
  v_caller UUID := app.current_user_id();
  v_existing_meeting_id UUID;
  v_existing_state TEXT;
  v_existing_invitee UUID;
  v_capacity INTEGER;
  v_active_on_slot INTEGER;
BEGIN
  -- Gate A: idempotent return-existing-meeting branch for sequential retries
  -- after a successful accept (double-tap, flaky network). Returns the same
  -- meeting_id without re-inserting the meeting or notification rows.
  SELECT state, invitee_id INTO v_existing_state, v_existing_invitee
  FROM prompt_invitations
  WHERE id = p_invitation_id;

  IF v_existing_state = 'accepted' THEN
    IF v_existing_invitee != v_caller THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    SELECT id INTO v_existing_meeting_id
    FROM meetings WHERE invitation_id = p_invitation_id;
    IF v_existing_meeting_id IS NULL THEN
      RAISE EXCEPTION 'Accepted invitation has no meeting';
    END IF;
    RETURN v_existing_meeting_id;
  END IF;

  SELECT slot_id, invitee_id, inviter_id, prompt_id
    INTO v_slot_id, v_invitee_id, v_inviter_id, v_prompt_id
  FROM prompt_invitations
  WHERE id = p_invitation_id AND state = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Gate B: race-safe re-check. A concurrent accept may have landed between
    -- Gate A's read and the FOR UPDATE here. Re-lock the row and resolve as
    -- idempotent if the caller is the same invitee.
    SELECT state, invitee_id INTO v_existing_state, v_existing_invitee
    FROM prompt_invitations
    WHERE id = p_invitation_id
    FOR UPDATE;

    IF v_existing_state = 'accepted' AND v_existing_invitee = v_caller THEN
      SELECT id INTO v_existing_meeting_id
      FROM meetings WHERE invitation_id = p_invitation_id;
      IF v_existing_meeting_id IS NULL THEN
        RAISE EXCEPTION 'Accepted invitation has no meeting';
      END IF;
      RETURN v_existing_meeting_id;
    END IF;

    RAISE EXCEPTION 'Invitation not found or not pending';
  END IF;

  IF v_invitee_id != v_caller THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Fetch the conversation's capacity up front: it scopes the membership gate
  -- (one-on-one vs group) below AND drives the capacity cap further down. NULL
  -- = legacy unlimited, treated as a group by app.gating_action_for_capacity.
  SELECT capacity INTO v_capacity FROM prompts WHERE id = v_prompt_id;

  -- Membership gate (R8/R10): taking a slot is a gated action, scoped to the
  -- conversation's size. RLS cannot reach this SECURITY DEFINER write, so the
  -- gate lives in the body. app.gating_allows returns true when the flag is off
  -- or the caller is active, so gating-off is a no-op. Distinct token mapped to
  -- a 403 membership_required at the service layer.
  IF NOT app.gating_allows(
    app.gating_action_for_capacity('respond_take_slot', v_capacity),
    v_caller
  ) THEN
    RAISE EXCEPTION 'membership_required';
  END IF;

  SELECT start_time, retired_at INTO v_slot_start, v_slot_retired_at
  FROM time_slots WHERE id = v_slot_id FOR UPDATE;

  IF v_slot_start <= NOW() THEN
    UPDATE prompt_invitations
    SET state = 'expired', resolved_at = NOW()
    WHERE id = p_invitation_id;
    RETURN NULL;
  END IF;

  -- Retired slot: the author withdrew this time (whole-gathering cancel).
  -- Resolve the invitation like the full/duplicate cases — no meeting minted.
  IF v_slot_retired_at IS NOT NULL THEN
    UPDATE prompt_invitations
    SET state = 'cancelled', resolved_at = NOW()
    WHERE id = p_invitation_id;
    RETURN NULL;
  END IF;

  -- Access-window guard (plan R12): neither party can commit to a meeting
  -- that starts after their access window ends. NULL access_expires_at =
  -- permanent member, never blocks. Distinct error token mapped to friendly
  -- copy at the service layer.
  PERFORM 1 FROM profiles
  WHERE id IN (v_invitee_id, v_inviter_id)
    AND access_expires_at IS NOT NULL
    AND access_expires_at < v_slot_start;
  IF FOUND THEN
    RAISE EXCEPTION 'slot_beyond_access_window';
  END IF;

  -- Reject when the inviter already has an active meeting on this slot.
  SELECT id INTO v_existing_meeting_id
  FROM meetings
  WHERE slot_id = v_slot_id
    AND participant_b = v_inviter_id
    AND state IN ('scheduled', 'awaiting_feedback', 'completed')
  LIMIT 1;

  IF v_existing_meeting_id IS NOT NULL THEN
    UPDATE prompt_invitations
    SET state = 'cancelled', resolved_at = NOW()
    WHERE id = p_invitation_id;
    RETURN NULL;
  END IF;

  -- Capacity cap: a slot hosts at most `capacity` accepted meetings (joiners).
  -- NULL = legacy unlimited. Seat-occupancy uses (scheduled, awaiting_feedback)
  -- — deliberately NOT the inviter-duplicate guard's set above (which includes
  -- 'completed'); a 'completed' meeting cannot exist on a still-future slot,
  -- where accepts happen. Same shape as the inviter-duplicate rejection so the
  -- caller cannot distinguish "already joined" from "full" by side effect.
  -- v_capacity was fetched above (it also scopes the membership gate).
  IF v_capacity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_active_on_slot
    FROM meetings
    WHERE slot_id = v_slot_id
      AND state IN ('scheduled', 'awaiting_feedback');

    IF v_active_on_slot >= v_capacity THEN
      UPDATE prompt_invitations
      SET state = 'cancelled', resolved_at = NOW()
      WHERE id = p_invitation_id;
      RETURN NULL;
    END IF;
  END IF;

  UPDATE time_slots SET accepted = TRUE WHERE id = v_slot_id;
  UPDATE prompt_invitations
  SET state = 'accepted', resolved_at = NOW()
  WHERE id = p_invitation_id;

  INSERT INTO meetings (invitation_id, prompt_id, participant_a, participant_b,
                        slot_id, scheduled_time, duration_minutes)
  SELECT pi.id, pi.prompt_id, pi.invitee_id, pi.inviter_id,
         pi.slot_id, ts.start_time, ts.duration_minutes
  FROM prompt_invitations pi
  JOIN time_slots ts ON ts.id = pi.slot_id
  WHERE pi.id = p_invitation_id
  RETURNING id INTO v_meeting_id;

  INSERT INTO notifications (user_id, type, data)
  VALUES (v_inviter_id, 'meeting_response', jsonb_build_object(
    'kind', 'accepted',
    'invitation_id', p_invitation_id,
    'meeting_id', v_meeting_id,
    'prompt_id', v_prompt_id,
    'accepted_by', v_invitee_id,
    'scheduled_time', v_slot_start
  ));

  RETURN v_meeting_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION accept_invitation FROM public;
GRANT EXECUTE ON FUNCTION accept_invitation TO authenticated;
