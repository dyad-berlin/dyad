-- Self-report primacy in host turnout attestation (code-review follow-up to #118, U5).
--
-- FINDING (P2, correctness/adversarial): the U6 form defaults every roster member
-- to "present" and sends the whole hostTurnout map when the host self-reports
-- 'attended'. submit_attendance then UPDATEd turned_up unconditionally for each
-- entry. So a routine host submission — with no intent to dispute anyone — flips a
-- co-participant who had already self-reported 'cancelled_before'/'absent' back to
-- turned_up = true, stamped attested_by = host. Because turned_up feeds
-- app.both_present (the public_feedback INSERT gate) and app.gathering_happened,
-- this corrupts the model's turnout primitive: public feedback becomes writable
-- about someone who declared they were not there, and a no-show gathering can read
-- as happened.
--
-- Fix: host attestation only fills turnout for members who have NOT spoken for
-- themselves (self_report IS NULL). A member's own self-report wins over the host's
-- bulk default. The genuine host-vs-subject attestation conflict (host asserts a
-- self-reported member was actually absent, or vice versa) stays deferred per the
-- plan — this only stops the silent clobber, it does not add a resolution path.
--
-- Origin: docs/plans/2026-07-15-001-feat-unified-gathering-feedback-plan.md (R10, KTD4).

CREATE OR REPLACE FUNCTION submit_attendance(
  p_gathering UUID,
  p_self_report TEXT,
  p_absence_reason TEXT DEFAULT NULL,
  p_turnout JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := app.current_user_id();
  v_is_host BOOLEAN;
  v_key TEXT;
  v_val TEXT;
  v_member UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_self_report IS NULL OR p_self_report NOT IN ('attended', 'cancelled_before', 'absent') THEN
    RAISE EXCEPTION 'Invalid self_report';
  END IF;

  -- Caller must be a participant of this gathering. Lock the row for the update.
  SELECT is_host INTO v_is_host
  FROM participation
  WHERE gathering_id = p_gathering AND member_id = v_caller
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a participant of this gathering';
  END IF;

  -- The caller's OWN row: self-report + derived turnout. absence_reason is only
  -- meaningful for an 'absent' report; clear it otherwise.
  UPDATE participation SET
    self_report = p_self_report,
    turned_up = (p_self_report = 'attended'),
    absence_reason = CASE WHEN p_self_report = 'absent' THEN p_absence_reason ELSE NULL END
  WHERE gathering_id = p_gathering AND member_id = v_caller;

  -- Host-only attestation of OTHERS' turnout.
  IF p_turnout IS NOT NULL AND jsonb_typeof(p_turnout) = 'object' THEN
    IF NOT v_is_host THEN
      RAISE EXCEPTION 'Only the host may attest others';
    END IF;

    FOR v_key, v_val IN SELECT key, value FROM jsonb_each_text(p_turnout)
    LOOP
      v_member := v_key::UUID;
      -- The caller's own row is set via self_report above, not via attestation.
      IF v_member = v_caller THEN
        CONTINUE;
      END IF;
      -- attested_by must be a genuine co-participant relationship: the target
      -- must itself be a participant of this gathering.
      IF NOT EXISTS (
        SELECT 1 FROM participation
        WHERE gathering_id = p_gathering AND member_id = v_member
      ) THEN
        RAISE EXCEPTION 'Attested member is not a participant of this gathering';
      END IF;
      -- Self-report primacy: the host's bulk turnout only fills members who have
      -- NOT self-reported. A member who declared their own attendance is not
      -- silently overwritten by the form's default-everyone-present map. (The
      -- WHERE self_report IS NULL clause is the whole fix — see header.)
      UPDATE participation SET
        turned_up = (v_val::BOOLEAN),
        attested_by = v_caller
      WHERE gathering_id = p_gathering
        AND member_id = v_member
        AND self_report IS NULL;
    END LOOP;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_attendance(UUID, TEXT, TEXT, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION submit_attendance(UUID, TEXT, TEXT, JSONB) TO authenticated;
