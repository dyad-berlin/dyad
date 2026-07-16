-- Enforce the safety-reporting kill-switch inside submit_concern (code-review
-- follow-up to #118, U5).
--
-- FINDING (P2, adversarial/security): the 'ships dark until Datenschutz cleared'
-- guarantee (R9) was enforced ONLY at the endpoint (getSafetyReportingEnabled ->
-- 403). submit_concern is GRANT EXECUTE TO authenticated and PostgREST-exposed, so
-- an authenticated user could POST /rest/v1/rpc/submit_concern directly and write
-- safety_concerns rows while safety_reporting_enabled = false — collecting
-- sensitive personal data before the legal basis / retention policy exists. Reads
-- stay confidential (no read path), so this is a go-live / data-protection gate
-- bypass, not a leak — but it defeats the explicit R9 control.
--
-- Re-enforce the flag in the RPC body, the same way every DEFINER RPC here
-- re-enforces its own gate rather than trusting the caller. Fail CLOSED: an absent
-- key reads as false (dark), mirroring getSafetyReportingEnabled(). app_settings is
-- service-role-only, but a SECURITY DEFINER function runs as the owner and can read
-- it regardless of the caller's grants.
--
-- Origin: docs/plans/2026-07-15-001-feat-unified-gathering-feedback-plan.md (R9, KTD4).

CREATE OR REPLACE FUNCTION submit_concern(
  p_slot UUID,
  p_scope TEXT,
  p_kind TEXT,
  p_subject UUID DEFAULT NULL,
  p_gathering UUID DEFAULT NULL,
  p_detail TEXT DEFAULT NULL
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

  -- Kill-switch (R9): the safeguarding store ships DARK. Fail closed — an absent
  -- key is treated as disabled, matching getSafetyReportingEnabled(). This is the
  -- structural half of the go-live gate; the endpoint check is defence in depth.
  IF COALESCE(
       (SELECT value FROM app_settings WHERE key = 'safety_reporting_enabled'),
       'false'::jsonb
     ) <> 'true'::jsonb THEN
    RAISE EXCEPTION 'Safety reporting is not enabled';
  END IF;

  IF p_scope NOT IN ('person', 'gathering') THEN
    RAISE EXCEPTION 'Invalid scope';
  END IF;
  IF p_kind NOT IN ('no_show', 'felt_unsafe', 'other') THEN
    RAISE EXCEPTION 'Invalid kind';
  END IF;

  -- scope <-> subject coherence (also a table CHECK; fail early with a clean msg).
  IF p_scope = 'person' AND p_subject IS NULL THEN
    RAISE EXCEPTION 'A person-scoped concern must name a subject';
  END IF;
  IF p_scope = 'gathering' AND p_subject IS NOT NULL THEN
    RAISE EXCEPTION 'A gathering-scoped concern must not name a subject';
  END IF;

  -- No self-report.
  IF p_subject IS NOT NULL AND p_subject = v_caller THEN
    RAISE EXCEPTION 'Cannot file a concern about yourself';
  END IF;

  IF p_detail IS NOT NULL AND char_length(p_detail) > 2000 THEN
    RAISE EXCEPTION 'detail too long';
  END IF;

  -- Scheduled co-membership gate (turnout-blind), constraining the TARGET.
  IF NOT app.is_slot_participant(v_caller, p_slot) THEN
    RAISE EXCEPTION 'Reporter is not a participant of this slot';
  END IF;
  IF p_subject IS NOT NULL AND NOT app.is_slot_participant(p_subject, p_slot) THEN
    RAISE EXCEPTION 'Subject is not a participant of this slot';
  END IF;

  INSERT INTO safety_concerns (slot_id, gathering_id, reporter_id, subject_id, scope, kind, detail)
  VALUES (p_slot, p_gathering, v_caller, p_subject, p_scope, p_kind, p_detail);
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_concern(UUID, TEXT, TEXT, UUID, UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION submit_concern(UUID, TEXT, TEXT, UUID, UUID, TEXT) TO authenticated;
