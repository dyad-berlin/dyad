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
	const createdPromptIds: string[] = [];

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
	/** Leave app_settings as found: gating off, quota back to the seeded default (1). */
	async function restoreDefaults() {
		await admin.from('app_settings').delete().eq('key', 'membership_gating');
		await setQuota(1);
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
});
