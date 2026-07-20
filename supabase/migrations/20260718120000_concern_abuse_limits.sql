-- Abuse limits on the safeguarding-concern submission path (code-review
-- follow-up to #57, from the PR #51 adversarial review).
--
-- FINDING (P2, adversarial): submit_concern validated the reporter, the target,
-- and the length, but had NO dedup and NO per-reporter cap. An authorised slot
-- participant could flood safety_concerns with identical or near-identical rows
-- (steward noise, storage) — the same shape of abuse the interim /report
-- endpoint was flagged for. The store is steward-only and confidential, so this
-- is a noise/quota problem, not a leak.
--
-- Two structural limits, both enforced INSIDE the SECURITY DEFINER RPC (the same
-- way the R9 kill-switch is re-enforced in-body rather than trusting the caller —
-- submit_concern is GRANT EXECUTE TO authenticated and PostgREST-exposed):
--
--   1. DEDUP — an exact-duplicate concern from the same reporter on the same slot
--      (same scope, kind, subject, and detail) is an idempotent NO-OP. Backed by
--      a UNIQUE INDEX so the guarantee is structural, not just a WHERE check; the
--      RPC catches unique_violation and returns cleanly (also covers the
--      concurrent-double-submit race). detail is hashed (md5) because a raw TEXT
--      column up to 2000 chars can exceed the btree key-size limit.
--
--   2. CAP — a reporter may file at most MAX_CONCERNS_PER_SLOT (20) DISTINCT
--      concerns on any one slot. Beyond that the RPC RAISEs 'concern_cap_reached';
--      the service maps that token to a clean 429 (SupabaseFeedbackService.
--      submitConcern) rather than a generic 500. Generous by design: a slot can
--      have several co-participants and three concern kinds, so legitimate use is
--      well under the ceiling — the cap only bites on flooding.
--
-- Everything else in the body is kept VERBATIM from
-- 20260716120100_enforce_concern_killswitch_in_rpc.sql (kill-switch, scope/kind
-- validation, self-report block, length cap, scheduled-co-membership gate).
--
-- One logical change: concern abuse limits. Idempotent (CREATE OR REPLACE +
-- CREATE UNIQUE INDEX IF NOT EXISTS). Prefers app.current_user_id() over
-- auth.uid() per the migration standard.
--
-- Origin: docs/plans/2026-07-15-001-feat-unified-gathering-feedback-plan.md (R9);
-- issue #57.

-- ── Structural dedup guarantee ──────────────────────────────────────────────
-- Exact-duplicate = same (reporter, slot, scope, kind, subject, detail). NULLs
-- folded via COALESCE so a gathering-scoped concern (subject_id NULL) and a
-- detail-less concern still participate in the uniqueness. detail is md5-hashed
-- to stay under the btree key limit.
CREATE UNIQUE INDEX IF NOT EXISTS uq_safety_concerns_reporter_dedup
  ON safety_concerns (
    reporter_id,
    slot_id,
    scope,
    kind,
    COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid),
    md5(COALESCE(detail, ''))
  );

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
  -- Per-reporter ceiling of DISTINCT concerns on one slot. Keep in sync with the
  -- cap referenced in tests/integration/*. A literal here mirrors the existing
  -- MAX_DETAIL duplication between this RPC and the endpoint — SQL and TS cannot
  -- share a constant.
  v_cap CONSTANT INTEGER := 20;
  v_existing INTEGER;
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

  -- ── Abuse limit: per-reporter cap of DISTINCT concerns on this slot (#57). ──
  -- Counts what this reporter has already filed on the slot. A duplicate that is
  -- about to be de-duped below does not add to this once filed, so the cap counts
  -- genuine distinct concerns. Not row-locked: a small over/under count under a
  -- flooding race is acceptable for a quota — correctness of the store is not at
  -- stake.
  SELECT COUNT(*) INTO v_existing
  FROM safety_concerns
  WHERE reporter_id = v_caller
    AND slot_id = p_slot;

  IF v_existing >= v_cap THEN
    RAISE EXCEPTION 'concern_cap_reached';
  END IF;

  -- ── Abuse limit: dedup identical concerns (#57). ──
  -- The unique index makes an exact-duplicate a no-op; catch the violation and
  -- return cleanly. This also collapses the concurrent-double-submit race to a
  -- single stored row.
  BEGIN
    INSERT INTO safety_concerns (slot_id, gathering_id, reporter_id, subject_id, scope, kind, detail)
    VALUES (p_slot, p_gathering, v_caller, p_subject, p_scope, p_kind, p_detail);
  EXCEPTION WHEN unique_violation THEN
    -- Identical concern already on file from this reporter — idempotent no-op.
    RETURN;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_concern(UUID, TEXT, TEXT, UUID, UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION submit_concern(UUID, TEXT, TEXT, UUID, UUID, TEXT) TO authenticated;
