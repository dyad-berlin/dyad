-- Free-interaction quota (plan 2b / U2) — the first N gated actions are free.
--
-- A registered guest may perform up to N gated actions (create a conversation,
-- respond / take a slot, invite to meet) BEFORE a membership is required. N is
-- operator-configurable at runtime via app_settings key 'free_interaction_quota'.
--
-- LAUNCH DEFAULT is 0: the gate is pure members-only from the first gated action,
-- and the free-quota machinery ships DORMANT. An operator can raise N later, once
-- the live-count design properties below (delete-then-recreate; cross-transaction
-- concurrency) are settled — at N=0 those findings are moot. Raising N turns the
-- hard "gated ⇒ members only" wall into a soft taste-before-you-pay allowance,
-- expressed entirely as configuration (R9).
--
-- "Used" is computed LIVE from the actor's existing gated artifacts — there is
-- NO mutable counter and NO increment step. This is deliberate: the app-layer
-- gate (require-membership.ts) and this RLS safety net must agree on the SAME
-- decision, and a stored counter would open a timing race between the endpoint's
-- pre-check and the RLS WITH CHECK at INSERT. A live COUNT over the same three
-- actor-keyed tables both layers read avoids that split.
--
-- Two known properties of this live-count design (NOT bugs — bounded and
-- intentional, documented here so nobody "fixes" them into a serialization cost):
--
--   * Single-insert off-by-one is safe by construction. The WITH CHECK on a
--     FOR INSERT policy evaluates BEFORE the row is visible to the function's
--     own COUNT (MVCC), so the in-flight row is NOT self-counted: at used=N-1
--     the insert is allowed, at used=N it is rejected. This is the exact
--     boundary the KTD2 integration test pins. It is scoped to a SINGLE insert.
--   * Cross-transaction concurrency is NOT serialized. K concurrent inserts
--     that each observe used=N-1 can all pass their own WITH CHECK, yielding up
--     to N-1+K rows — a bounded soft-paywall leak. We accept this: the gate is a
--     soft allowance, not a payment wall, and serializing it (advisory lock /
--     SERIALIZABLE) would cost every gated insert. Do NOT add locking here.
--   * The quota counts CURRENTLY-EXISTING artifacts. Hard-deleting a gated
--     artifact frees quota, so delete-then-recreate is unbounded. Marked as a
--     known property pending a product decision (soft-delete / tombstone vs.
--     accept). The KTD2 test pins this behaviour so a future change is deliberate.
--
-- One logical change: (a) seed the quota key; (b) add the live-count function;
-- (c) fold the quota allowance into app.gating_allows. The function and the
-- gate keep the security posture of their siblings (SECURITY DEFINER, STABLE,
-- search_path public, no auth.uid() in body, REVOKE public + GRANT the two roles).

-- (a) Seed the quota. Stored as a JSONB number; absent/invalid reads COALESCE
-- to 0 at every read site (getFreeInteractionQuota and gating_allows below).
-- Launch default is 0 — members-only from the first gated action (see header).
INSERT INTO app_settings (key, value)
VALUES ('free_interaction_quota', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- (b) app.free_gated_actions_used(identity) — how many gated artifacts the actor
-- already owns, summed across the three actor-keyed tables. The actor columns are
-- prompts.author_id, prompt_comments.author_id, prompt_invitations.inviter_id
-- (all reference identities(id) since 20260502100200_migrate_fks_to_identities).
--
-- SECURITY DEFINER so it reads across RLS from inside gating_allows (itself
-- invoked in RLS policy evaluation and the accept_invitation DEFINER body).
-- Takes the identity explicitly; never calls auth.uid() (the migration gate
-- greps DEFINER bodies for it).
CREATE OR REPLACE FUNCTION app.free_gated_actions_used(p_identity_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT
		(SELECT COUNT(*) FROM prompts WHERE author_id = p_identity_id)
		+ (SELECT COUNT(*) FROM prompt_comments WHERE author_id = p_identity_id)
		+ (SELECT COUNT(*) FROM prompt_invitations WHERE inviter_id = p_identity_id)
$$;

REVOKE EXECUTE ON FUNCTION app.free_gated_actions_used(UUID) FROM public;
GRANT EXECUTE ON FUNCTION app.free_gated_actions_used(UUID) TO authenticated, service_role;

-- (c) Fold the quota allowance into the gate decision. Keeps the exact signature,
-- language, volatility, security, search_path, and grants of 20260624120300 — only
-- the body's OR-chain gains the third clause. Access is allowed when:
--   * the action's flag is off/absent (gating off ⇒ true for everyone), OR
--   * the actor holds an active membership, OR
--   * the actor is still under the free-interaction quota (used < N).
-- N is read from the same app_settings key seeded above, COALESCE 0 when absent
-- or non-numeric — matching getFreeInteractionQuota's default. The used-count is
-- only evaluated when the first two clauses are false (SQL short-circuits the OR),
-- so gating-off and active members never pay for the COUNT.
CREATE OR REPLACE FUNCTION app.gating_allows(p_action TEXT, p_identity_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT
		NOT COALESCE(
			(SELECT (value -> p_action) = 'true'::jsonb FROM app_settings WHERE key = 'membership_gating'),
			false
		)
		OR app.has_active_membership(p_identity_id)
		OR (
			app.free_gated_actions_used(p_identity_id) < COALESCE(
				-- Read the quota, clamped to [0, 99] to match the app gate's
				-- normalizeQuota. Cast via ::numeric (never ::int): a stored float
				-- like 2.5 satisfies jsonb_typeof='number', and '2.5'::int RAISES —
				-- inside RLS that would fail closed for EVERY gated insert. We clamp
				-- in the numeric domain FIRST (LEAST/GREATEST + FLOOR), then cast the
				-- already-bounded [0,99] result to int, so neither a float nor an
				-- out-of-int-range value (e.g. 1e20) can ever raise. A missing or
				-- non-number value COALESCEs to the 0 launch default (members-only).
				(
					SELECT LEAST(GREATEST(FLOOR((value #>> '{}')::numeric), 0), 99)::int
					FROM app_settings
					WHERE key = 'free_interaction_quota' AND jsonb_typeof(value) = 'number'
				),
				0
			)
		)
$$;

REVOKE EXECUTE ON FUNCTION app.gating_allows(TEXT, UUID) FROM public;
GRANT EXECUTE ON FUNCTION app.gating_allows(TEXT, UUID) TO authenticated, service_role;
