-- Activate reputation_signals for one-on-one meeting feedback (feat: feature
-- feedback on profile).
--
-- reputation_signals has existed since 20260401_create_feedback_forms.sql
-- with exactly the shape this needs (owner-toggleable visible, JSONB content,
-- "anyone authenticated reads visible signals") but nothing has ever written
-- to it. This migration:
--
--   1. Extends submit_feedback() to snapshot a 'feedback_received' signal for
--      the REVIEWEE the moment both parties' forms lock (simultaneous reveal).
--      A snapshot, not a live reference to feedback_forms — the reviewer can
--      still edit their form's content columns after locking (RLS has no
--      state check, see 20260417100100), so copying the quote/tags at
--      lock-time means a later edit can't retroactively change what the
--      reviewee already chose to feature. No anti-tamper trigger needed,
--      unlike public_feedback's promote flow (20260716120000): there's
--      nothing live to tamper with.
--   2. Backfills signals for meetings whose feedback already locked before
--      this migration shipped.
--   3. Locks writes to a DEFINER RPC (set_reputation_signal_visibility),
--      matching promote_public_feedback (20260715120300): the existing
--      "Profile owner toggles feedback visibility" RLS UPDATE policy has no
--      column restriction, so a raw PATCH could rewrite content/signal_type,
--      not just visible. REVOKE + RPC-only closes that the same way
--      lock_public_feedback_writes.sql closed it for public_feedback.
--
-- Consent model (per product decision): the reviewer is never attributed by
-- name even in the private reveal today (RevealedFeedback carries no
-- identity), so featuring publicly extends the AUDIENCE of already-anonymous
-- content, not its anonymity. The reviewee's choice alone gates visibility —
-- no separate reviewer opt-in. A member may feature more than one past
-- feedback item at once (a curated list, not a single slot).

-- One signal per (profile, meeting) — re-locking a form (there is no such
-- path today, but the constraint documents the invariant) must not duplicate.
ALTER TABLE reputation_signals
  ADD CONSTRAINT uq_reputation_signal_profile_meeting_type
  UNIQUE (profile_id, source_meeting_id, signal_type);

-- ============================================
-- submit_feedback — now also snapshots a reputation_signals row on lock
-- ============================================

CREATE OR REPLACE FUNCTION submit_feedback(
  p_form_id UUID,
  p_did_meet BOOLEAN,
  p_no_show_reason TEXT DEFAULT NULL,
  p_rating_tags TEXT[] DEFAULT '{}',
  p_free_text TEXT DEFAULT NULL,
  p_share_with_person TEXT DEFAULT NULL,
  p_share_with_platform TEXT DEFAULT NULL,
  p_platform_comments TEXT DEFAULT NULL
)
RETURNS TEXT  -- returns new state: 'submitted' or 'locked'
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form feedback_forms%ROWTYPE;
  v_other_form feedback_forms%ROWTYPE;
  v_new_state TEXT;
BEGIN
  -- Lock this form
  SELECT * INTO v_form FROM feedback_forms
  WHERE id = p_form_id AND state IN ('due', 'submitted')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Form not found or not editable';
  END IF;

  IF v_form.reviewer_id != (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Validate minimum: did_meet is required
  IF p_did_meet IS NULL THEN
    RAISE EXCEPTION 'did_meet is required';
  END IF;

  -- Validate rating_tags against vocabulary
  IF array_length(p_rating_tags, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(p_rating_tags) AS tag
      WHERE tag NOT IN (SELECT word FROM adjective_vocabulary WHERE active = TRUE)
    ) THEN
      RAISE EXCEPTION 'Invalid rating tag(s)';
    END IF;
    IF array_length(p_rating_tags, 1) > 5 THEN
      RAISE EXCEPTION 'Maximum 5 rating tags allowed';
    END IF;
  END IF;

  -- Update form content
  UPDATE feedback_forms SET
    did_meet = p_did_meet,
    no_show_reason = p_no_show_reason,
    rating_tags = p_rating_tags,
    free_text = p_free_text,
    share_with_person = p_share_with_person,
    share_with_platform = p_share_with_platform,
    platform_comments = p_platform_comments,
    state = 'submitted',
    submitted_at = COALESCE(submitted_at, NOW())
  WHERE id = p_form_id;

  -- Check if the other party's form is also submitted
  SELECT * INTO v_other_form FROM feedback_forms
  WHERE meeting_id = v_form.meeting_id AND reviewer_id = v_form.reviewee_id
  FOR UPDATE;

  IF v_other_form.state = 'submitted' THEN
    -- Both submitted! Lock both forms simultaneously
    UPDATE feedback_forms SET state = 'locked', locked_at = NOW()
    WHERE meeting_id = v_form.meeting_id AND state = 'submitted';

    -- Transition meeting to completed
    UPDATE meetings SET state = 'completed', resolved_at = NOW()
    WHERE id = v_form.meeting_id AND state = 'awaiting_feedback';

    -- Snapshot a feedback_received signal for EACH reviewee (both directions
    -- of this meeting just locked). ON CONFLICT is belt-and-suspenders: the
    -- unique constraint above already makes this idempotent against retries.
    INSERT INTO reputation_signals (profile_id, signal_type, source_meeting_id, visible, content)
    SELECT
      f.reviewee_id,
      'feedback_received',
      f.meeting_id,
      FALSE,
      jsonb_build_object(
        'feedback_form_id', f.id,
        'quote', f.share_with_person,
        'tags', to_jsonb(f.rating_tags)
      )
    FROM feedback_forms f
    WHERE f.meeting_id = v_form.meeting_id AND f.state = 'locked'
    ON CONFLICT (profile_id, source_meeting_id, signal_type) DO NOTHING;

    v_new_state := 'locked';
  ELSE
    v_new_state := 'submitted';
  END IF;

  RETURN v_new_state;
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_feedback FROM public;
GRANT EXECUTE ON FUNCTION submit_feedback TO authenticated;

-- ============================================
-- Backfill — meetings whose feedback locked before this migration
-- ============================================

INSERT INTO reputation_signals (profile_id, signal_type, source_meeting_id, visible, content)
SELECT
  f.reviewee_id,
  'feedback_received',
  f.meeting_id,
  FALSE,
  jsonb_build_object(
    'feedback_form_id', f.id,
    'quote', f.share_with_person,
    'tags', to_jsonb(f.rating_tags)
  )
FROM feedback_forms f
WHERE f.state = 'locked'
ON CONFLICT (profile_id, source_meeting_id, signal_type) DO NOTHING;

-- ============================================
-- Lock reputation_signals writes to a DEFINER RPC (visibility toggle only)
-- ============================================

REVOKE UPDATE ON reputation_signals FROM authenticated;
DROP POLICY IF EXISTS "Profile owner toggles feedback visibility" ON reputation_signals;

-- The profile owner flips visible on their own feedback_received signal.
-- RETURNS boolean (like promote_public_feedback): the endpoint answers 403
-- on FALSE without a RAISE round-trip.
CREATE OR REPLACE FUNCTION set_reputation_signal_visibility(
  p_signal_id UUID,
  p_visible BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := app.current_user_id();
  v_updated UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE reputation_signals SET
    visible = p_visible
  WHERE id = p_signal_id
    AND profile_id = v_caller
    AND signal_type = 'feedback_received'
  RETURNING id INTO v_updated;

  RETURN v_updated IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_reputation_signal_visibility(UUID, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION set_reputation_signal_visibility(UUID, BOOLEAN) TO authenticated;

COMMENT ON TABLE reputation_signals IS
  'Profile-facing trust signals. Today: feedback_received, one snapshot per (profile, meeting) taken from feedback_forms at simultaneous-reveal lock time (content is a copy, not a live reference — later edits to the source form do not change an already-featured signal). visible defaults FALSE; the profile owner alone toggles it via set_reputation_signal_visibility (DEFINER RPC — no direct UPDATE grant). Anonymous: the reviewer is never named, matching the private reveal. Visible signals are readable by any authenticated user (profile display); cancellation/no_show signal_types are reserved, unused today.';
