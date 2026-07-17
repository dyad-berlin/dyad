-- Write path for unified gathering feedback (feat: unified gathering feedback, U5).
--
-- The server write surface for the tables built in U1–U3: attendance
-- (participation), public feedback (public_feedback), subject-promotion, and
-- confidential safeguarding concerns (safety_concerns). All four are SECURITY
-- DEFINER RPCs mirroring submit_group_feedback / submit_feedback
-- (20260529100300, 20260401): keyed on app.current_user_id() (the
-- vendor-neutrality wrapper — never auth.uid()), SET search_path = public.
--
-- Because a SECURITY DEFINER function BYPASSES RLS, each RPC RE-ENFORCES its
-- table's gate in its own body — it does not lean on the WITH CHECK policy:
--   * submit_attendance   — caller must be a participant; only the HOST may
--                           attest OTHERS' turnout (p_turnout), and only for
--                           genuine co-participants (this is where U1's deferred
--                           attestation semantics land). participation has NO
--                           user write grant, so this DEFINER path is the only
--                           way a member records attendance.
--   * submit_public_feedback — turnout gate (app.both_present); tags validated
--                           against adjective_vocabulary (active) and capped
--                           (the tag-vocabulary validation U3 deferred to here,
--                           mirroring submit_feedback's rating_tags check).
--   * promote_public_feedback — subject-only; RETURNS boolean so the endpoint
--                           can answer 403 without a RAISE round-trip.
--   * submit_concern      — scheduled co-membership gate (app.is_slot_participant,
--                           turnout-blind); constrains the TARGET (reporter AND
--                           subject must be slot participants), not just the actor.
--                           The reporting kill-switch is an APP-layer check
--                           (getSafetyReportingEnabled → app_settings), not here.
--
-- Origin: docs/plans/2026-07-15-001-feat-unified-gathering-feedback-plan.md
-- (R1, R5, R10, R11, KTD4).

-- ============================================
-- submit_attendance — self-report + host turnout attestation
-- ============================================
-- The caller records their OWN participation (self_report + derived turned_up).
-- turned_up is DERIVED, never asserted directly: turned_up := (self_report =
-- 'attended'). If the caller is the host, p_turnout is a JSON map of
-- member_id -> bool letting them attest OTHERS' turnout, stamping attested_by =
-- caller. Only the host may attest others; every attested member must be a
-- genuine co-participant of the gathering.

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
      UPDATE participation SET
        turned_up = (v_val::BOOLEAN),
        attested_by = v_caller
      WHERE gathering_id = p_gathering AND member_id = v_member;
    END LOOP;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_attendance(UUID, TEXT, TEXT, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION submit_attendance(UUID, TEXT, TEXT, JSONB) TO authenticated;

-- ============================================
-- submit_public_feedback — any-to-any experiential edge (subject-visible)
-- ============================================
-- Writes a public_feedback row about a co-present participant. The turnout gate
-- (app.both_present) requires BOTH the reviewer and the reviewee actually turned
-- up. Tags are validated against adjective_vocabulary (active) and capped — the
-- validation U3 deferred to this layer (mirroring submit_feedback's rating_tags).
-- Re-submitting the same edge updates its content (made_public_at is preserved).

CREATE OR REPLACE FUNCTION submit_public_feedback(
  p_gathering UUID,
  p_reviewee UUID,
  p_tags TEXT[] DEFAULT '{}',
  p_free_text TEXT DEFAULT NULL
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

  IF p_reviewee IS NULL OR p_reviewee = v_caller THEN
    RAISE EXCEPTION 'Invalid reviewee';
  END IF;

  -- Tag-vocabulary validation (deferred here from U3). Cap at 10.
  IF array_length(p_tags, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(p_tags) AS tag
      WHERE tag NOT IN (SELECT word FROM adjective_vocabulary WHERE active = TRUE)
    ) THEN
      RAISE EXCEPTION 'Invalid tag(s)';
    END IF;
    IF array_length(p_tags, 1) > 10 THEN
      RAISE EXCEPTION 'Too many tags (max 10)';
    END IF;
  END IF;

  IF p_free_text IS NOT NULL AND char_length(p_free_text) > 2000 THEN
    RAISE EXCEPTION 'free_text too long';
  END IF;

  -- Turnout gate (KTD4): both people must have actually turned up.
  IF NOT app.both_present(p_gathering, v_caller, p_reviewee) THEN
    RAISE EXCEPTION 'Both participants must have turned up';
  END IF;

  INSERT INTO public_feedback (gathering_id, reviewer_id, reviewee_id, tags, free_text)
  VALUES (p_gathering, v_caller, p_reviewee, COALESCE(p_tags, '{}'), p_free_text)
  ON CONFLICT (gathering_id, reviewer_id, reviewee_id) DO UPDATE SET
    tags = EXCLUDED.tags,
    free_text = EXCLUDED.free_text;
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_public_feedback(UUID, UUID, TEXT[], TEXT) FROM public;
GRANT EXECUTE ON FUNCTION submit_public_feedback(UUID, UUID, TEXT[], TEXT) TO authenticated;

-- ============================================
-- promote_public_feedback — subject-only visibility promotion
-- ============================================
-- The SUBJECT (reviewee) of a public_feedback row sets made_public_at. RETURNS
-- boolean: TRUE if a subject-owned row was promoted, FALSE otherwise — the
-- endpoint answers 403 on FALSE without a RAISE. RLS also enforces subject-only
-- promotion; this keeps the RPC minimal (KTD5, R11).

CREATE OR REPLACE FUNCTION promote_public_feedback(
  p_feedback_id UUID
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

  UPDATE public_feedback SET
    made_public_at = now()
  WHERE id = p_feedback_id AND reviewee_id = v_caller
  RETURNING id INTO v_updated;

  RETURN v_updated IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION promote_public_feedback(UUID) FROM public;
GRANT EXECUTE ON FUNCTION promote_public_feedback(UUID) TO authenticated;

-- ============================================
-- submit_concern — confidential safeguarding report (insert-only)
-- ============================================
-- Inserts a safety_concerns row. The gate is SCHEDULED CO-MEMBERSHIP
-- (app.is_slot_participant), turnout-BLIND: a no-show is reportable though the
-- subject was absent. The gate constrains the TARGET — both reporter and (when
-- named) subject must be slot participants — not just the actor (KTD4). The
-- reporting kill-switch is an app-layer check at the endpoint, not here.

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

-- ============================================
-- Reporting kill-switch seed (app-layer gate)
-- ============================================
-- The safeguarding store is sensitive personal data: it must ship DARK until
-- retention + Datenschutz are cleared (R9, a go-live gate). Seed the flag OFF so
-- getSafetyReportingEnabled() (src/lib/server/app-settings.ts) fails closed; the
-- admin /admin/settings surface flips it (a later unit). Absent-key reads already
-- default to false, so this seed is for discoverability, not correctness.
INSERT INTO app_settings (key, value)
VALUES ('safety_reporting_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
