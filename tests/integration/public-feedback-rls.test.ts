import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, createAuthenticatedClient, TEST_USERS } from '../helpers/auth.js';

/**
 * public_feedback + gathering_feedback RLS (feat: unified gathering feedback,
 * U3 — the any-to-any experiential edge + collect-only meet-again).
 *
 * Two invariants under test:
 *
 *  1. LEAST-PRIVILEGE VISIBILITY (R11). On submit a public_feedback row is
 *     visible to its reviewer AND its SUBJECT (reviewee) — and NO ONE ELSE.
 *     Only the subject can promote it (set made_public_at); once promoted, a
 *     co-participant of the same gathering may read it. The reviewer cannot
 *     promote; a third party cannot promote.
 *
 *  2. TURNOUT GATE (KTD4). INSERT is gated on app.both_present — BOTH the
 *     reviewer and the reviewee must have actually turned up. This is what
 *     delivers joiner<->joiner edges (which the legacy author<->joiner star
 *     could never represent) AND what rejects an edge naming an absent host in
 *     the everyone-but-host case.
 *
 * Fixture — ONE group gathering, everyone-but-host turned up:
 *   Host lisa (author) — did NOT turn up.
 *   Joiners marco, ava, ben — all turned up.
 * marco reviews ava (reviewer -> subject); ben is the third co-participant used
 * to prove the promotion boundary. app.both_present / app.is_gathering_participant
 * read `participation` only, so no `meetings` rows are needed.
 */
describe('public_feedback + gathering_feedback RLS (U3)', () => {
	const admin = createAdminClient();
	let marco: SupabaseClient;
	let ava: SupabaseClient;
	let ben: SupabaseClient;

	const stamp = Date.now();
	const prompt1 = `pf-rls-p1-${stamp}`;
	let slot1: string;
	let gathering1: string;

	const stubLocation = {
		place_id: 'test-place',
		name: 'Test venue',
		address: 'Test address',
		lat: 52.5,
		lng: 13.4
	};

	async function cleanup() {
		// public_feedback + gathering_feedback are ON DELETE RESTRICT on
		// gathering_id — delete them before the gathering. participation cascades
		// from gatherings.
		await admin.from('public_feedback').delete().eq('gathering_id', gathering1);
		await admin.from('gathering_feedback').delete().eq('gathering_id', gathering1);
		await admin.from('gatherings').delete().in('prompt_id', [prompt1]);
		await admin.from('time_slots').delete().in('prompt_id', [prompt1]);
		await admin.from('prompts').delete().in('id', [prompt1]);
	}

	beforeAll(async () => {
		[marco, ava, ben] = await Promise.all([
			createAuthenticatedClient(TEST_USERS.marco.email, TEST_USERS.marco.password),
			createAuthenticatedClient(TEST_USERS.ava.email, TEST_USERS.ava.password),
			createAuthenticatedClient(TEST_USERS.ben.email, TEST_USERS.ben.password)
		]);

		const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

		await admin
			.from('prompts')
			.insert([
				{ id: prompt1, author_id: TEST_USERS.lisa.id, title: 'PF1', state: 'published', region: 'berlin', published_at: new Date().toISOString() }
			])
			.throwOnError();

		const { data: slots } = await admin
			.from('time_slots')
			.insert([
				{ prompt_id: prompt1, start_time: future, duration_minutes: 60, exact_location: stubLocation, general_area: 'Mitte' }
			])
			.select('id')
			.throwOnError();
		slot1 = slots![0].id;

		const { data: gatherings } = await admin
			.from('gatherings')
			.insert([{ slot_id: slot1, prompt_id: prompt1, host_id: TEST_USERS.lisa.id }])
			.select('id')
			.throwOnError();
		gathering1 = gatherings![0].id;

		// Everyone-but-host turned up: the host (lisa) is absent; the three joiners
		// turned up. app.both_present keys off these turned_up flags.
		await admin
			.from('participation')
			.insert([
				{ gathering_id: gathering1, member_id: TEST_USERS.lisa.id, is_host: true, turned_up: false, self_report: 'absent' },
				{ gathering_id: gathering1, member_id: TEST_USERS.marco.id, is_host: false, turned_up: true, self_report: 'attended' },
				{ gathering_id: gathering1, member_id: TEST_USERS.ava.id, is_host: false, turned_up: true, self_report: 'attended' },
				{ gathering_id: gathering1, member_id: TEST_USERS.ben.id, is_host: false, turned_up: true, self_report: 'attended' }
			])
			.throwOnError();
	});

	afterAll(cleanup);

	// Writes are DEFINER-RPC-only (submit_public_feedback), matching every other
	// table in the unit — public_feedback holds no direct INSERT/UPDATE grant. The
	// RPC forces reviewer_id = caller (spoofing impossible by construction) and
	// re-enforces the turnout gate, tag vocabulary, and length caps in its body.
	describe('write path (submit_public_feedback RPC + turnout gate)', () => {
		it('a joiner<->joiner edge inserts when both turned up (marco -> ava)', async () => {
			const { error } = await marco.rpc('submit_public_feedback', {
				p_gathering: gathering1,
				p_reviewee: TEST_USERS.ava.id,
				p_tags: ['thoughtful', 'curious'],
				p_free_text: 'Great conversation.'
			});
			expect(error, error?.message).toBeNull();
		});

		it('a second joiner<->joiner edge inserts (marco -> ben)', async () => {
			const { error } = await marco.rpc('submit_public_feedback', {
				p_gathering: gathering1,
				p_reviewee: TEST_USERS.ben.id,
				p_tags: ['warm']
			});
			expect(error, error?.message).toBeNull();
		});

		it('a direct table INSERT is blocked (no user grant — RPC-minted only)', async () => {
			const { error } = await marco.from('public_feedback').insert({
				gathering_id: gathering1,
				reviewer_id: TEST_USERS.marco.id,
				reviewee_id: TEST_USERS.ava.id,
				tags: ['warm']
			});
			expect(error, 'direct user INSERT must be blocked').not.toBeNull();
		});

		it('an edge naming the ABSENT host is rejected (both_present false)', async () => {
			// lisa (host) did not turn up — the turnout gate blocks any edge naming
			// her, even from a joiner who did turn up.
			const { error } = await marco.rpc('submit_public_feedback', {
				p_gathering: gathering1,
				p_reviewee: TEST_USERS.lisa.id,
				p_tags: ['warm']
			});
			expect(error, 'edge naming the absent host must be rejected by both_present').not.toBeNull();
		});

		it('rejects a self-review (reviewee = caller)', async () => {
			const { error } = await marco.rpc('submit_public_feedback', {
				p_gathering: gathering1,
				p_reviewee: TEST_USERS.marco.id,
				p_tags: ['curious']
			});
			expect(error, 'self-review must be rejected').not.toBeNull();
		});

		it('rejects a tag outside the active vocabulary', async () => {
			const { error } = await marco.rpc('submit_public_feedback', {
				p_gathering: gathering1,
				p_reviewee: TEST_USERS.ava.id,
				p_tags: ['definitely-not-a-real-vocabulary-word']
			});
			expect(error, 'non-vocabulary tag must be rejected').not.toBeNull();
		});

		it('rejects free_text over the length cap', async () => {
			const { error } = await marco.rpc('submit_public_feedback', {
				p_gathering: gathering1,
				p_reviewee: TEST_USERS.ava.id,
				p_tags: [],
				p_free_text: 'x'.repeat(2001)
			});
			expect(error, 'free_text over 2000 chars must be rejected').not.toBeNull();
		});
	});

	describe('least-privilege visibility (R11)', () => {
		it('the SUBJECT reads feedback about them before promotion', async () => {
			// ava is the subject of marco's feedback — she sees it by default.
			const { data, error } = await ava
				.from('public_feedback')
				.select('id, tags')
				.eq('gathering_id', gathering1)
				.eq('reviewer_id', TEST_USERS.marco.id)
				.eq('reviewee_id', TEST_USERS.ava.id);
			expect(error, error?.message).toBeNull();
			expect((data ?? []).length).toBe(1);
		});

		it('the reviewer reads their own feedback', async () => {
			const { data } = await marco
				.from('public_feedback')
				.select('id')
				.eq('gathering_id', gathering1)
				.eq('reviewer_id', TEST_USERS.marco.id);
			// marco -> ava and marco -> ben.
			expect((data ?? []).length).toBe(2);
		});

		it('a third co-participant CANNOT read the feedback before promotion', async () => {
			// ben is a co-participant but not the subject of marco->ava — invisible
			// until ava promotes it.
			const { data } = await ben
				.from('public_feedback')
				.select('id')
				.eq('gathering_id', gathering1)
				.eq('reviewer_id', TEST_USERS.marco.id)
				.eq('reviewee_id', TEST_USERS.ava.id);
			expect(data ?? []).toEqual([]);
		});
	});

	describe('promotion (subject-only) + minimal co-participant read', () => {
		async function feedbackId(): Promise<string> {
			const { data } = await admin
				.from('public_feedback')
				.select('id')
				.eq('gathering_id', gathering1)
				.eq('reviewer_id', TEST_USERS.marco.id)
				.eq('reviewee_id', TEST_USERS.ava.id)
				.single();
			return data!.id;
		}

		it('the reviewer CANNOT promote (promote_public_feedback returns false)', async () => {
			const id = await feedbackId();
			// The RPC only promotes rows the caller is the SUBJECT of. marco is the
			// reviewer, not the subject — it returns false and sets nothing.
			const { data: promoted } = await marco.rpc('promote_public_feedback', { p_feedback_id: id });
			expect(promoted, 'reviewer must not be able to promote').toBe(false);
			const { data } = await admin.from('public_feedback').select('made_public_at').eq('id', id).single();
			expect(data!.made_public_at, 'reviewer must not be able to promote').toBeNull();
		});

		it('a third participant CANNOT promote', async () => {
			const id = await feedbackId();
			const { data: promoted } = await ben.rpc('promote_public_feedback', { p_feedback_id: id });
			expect(promoted, 'a third party must not be able to promote').toBe(false);
			const { data } = await admin.from('public_feedback').select('made_public_at').eq('id', id).single();
			expect(data!.made_public_at, 'a third party must not be able to promote').toBeNull();
		});

		it('the SUBJECT promotes it (promote_public_feedback returns true)', async () => {
			const id = await feedbackId();
			const { data: promoted, error } = await ava.rpc('promote_public_feedback', { p_feedback_id: id });
			expect(error, error?.message).toBeNull();
			expect(promoted, 'subject promotion must succeed').toBe(true);
			const { data } = await admin.from('public_feedback').select('made_public_at').eq('id', id).single();
			expect(data!.made_public_at, 'subject promotion must persist').not.toBeNull();
		});

		it('after promotion, a co-participant of the gathering CAN read it', async () => {
			const id = await feedbackId();
			const { data } = await ben.from('public_feedback').select('id').eq('id', id);
			expect((data ?? []).map((r) => r.id)).toContain(id);
		});

		it('editing content AFTER promotion resets made_public_at (re-consent required)', async () => {
			// The subject consented to specific content. If the reviewer re-submits the
			// same edge with different content, promotion must drop back to NULL so the
			// substitute is not silently public under the old consent.
			const id = await feedbackId();
			const { error } = await marco.rpc('submit_public_feedback', {
				p_gathering: gathering1,
				p_reviewee: TEST_USERS.ava.id,
				p_tags: ['reserved'],
				p_free_text: 'Different text.'
			});
			expect(error, error?.message).toBeNull();
			const { data } = await admin
				.from('public_feedback')
				.select('made_public_at, tags')
				.eq('id', id)
				.single();
			expect(data!.made_public_at, 'content change must reset promotion').toBeNull();
			expect(data!.tags).toEqual(['reserved']);
		});

		it('a no-op resubmit (identical content) leaves promotion intact', async () => {
			// Re-promote, then resubmit the SAME content — made_public_at must survive.
			const id = await feedbackId();
			await ava.rpc('promote_public_feedback', { p_feedback_id: id });
			const { error } = await marco.rpc('submit_public_feedback', {
				p_gathering: gathering1,
				p_reviewee: TEST_USERS.ava.id,
				p_tags: ['reserved'],
				p_free_text: 'Different text.'
			});
			expect(error, error?.message).toBeNull();
			const { data } = await admin.from('public_feedback').select('made_public_at').eq('id', id).single();
			expect(data!.made_public_at, 'identical resubmit must keep promotion').not.toBeNull();
		});
	});

	describe('gathering_feedback — collect-only meet-again, owner-read only', () => {
		beforeAll(async () => {
			// Minted by SECURITY DEFINER RPCs in later units; seed via service role here.
			await admin
				.from('gathering_feedback')
				.insert([
					{ gathering_id: gathering1, reviewer_id: TEST_USERS.marco.id, meet_again: true },
					{ gathering_id: gathering1, reviewer_id: TEST_USERS.ben.id, meet_again: false }
				])
				.throwOnError();
		});

		it('meet_again persists and the reviewer reads their own row', async () => {
			const { data, error } = await marco
				.from('gathering_feedback')
				.select('meet_again')
				.eq('gathering_id', gathering1)
				.eq('reviewer_id', TEST_USERS.marco.id);
			expect(error, error?.message).toBeNull();
			expect((data ?? []).length).toBe(1);
			expect(data![0].meet_again).toBe(true);
		});

		it("a member CANNOT read another member's meet-again row", async () => {
			// marco cannot see ben's gathering_feedback — owner-read only.
			const { data } = await marco
				.from('gathering_feedback')
				.select('id')
				.eq('gathering_id', gathering1)
				.eq('reviewer_id', TEST_USERS.ben.id);
			expect(data ?? []).toEqual([]);
		});

		it('a user cannot INSERT gathering_feedback directly (no user grant)', async () => {
			const { error } = await marco.from('gathering_feedback').insert({
				gathering_id: gathering1,
				reviewer_id: TEST_USERS.marco.id,
				meet_again: false
			});
			expect(error, 'direct user INSERT must be blocked (RPC-minted only)').not.toBeNull();
		});
	});
});
