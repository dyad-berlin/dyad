import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, createAuthenticatedClient, TEST_USERS, SEED_PROMPTS } from '../helpers/auth.js';
import { SupabaseCommentService } from '../../src/lib/services/comment.js';

/**
 * Per-action gating enforcement at the data layer: the split RLS FOR INSERT
 * policies and the accept_invitation RPC body. (The endpoint-primary gate is
 * unit-tested in src/lib/server/require-membership.test.ts.)
 *
 * lisa is made a comp (active) member; marco stays an inactive guest. The seed
 * pending invitation b0000001 has marco as invitee — the RPC gate RAISEs before
 * any mutation, so the denied path leaves seed state untouched.
 */
const SEED_PENDING_INVITATION = 'b0000001-0000-0000-0000-000000000001';
const LISA = TEST_USERS.lisa.id;
const MARCO = TEST_USERS.marco.id;

describe('membership gating enforcement (RLS + accept RPC)', () => {
	const admin = createAdminClient();
	let lisa: SupabaseClient;
	let marco: SupabaseClient;
	const createdPromptIds: string[] = [];

	async function setGating(gating: Record<string, boolean>) {
		await admin
			.from('app_settings')
			.upsert(
				{ key: 'membership_gating', value: gating, updated_at: new Date().toISOString() },
				{ onConflict: 'key' }
			);
	}
	async function clearGating() {
		await admin.from('app_settings').delete().eq('key', 'membership_gating');
	}

	beforeAll(async () => {
		[lisa, marco] = await Promise.all([
			createAuthenticatedClient(TEST_USERS.lisa.email, TEST_USERS.lisa.password),
			createAuthenticatedClient(TEST_USERS.marco.email, TEST_USERS.marco.password)
		]);
		await admin.from('memberships').delete().in('identity_id', [LISA, MARCO]);
		await admin.from('memberships').insert({ identity_id: LISA, source: 'comp', active: true });
	});

	beforeEach(clearGating);

	afterAll(async () => {
		await clearGating();
		await admin.from('memberships').delete().in('identity_id', [LISA, MARCO]);
		if (createdPromptIds.length) await admin.from('prompts').delete().in('id', createdPromptIds);
		await admin
			.from('prompt_comments')
			.delete()
			.eq('author_id', MARCO)
			.eq('prompt_id', SEED_PROMPTS.published);
	});

	it('reads are never gated — an inactive guest lists published conversations under full gating (AE3/R11)', async () => {
		await setGating({ create_conversation: true, respond_take_slot: true, invite_to_meet: true });
		const { data, error } = await marco
			.from('prompts')
			.select('id')
			.eq('state', 'published')
			.limit(5);
		expect(error, error?.message).toBeNull();
		expect(data?.length ?? 0).toBeGreaterThan(0);
	});

	it('create_conversation gated → inactive guest INSERT rejected, active comp member allowed (AE4)', async () => {
		await setGating({ create_conversation: true });

		const denied = await marco.from('prompts').insert({ id: `gate-marco-${Date.now()}`, author_id: MARCO });
		expect(denied.error, 'RLS FOR INSERT must reject an inactive guest').not.toBeNull();

		const lisaId = `gate-lisa-${Date.now()}`;
		createdPromptIds.push(lisaId);
		const allowed = await lisa.from('prompts').insert({ id: lisaId, author_id: LISA });
		expect(allowed.error, allowed.error?.message).toBeNull(); // comp == paid at the gate
	});

	it('gating off → inactive guest can create (no behaviour change)', async () => {
		const id = `gate-off-${Date.now()}`;
		createdPromptIds.push(id);
		const { error } = await marco.from('prompts').insert({ id, author_id: MARCO });
		expect(error, error?.message).toBeNull();
	});

	it('per-action independence — respond gated, create off (AE2)', async () => {
		await setGating({ respond_take_slot: true });

		const id = `gate-indep-${Date.now()}`;
		createdPromptIds.push(id);
		const createRes = await marco.from('prompts').insert({ id, author_id: MARCO });
		expect(createRes.error, 'create_conversation is off → allowed').toBeNull();

		const commentRes = await marco
			.from('prompt_comments')
			.insert({ prompt_id: SEED_PROMPTS.published, author_id: MARCO, body: 'gate test' });
		expect(commentRes.error, 'respond_take_slot is on → rejected').not.toBeNull();
	});

	it('respond gated → inactive member can EDIT an existing response but not CREATE a new one', async () => {
		await setGating({ respond_take_slot: true });
		const comments = new SupabaseCommentService(marco);

		// Seed an existing response (admin bypasses RLS) so the next write is an edit.
		await admin.from('prompt_comments').delete().eq('author_id', MARCO).eq('prompt_id', SEED_PROMPTS.published);
		await admin
			.from('prompt_comments')
			.insert({ prompt_id: SEED_PROMPTS.published, author_id: MARCO, body: 'original' });

		// Edit → pure UPDATE (ungated FOR UPDATE policy) → succeeds despite gating.
		const edited = await comments.createOrUpdate(SEED_PROMPTS.published, MARCO, 'edited');
		expect(edited.body).toBe('edited');

		// Remove it, then a NEW response → INSERT (gated FOR INSERT) → rejected.
		await admin.from('prompt_comments').delete().eq('author_id', MARCO).eq('prompt_id', SEED_PROMPTS.published);
		await expect(
			comments.createOrUpdate(SEED_PROMPTS.published, MARCO, 'brand new')
		).rejects.toThrow();
	});

	it('respond gated → inactive guest cannot accept an invitation (accept_invitation RPC gate)', async () => {
		await setGating({ respond_take_slot: true });
		// marco is the invitee; the gate RAISEs before any write, so the seed
		// invitation stays pending.
		const { error } = await marco.rpc('accept_invitation', {
			p_invitation_id: SEED_PENDING_INVITATION
		});
		expect(error).not.toBeNull();
		expect(error?.message ?? '').toContain('membership_required');
	});
});

/**
 * Free-interaction quota (2b / U2) at the RLS safety net — the KTD2 consistency
 * proof. The endpoint gate (require-membership.ts) and app.gating_allows must
 * make the SAME decision, so both count the actor's gated artifacts the SAME way
 * (prompts.author_id + prompt_comments.author_id + prompt_invitations.inviter_id)
 * with NO mutable counter. The critical, must-verify-empirically question: does
 * the RLS FOR INSERT WITH CHECK see the in-flight row when it self-counts? If it
 * did, the first free action (which the endpoint pre-check allows at used=B<N)
 * would be REJECTED at the net (used=B+1==N) — the exact app-vs-RLS split KTD2
 * warns about. This test proves it does NOT: baseline B is allowed, B+1 blocked.
 *
 * Quota is set RELATIVE to marco's live baseline so the test never depends on (or
 * clobbers) seed-row counts other integration files rely on.
 */
describe('free-interaction quota — RLS net consistency (KTD2)', () => {
	const admin = createAdminClient();
	let marco: SupabaseClient;
	const MARCO = TEST_USERS.marco.id;
	const LISA = TEST_USERS.lisa.id;
	const createdPromptIds: string[] = [];
	const createdInvitationIds: string[] = [];
	// lisa's published seed prompt + its first slot — the target for marco's gated
	// response / invitation. The invitee on this prompt must be its author (lisa),
	// enforced by the check_invitee_is_prompt_author trigger.
	const PUBLISHED_SLOT = 'a0000001-0000-0000-0000-000000000001';

	async function setGating(gating: Record<string, boolean>) {
		await admin
			.from('app_settings')
			.upsert(
				{ key: 'membership_gating', value: gating, updated_at: new Date().toISOString() },
				{ onConflict: 'key' }
			);
	}
	async function setQuota(n: number) {
		await admin
			.from('app_settings')
			.upsert(
				{ key: 'free_interaction_quota', value: n, updated_at: new Date().toISOString() },
				{ onConflict: 'key' }
			);
	}
	/** Leave app_settings as found: gating off, quota back to the seeded launch
	 *  default (0 — members-only from the first gated action). */
	async function restoreDefaults() {
		await admin.from('app_settings').delete().eq('key', 'membership_gating');
		await setQuota(0);
	}
	/** The live baseline — the identical three-table sum the gate computes on both
	 *  layers. Setting the quota to baseline+k gives the actor exactly k free actions. */
	async function usedCount(): Promise<number> {
		const [p, c, i] = await Promise.all([
			admin.from('prompts').select('*', { count: 'exact', head: true }).eq('author_id', MARCO),
			admin.from('prompt_comments').select('*', { count: 'exact', head: true }).eq('author_id', MARCO),
			admin.from('prompt_invitations').select('*', { count: 'exact', head: true }).eq('inviter_id', MARCO)
		]);
		return (p.count ?? 0) + (c.count ?? 0) + (i.count ?? 0);
	}

	beforeAll(async () => {
		marco = await createAuthenticatedClient(TEST_USERS.marco.email, TEST_USERS.marco.password);
		await admin.from('memberships').delete().eq('identity_id', MARCO); // inactive guest
		await setGating({ create_conversation: true });
	});

	afterAll(async () => {
		if (createdInvitationIds.length)
			await admin.from('prompt_invitations').delete().in('id', createdInvitationIds);
		await admin
			.from('prompt_comments')
			.delete()
			.eq('author_id', MARCO)
			.eq('prompt_id', SEED_PROMPTS.published);
		if (createdPromptIds.length) await admin.from('prompts').delete().in('id', createdPromptIds);
		await admin.from('memberships').delete().eq('identity_id', MARCO);
		await restoreDefaults();
	});

	it('under quota the net ALLOWS the free action, at the quota it REJECTS — WITH CHECK excludes the in-flight row (no off-by-one)', async () => {
		const baseline = await usedCount();
		await setQuota(baseline + 1); // exactly one free gated action remaining

		const id1 = `quota-free-${Date.now()}`;
		const first = await marco.from('prompts').insert({ id: id1, author_id: MARCO });
		expect(first.error, 'used (baseline) < N → the free action is allowed at the net').toBeNull();
		createdPromptIds.push(id1);

		const id2 = `quota-over-${Date.now()}`;
		const second = await marco.from('prompts').insert({ id: id2, author_id: MARCO });
		expect(second.error, 'used (baseline+1) == N → the net rejects').not.toBeNull();
	});

	it('quota equal to the current used count → members-only (zero free actions)', async () => {
		const baseline = await usedCount();
		await setQuota(baseline); // 0 free remaining

		const id = `quota-none-${Date.now()}`;
		const res = await marco.from('prompts').insert({ id, author_id: MARCO });
		expect(res.error, 'used == N with no membership → rejected').not.toBeNull();
	});

	it('an active member is allowed even with the quota exhausted (membership short-circuits)', async () => {
		const baseline = await usedCount();
		await setQuota(baseline); // 0 free remaining
		await admin.from('memberships').insert({ identity_id: MARCO, source: 'comp', active: true });
		try {
			const id = `quota-member-${Date.now()}`;
			const res = await marco.from('prompts').insert({ id, author_id: MARCO });
			expect(res.error, 'active membership passes the gate regardless of quota').toBeNull();
			if (!res.error) createdPromptIds.push(id);
		} finally {
			await admin.from('memberships').delete().eq('identity_id', MARCO);
		}
	});

	// The same no-off-by-one boundary must hold for the other two gated INSERT
	// paths, not just prompts — all three read the same three-table live COUNT.
	// respond_take_slot → prompt_comments (author_id = actor).

	it('prompt_comments: under quota the net ALLOWS, at the quota it REJECTS (no off-by-one)', async () => {
		await setGating({ respond_take_slot: true });
		// Clean any prior response from marco so the boundary starts from the
		// live baseline (one comment per user per prompt — a stale row would block).
		await admin
			.from('prompt_comments')
			.delete()
			.eq('author_id', MARCO)
			.eq('prompt_id', SEED_PROMPTS.published);

		const baseline = await usedCount();
		await setQuota(baseline + 1); // exactly one free gated action remaining

		// used (baseline) < N → the free response is allowed at the net.
		const first = await marco
			.from('prompt_comments')
			.insert({ prompt_id: SEED_PROMPTS.published, author_id: MARCO, body: 'quota comment' });
		expect(first.error, 'used (baseline) < N → the response INSERT is allowed').toBeNull();

		// A second NEW response would be at-quota, but the one-comment-per-prompt
		// unique index would mask the gate. Remove the row first so the retry is a
		// genuine INSERT that the at-quota net must reject on its own. After the
		// delete, used is back to `baseline`; set the quota to `baseline` → 0 free.
		await admin
			.from('prompt_comments')
			.delete()
			.eq('author_id', MARCO)
			.eq('prompt_id', SEED_PROMPTS.published);
		await setQuota(baseline); // used (baseline) == N → 0 free remaining
		const second = await marco
			.from('prompt_comments')
			.insert({ prompt_id: SEED_PROMPTS.published, author_id: MARCO, body: 'over quota' });
		expect(second.error, 'used == N → the response INSERT is rejected at the net').not.toBeNull();
	});

	// invite_to_meet → prompt_invitations (inviter_id = actor). marco invites lisa
	// (the published prompt's author, as the invitee trigger requires) on her slot.

	it('prompt_invitations: under quota the net ALLOWS, at the quota it REJECTS (no off-by-one)', async () => {
		await setGating({ invite_to_meet: true });
		// Clear any pending invitation from marco on this slot (the partial unique
		// index allows only one pending per slot+inviter — a stale row would block
		// the INSERT for a non-gating reason).
		await admin
			.from('prompt_invitations')
			.delete()
			.eq('inviter_id', MARCO)
			.eq('slot_id', PUBLISHED_SLOT);

		const baseline = await usedCount();
		await setQuota(baseline + 1); // exactly one free gated action remaining

		const inv = {
			prompt_id: SEED_PROMPTS.published,
			slot_id: PUBLISHED_SLOT,
			inviter_id: MARCO,
			invitee_id: LISA, // must be the prompt author (trigger)
			state: 'pending'
		};
		// used (baseline) < N → the free invitation is allowed at the net.
		const first = await marco.from('prompt_invitations').insert(inv).select('id').single();
		expect(first.error, 'used (baseline) < N → the invitation INSERT is allowed').toBeNull();
		if (first.data?.id) createdInvitationIds.push(first.data.id);

		// Now used == N (the just-inserted invitation counts live). A second INSERT
		// on a different slot avoids the pending-per-slot unique index, so the only
		// thing that can reject it is the at-quota gate.
		const second = await marco.from('prompt_invitations').insert({
			...inv,
			slot_id: 'a0000001-0000-0000-0000-000000000002' // the published prompt's other slot
		});
		expect(second.error, 'used == N → the invitation INSERT is rejected at the net').not.toBeNull();
	});

	// Live-count design property: quota counts CURRENTLY-EXISTING artifacts, so a
	// hard delete frees quota. This PINS delete-then-recreate — documented in the
	// migration header as a known property pending a product decision.

	it('delete-then-recreate: hard-deleting a gated artifact frees quota and lets the actor insert again', async () => {
		await setGating({ create_conversation: true });

		// Seed one deletable prompt owned by marco, then exhaust the quota exactly.
		const seedId = `quota-freeable-${Date.now()}`;
		await admin.from('prompts').insert({ id: seedId, author_id: MARCO });
		const baseline = await usedCount();
		await setQuota(baseline); // 0 free remaining — the gate is at the wall

		// Confirm the wall: a fresh INSERT is rejected while at quota.
		const blocked = await marco.from('prompts').insert({ id: `quota-blocked-${Date.now()}`, author_id: MARCO });
		expect(blocked.error, 'used == N → rejected while at the wall').not.toBeNull();

		// Hard-delete the actor's own artifact → live count drops by one → quota freed.
		const del = await marco.from('prompts').delete().eq('id', seedId);
		expect(del.error, del.error?.message).toBeNull();

		const afterId = `quota-recreated-${Date.now()}`;
		const recreated = await marco.from('prompts').insert({ id: afterId, author_id: MARCO });
		expect(recreated.error, 'delete freed quota → the recreate INSERT is allowed').toBeNull();
		if (!recreated.error) createdPromptIds.push(afterId);
	});
});
