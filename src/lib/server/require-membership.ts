import { json } from '@sveltejs/kit';
import { requireIdentity } from '$lib/services/identity.js';
import { getMembershipGating, getFreeInteractionQuota } from '$lib/server/app-settings.js';
import { makeAdminClient } from '$lib/server/supabase-admin.js';
import { wasEverAMember, type MembershipRow } from '$lib/domain/membership.js';
import type { ProtectedAction } from '$lib/domain/gating.js';

/**
 * Primary, user-facing access gate for a protected mutating action.
 *
 * Access is evaluated as a question — "does the actor satisfy the access
 * CONDITION for this action?" — rather than a membership-only check. The gate is
 * open when the action is ungated; otherwise the actor passes if ANY wired
 * condition holds. Two conditions are wired today:
 *   1. `activeMembership` — the actor holds an active membership.
 *   2. `freeQuota`        — the actor is still under the free-interaction quota
 *                           (their first N gated actions are free — R9/2b).
 * A future `qualified` condition (e.g. an invite-vouched or reputation gate)
 * slots into the same `evaluateConditions` seam without touching call sites; it
 * is intentionally NOT built here.
 *
 * Returns `null` when access is allowed (ungated, or a condition passed) and the
 * caller should proceed. Returns a 403 Response —
 * `{ error: 'membership_required', action, had_membership, reason }` — when the
 * action is gated and NO condition passes. `reason` is the frontend's routing
 * hint: 'join' (never a member), 'renew' (lapsed paid), 'ended' (ended grant).
 *
 * This mirrors the SQL `app.gating_allows` (the RLS safety net + the
 * accept_invitation RPC body). Both layers compute the SAME decision from the
 * SAME inputs — the gating config, the `active` flag, and a LIVE count of the
 * actor's gated artifacts (no mutable counter ⇒ no app-gate/RLS-net timing
 * race). Fails OPEN on an unexpected error (consistent with the feedback/access
 * gates) — the safety net still applies at the data layer.
 */
export async function requireMembershipForAction(
	action: ProtectedAction,
	locals: App.Locals
): Promise<Response | null> {
	const actor = requireIdentity(locals); // throws 401 if unauthenticated

	let gated: boolean;
	try {
		const gating = await getMembershipGating();
		gated = gating[action] === true;
	} catch (err) {
		console.error(
			'[require-membership] gating config read failed (failing open):',
			err instanceof Error ? err.message : 'unknown'
		);
		return null;
	}
	if (!gated) return null;

	// Read the actor's own row (RLS SELECT-own). Safe display columns only — never
	// the opaque-ref columns. `cadence`/`source` let had_membership + reason use
	// the same "was ever a member" rule as the display mapper, so an abandoned
	// checkout (never-activated paid row) reads "join", not "renew".
	const { data, error } = await locals.supabase
		.from('memberships')
		.select('active, cadence, source')
		.eq('identity_id', actor.id)
		.maybeSingle();
	if (error) {
		console.error('[require-membership] membership read failed (failing open):', error.message);
		return null;
	}

	// Condition 1: an active membership grants access outright.
	if (data?.active === true) return null;

	// Condition 2: the free-interaction quota. Allowed while the actor's live
	// count of gated artifacts is under N. Read N and the count together; a read
	// failure on either fails open (return null) so a settings/DB blip never
	// wrongly blocks a paying-optional guest.
	try {
		const [quota, used] = await Promise.all([
			getFreeInteractionQuota(),
			countGatedActionsUsed(actor.id)
		]);
		if (used < quota) return null;
	} catch (err) {
		console.error(
			'[require-membership] free-quota check failed (failing open):',
			err instanceof Error ? err.message : 'unknown'
		);
		return null;
	}

	// No condition passed: the action is gated and the actor is neither active nor
	// under the quota. Return the clean 403 with the frontend's routing reason.
	return json(
		{
			error: 'membership_required',
			action,
			had_membership: wasEverAMember(data),
			reason: gateReason(data)
		},
		{ status: 403 }
	);
}

/** The frontend's routing hint on a 403. Never a member ⇒ 'join'. Was a member
 *  and it was a PAID membership ⇒ 'renew' (they can re-subscribe). Was a member
 *  via a non-'paid' grant (comp / founding / grandfathered) that ended ⇒ 'ended'
 *  (there is nothing to self-renew). Kept in lockstep with `had_membership`:
 *  reason is 'join' EXACTLY when had_membership is false. */
function gateReason(row: MembershipRow | null | undefined): 'join' | 'renew' | 'ended' {
	if (!wasEverAMember(row)) return 'join';
	return row?.source === 'paid' ? 'renew' : 'ended';
}

/** Live count of the actor's existing gated artifacts, summed across the three
 *  actor-keyed tables — the SAME sum app.free_gated_actions_used computes in SQL.
 *  Uses the service-role admin client for an accurate count regardless of RLS,
 *  and head+exact so no rows are transferred. Runs the three counts in parallel.
 *
 *  Actor columns (confirmed against the migrations): prompts.author_id,
 *  prompt_comments.author_id, prompt_invitations.inviter_id — all reference
 *  identities(id), which equals the actor id. */
async function countGatedActionsUsed(identityId: string): Promise<number> {
	const admin = makeAdminClient();
	const countFor = async (table: string, column: string): Promise<number> => {
		const { count, error } = await admin
			.from(table)
			.select('*', { count: 'exact', head: true })
			.eq(column, identityId);
		if (error) throw new Error(`count ${table} failed: ${error.message}`);
		return count ?? 0;
	};
	const [prompts, comments, invitations] = await Promise.all([
		countFor('prompts', 'author_id'),
		countFor('prompt_comments', 'author_id'),
		countFor('prompt_invitations', 'inviter_id')
	]);
	return prompts + comments + invitations;
}
