-- Public feedback edge + gathering-level meet-again (feat: unified gathering
-- feedback, U3).
--
-- KTD5 — GRADUATED, LEAST-PRIVILEGE PUBLIC VISIBILITY. `public_feedback` is the
-- any-to-any experiential edge: any co-present participant may leave tags + free
-- text about any other co-present participant. This is what delivers
-- joiner<->joiner edges the legacy author<->joiner star (group_feedback) could
-- never represent. There is NO numeric/star rating anywhere — tags only.
--
-- Visibility starts at LEAST PRIVILEGE (R11):
--   * On submit a row is visible to its REVIEWER (own rows) and to the SUBJECT
--     (reviewee_id = app.current_user_id()) — the person it is about sees it by
--     default. No one else can read it.
--   * Only the SUBJECT can PROMOTE it, by setting made_public_at (a column-level
--     UPDATE grant + a reviewee-only UPDATE policy — the reviewer cannot edit
--     after submit, and no one but the subject can promote).
--   * Once made_public_at IS NOT NULL, a broader read opens — kept MINIMAL:
--     co-participants of the same gathering may read it.
--
-- KTD4 — the public-feedback gate is ACTUAL TURNOUT (app.both_present), in
-- contrast to the safety-concern gate (scheduled co-membership, turnout-blind):
-- experiential feedback requires that BOTH people actually turned up. The INSERT
-- WITH CHECK constrains the TARGET (both reviewer and reviewee present), not just
-- the actor.
--
-- KTD8 — identity basis is `identities`, resolved via app.current_user_id() (the
-- vendor-neutrality wrapper), never auth.uid() directly.
--
-- Tag-vocabulary validation is DEFERRED to the U5 service layer: the existing
-- `feedback_forms.rating_tags` is validated inside the submit_feedback RPC
-- (20260401_create_feedback_forms.sql), NOT by a DB-level CHECK — there is no
-- clean array-subset constraint pattern in this repo. public_feedback follows
-- that same convention: the submit_public_feedback RPC (U5) validates each tag
-- against `adjective_vocabulary` (active) and caps the tag count. No DB-level
-- tag constraint here.
--
-- Origin: docs/plans/2026-07-15-001-feat-unified-gathering-feedback-plan.md
-- (R7, R11, KTD5, KTD2, KTD4).

-- ============================================
-- PUBLIC_FEEDBACK — any-to-any experiential edge, least-privilege visibility
-- ============================================

CREATE TABLE IF NOT EXISTS public_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE RESTRICT (safeguarding-adjacent durability — mirrors U2's
  -- reasoning): a public record about a person must not silently vanish when a
  -- slot/prompt is torn down. gatherings.slot_id is ON DELETE CASCADE and an
  -- author can deletePrompt(), so CASCADE here would let a subject of unflattering
  -- feedback erase it by deleting the prompt. A gathering with public feedback is
  -- pinned; deletion is governed by the retention policy (R9, a go-live gate).
  gathering_id UUID NOT NULL REFERENCES gatherings(id) ON DELETE RESTRICT,
  reviewer_id UUID NOT NULL REFERENCES identities(id) ON DELETE NO ACTION,
  reviewee_id UUID NOT NULL REFERENCES identities(id) ON DELETE NO ACTION,
  -- Tags drawn from adjective_vocabulary. NOT constrained at the DB level —
  -- validated in the U5 submit RPC (see header). No numeric rating column.
  tags TEXT[] NOT NULL DEFAULT '{}',
  -- Free text, length-capped (mirrors feedback_forms.free_text).
  free_text TEXT CHECK (free_text IS NULL OR char_length(free_text) <= 2000),
  -- NULL = subject-visible only (least privilege). Set by the SUBJECT to promote.
  -- how-public is an open question; minimal co-participant read for now.
  made_public_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One edge per (gathering, reviewer, reviewee).
  CONSTRAINT uq_public_feedback_edge UNIQUE (gathering_id, reviewer_id, reviewee_id),
  -- No self-review.
  CONSTRAINT public_feedback_no_self CHECK (reviewer_id <> reviewee_id)
);

-- Read hot paths: the subject's inbox (about-me), and co-participant reads of
-- promoted rows per gathering.
CREATE INDEX IF NOT EXISTS idx_public_feedback_reviewee ON public_feedback(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_public_feedback_gathering ON public_feedback(gathering_id);

-- ============================================
-- RLS — least-privilege visibility (R11)
-- ============================================
-- Mirrors the group_feedback / gatherings pattern: REVOKE ALL from the app roles
-- then GRANT back exactly the verbs each actor needs, so a future stray grant
-- cannot reopen a hole. Writes (INSERT content) are minted here directly by the
-- reviewer under the turnout gate; promotion is a column-scoped UPDATE by the
-- subject; content is otherwise immutable after submit.

ALTER TABLE public_feedback ENABLE ROW LEVEL SECURITY;

-- SELECT 1/3 — the reviewer reads the rows they wrote.
DROP POLICY IF EXISTS "Reviewer reads own public feedback" ON public_feedback;
CREATE POLICY "Reviewer reads own public feedback"
  ON public_feedback FOR SELECT TO authenticated
  USING (app.current_user_id() = reviewer_id);

-- SELECT 2/3 — the SUBJECT reads feedback about themselves by default (least
-- privilege, R11): the person it is about sees it even before promotion.
DROP POLICY IF EXISTS "Subject reads feedback about them" ON public_feedback;
CREATE POLICY "Subject reads feedback about them"
  ON public_feedback FOR SELECT TO authenticated
  USING (app.current_user_id() = reviewee_id);

-- SELECT 3/3 — once the subject has promoted a row (made_public_at set), a
-- broader read opens. Kept MINIMAL: co-participants of the same gathering only.
-- how-public is an open question; minimal co-participant read for now.
DROP POLICY IF EXISTS "Co-participants read promoted feedback" ON public_feedback;
CREATE POLICY "Co-participants read promoted feedback"
  ON public_feedback FOR SELECT TO authenticated
  USING (
    made_public_at IS NOT NULL
    AND app.is_gathering_participant(gathering_id)
  );

-- INSERT — the reviewer leaves feedback about a co-present participant. WITH
-- CHECK constrains the TARGET, not just the actor (KTD4, turnout gate):
--   * the actor is the reviewer,
--   * no self-review,
--   * BOTH the reviewer and the reviewee actually turned up (app.both_present).
DROP POLICY IF EXISTS "Reviewer leaves feedback about a co-present participant" ON public_feedback;
CREATE POLICY "Reviewer leaves feedback about a co-present participant"
  ON public_feedback FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = app.current_user_id()
    AND reviewer_id <> reviewee_id
    AND app.both_present(gathering_id, reviewer_id, reviewee_id)
  );

-- UPDATE — the SUBJECT promotes their own feedback. The USING/WITH CHECK gate
-- restricts the row set to the subject; the column-level GRANT UPDATE below
-- restricts the mutable surface to made_public_at ALONE. Together: only the
-- subject can update, and only to (un)set made_public_at. The reviewer holds no
-- UPDATE grant and fails the policy, so content is immutable after submit.
DROP POLICY IF EXISTS "Subject promotes feedback about them" ON public_feedback;
CREATE POLICY "Subject promotes feedback about them"
  ON public_feedback FOR UPDATE TO authenticated
  USING (app.current_user_id() = reviewee_id)
  WITH CHECK (app.current_user_id() = reviewee_id);

-- Pare the default app-role grants back to exactly the needed verbs. Column-level
-- UPDATE grant is the structural half of "subject can set ONLY made_public_at".
REVOKE ALL ON public_feedback FROM authenticated, anon;
GRANT SELECT ON public_feedback TO authenticated;
GRANT INSERT ON public_feedback TO authenticated;
GRANT UPDATE (made_public_at) ON public_feedback TO authenticated;

COMMENT ON TABLE public_feedback IS
  'Any-to-any experiential feedback edge for a gathering (tags from adjective_vocabulary + free text; NO numeric rating). Least-privilege visibility (R11): visible to reviewer and subject on submit; the SUBJECT alone promotes it via made_public_at (column-scoped UPDATE grant), after which co-participants of the gathering may read it. INSERT gated on app.both_present (both actually turned up). how-public is an open question; minimal co-participant read for now. Tag-vocabulary validation is in the U5 submit RPC (no DB-level CHECK, mirroring feedback_forms.rating_tags).';

-- ============================================
-- GATHERING_FEEDBACK — collect-only "meet again" soft signal
-- ============================================
-- R7: one row per reviewer per gathering carrying a "would you meet again"
-- answer. Collect-only — wired to NOTHING user-visible or match-affecting this
-- round (AE5). meet_again is BOOLEAN to match group_feedback.meet_again.
-- Owner-read only: the reviewer reads their own row; no one else can. Rows are
-- minted / written by SECURITY DEFINER RPCs in later units (U4 seeding, U5
-- submit) — no user INSERT/UPDATE grant here, same as gatherings/participation.

CREATE TABLE IF NOT EXISTS gathering_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gathering_id UUID NOT NULL REFERENCES gatherings(id) ON DELETE RESTRICT,
  reviewer_id UUID NOT NULL REFERENCES identities(id) ON DELETE NO ACTION,
  meet_again BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One meet-again row per reviewer per gathering.
  CONSTRAINT uq_gathering_feedback_per_reviewer UNIQUE (gathering_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_gathering_feedback_gathering ON gathering_feedback(gathering_id);

ALTER TABLE gathering_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviewer reads own gathering feedback" ON gathering_feedback;
CREATE POLICY "Reviewer reads own gathering feedback"
  ON gathering_feedback FOR SELECT TO authenticated
  USING (app.current_user_id() = reviewer_id);

-- No INSERT/UPDATE/DELETE for users — rows are minted and written only by the
-- SECURITY DEFINER RPCs (U4/U5). Pare the default app-role grants back to SELECT.
REVOKE ALL ON gathering_feedback FROM authenticated, anon;
GRANT SELECT ON gathering_feedback TO authenticated;

COMMENT ON TABLE gathering_feedback IS
  'Collect-only "would you meet again" soft signal: one row per reviewer per gathering. Owner-read only; wired to nothing user-visible or match-affecting this round (R7/AE5). Written by SECURITY DEFINER RPCs (U4/U5).';
