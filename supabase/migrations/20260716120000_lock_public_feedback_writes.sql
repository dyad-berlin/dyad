-- Harden public_feedback write integrity (code-review follow-up to #118, U3/U5).
--
-- FINDING (P1, adversarial): public_feedback was the ONE table in the unified
-- gathering-feedback unit that granted INSERT/UPDATE directly to `authenticated`,
-- instead of REVOKE-ALL + DEFINER-RPC-only like gatherings / participation /
-- safety_concerns / gathering_feedback. The INSERT policy's WITH CHECK constrained
-- reviewer_id / no-self / both_present but did NOT pin made_public_at, and tag
-- validity lives only in the submit_public_feedback RPC. So a co-present reviewer
-- could POST /rest/v1/public_feedback directly with made_public_at = now() and
-- arbitrary (non-vocabulary) tags — self-promoting unconsented content to the
-- whole gathering via the "co-participants read promoted feedback" SELECT policy.
-- That defeats the least-privilege / subject-promotes model (R11, KTD5).
--
-- The app never writes the table directly — src/lib/services/feedback.ts routes
-- every write through the SECURITY DEFINER RPCs (submit_public_feedback,
-- promote_public_feedback), which bypass RLS and need no table grant. So revoking
-- the direct write grants closes the bypass with no effect on the real write path.
-- Reads are unchanged (GRANT SELECT + the three SELECT policies stay).
--
-- FINDING (P2, security/data-migration/adversarial): submit_public_feedback's
-- ON CONFLICT preserved made_public_at, so a reviewer could swap in different
-- content after the subject promoted the original — the subject consented to
-- specific text, not the substitute. Reset made_public_at on any content change.
--
-- Origin: docs/plans/2026-07-15-001-feat-unified-gathering-feedback-plan.md (R11, KTD5).

-- 1. Remove the direct write grants — writes now go only through the DEFINER RPCs,
--    matching every other table in the unit. Idempotent (REVOKE of an absent grant
--    is a no-op).
REVOKE INSERT ON public_feedback FROM authenticated;
REVOKE UPDATE ON public_feedback FROM authenticated;

-- 2. Drop the now-dead INSERT/UPDATE policies. Without a grant they are unreachable,
--    but leaving them advertises a direct-write path that no longer exists; dropping
--    them makes the DEFINER-RPC-only posture structural and self-documenting.
DROP POLICY IF EXISTS "Reviewer leaves feedback about a co-present participant" ON public_feedback;
DROP POLICY IF EXISTS "Subject promotes feedback about them" ON public_feedback;

-- 3. Content-change resets promotion. A subject's promotion consents to the content
--    that was present when they promoted it; if the reviewer later edits tags or
--    free_text, drop back to subject-visible-only so the subject must re-promote.
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
    free_text = EXCLUDED.free_text,
    -- Re-require subject promotion whenever the content actually changes. A no-op
    -- resubmit (identical content) leaves an existing promotion intact.
    made_public_at = CASE
      WHEN public_feedback.tags IS DISTINCT FROM EXCLUDED.tags
        OR public_feedback.free_text IS DISTINCT FROM EXCLUDED.free_text
      THEN NULL
      ELSE public_feedback.made_public_at
    END;
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_public_feedback(UUID, UUID, TEXT[], TEXT) FROM public;
GRANT EXECUTE ON FUNCTION submit_public_feedback(UUID, UUID, TEXT[], TEXT) TO authenticated;

COMMENT ON TABLE public_feedback IS
  'Any-to-any experiential feedback edge for a gathering (tags from adjective_vocabulary + free text; NO numeric rating). Writes are DEFINER-RPC-only (submit_public_feedback / promote_public_feedback) — no direct INSERT/UPDATE grant, matching every other table in the unit. Least-privilege visibility (R11): visible to reviewer and subject on submit; the SUBJECT alone promotes it via made_public_at, after which co-participants of the gathering may read it; editing content resets promotion. INSERT gated on app.both_present (both actually turned up).';
