import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, createAuthenticatedClient, TEST_USERS } from '../helpers/auth.js';

/**
 * gatherings + participation RLS (feat: unified gathering feedback, U1).
 *
 * A participant may SELECT the gathering(s) they belong to (via
 * app.is_gathering_participant) and their own participation row
 * (member_id = app.current_user_id()). Writes are service-role only — rows are
 * minted/mutated by the SECURITY DEFINER RPCs in U5, so authenticated has no
 * INSERT/UPDATE/DELETE grant.
 *
 * The derived-occurrence functions (app.gathering_happened / app.both_present)
 * live in the non-PostgREST-exposed `app` schema, so they are exercised in-DB
 * by the pgTAP test supabase/tests/gatherings.test.sql, not here.
 *
 * Fixtures use two independent gatherings so cross-gathering reads can be
 * asserted to return zero rows:
 *   G1 (slot on lisa's prompt): lisa (host) + marco.
 *   G2 (slot on ava's prompt):  ava (host)  + ben.
 * lisa/marco must not see G2; ava/ben must not see G1.
 */
describe('gatherings + participation RLS (U1)', () => {
	const admin = createAdminClient();
	let lisa: SupabaseClient;
	let marco: SupabaseClient;
	let ava: SupabaseClient;

	const stamp = Date.now();
	const promptG1 = `gath-rls-g1-${stamp}`;
	const promptG2 = `gath-rls-g2-${stamp}`;
	let slotG1: string;
	let slotG2: string;
	let gatheringG1: string;
	let gatheringG2: string;
	let lisaParticipationG1: string;

	const stubLocation = {
		place_id: 'test-place',
		name: 'Test venue',
		address: 'Test address',
		lat: 52.5,
		lng: 13.4
	};

	async function cleanup() {
		// FK order: gatherings cascade to participation; time_slots cascade to
		// gatherings; prompts are ON DELETE RESTRICT from gatherings, so slots
		// (hence gatherings) must go first.
		await admin.from('gatherings').delete().in('prompt_id', [promptG1, promptG2]);
		await admin.from('time_slots').delete().in('prompt_id', [promptG1, promptG2]);
		await admin.from('prompts').delete().in('id', [promptG1, promptG2]);
	}

	beforeAll(async () => {
		[lisa, marco, ava] = await Promise.all([
			createAuthenticatedClient(TEST_USERS.lisa.email, TEST_USERS.lisa.password),
			createAuthenticatedClient(TEST_USERS.marco.email, TEST_USERS.marco.password),
			createAuthenticatedClient(TEST_USERS.ava.email, TEST_USERS.ava.password)
		]);

		await cleanup();

		const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

		// Two prompts + one slot each.
		await admin
			.from('prompts')
			.insert([
				{ id: promptG1, author_id: TEST_USERS.lisa.id, title: 'G1', state: 'published', region: 'berlin', published_at: new Date().toISOString() },
				{ id: promptG2, author_id: TEST_USERS.ava.id, title: 'G2', state: 'published', region: 'berlin', published_at: new Date().toISOString() }
			])
			.throwOnError();

		const { data: slots } = await admin
			.from('time_slots')
			.insert([
				{ prompt_id: promptG1, start_time: future, duration_minutes: 60, exact_location: stubLocation, general_area: 'Mitte' },
				{ prompt_id: promptG2, start_time: future, duration_minutes: 60, exact_location: stubLocation, general_area: 'Neukölln' }
			])
			.select('id, prompt_id')
			.throwOnError();
		slotG1 = slots!.find((s) => s.prompt_id === promptG1)!.id;
		slotG2 = slots!.find((s) => s.prompt_id === promptG2)!.id;

		const { data: gatherings } = await admin
			.from('gatherings')
			.insert([
				{ slot_id: slotG1, prompt_id: promptG1, host_id: TEST_USERS.lisa.id },
				{ slot_id: slotG2, prompt_id: promptG2, host_id: TEST_USERS.ava.id }
			])
			.select('id, prompt_id')
			.throwOnError();
		gatheringG1 = gatherings!.find((g) => g.prompt_id === promptG1)!.id;
		gatheringG2 = gatherings!.find((g) => g.prompt_id === promptG2)!.id;

		const { data: parts } = await admin
			.from('participation')
			.insert([
				{ gathering_id: gatheringG1, member_id: TEST_USERS.lisa.id, is_host: true, turned_up: true, self_report: 'attended' },
				{ gathering_id: gatheringG1, member_id: TEST_USERS.marco.id, is_host: false, turned_up: true, self_report: 'attended' },
				{ gathering_id: gatheringG2, member_id: TEST_USERS.ava.id, is_host: true, turned_up: true, self_report: 'attended' },
				{ gathering_id: gatheringG2, member_id: TEST_USERS.ben.id, is_host: false, turned_up: true, self_report: 'attended' }
			])
			.select('id, gathering_id, member_id')
			.throwOnError();
		lisaParticipationG1 = parts!.find(
			(p) => p.gathering_id === gatheringG1 && p.member_id === TEST_USERS.lisa.id
		)!.id;
	});

	afterAll(cleanup);

	describe('gatherings SELECT', () => {
		it('a participant can read the gathering they belong to', async () => {
			const { data, error } = await lisa
				.from('gatherings')
				.select('id')
				.eq('id', gatheringG1)
				.maybeSingle();
			expect(error, error?.message).toBeNull();
			expect(data?.id).toBe(gatheringG1);
		});

		it('a joiner can also read the gathering they belong to', async () => {
			const { data } = await marco.from('gatherings').select('id').eq('id', gatheringG1).maybeSingle();
			expect(data?.id).toBe(gatheringG1);
		});

		it('a participant CANNOT read a gathering they are not in (cross-gathering)', async () => {
			const { data } = await lisa.from('gatherings').select('id').eq('id', gatheringG2).maybeSingle();
			expect(data).toBeNull();
		});

		it('a non-participant sees zero gatherings', async () => {
			// ava is in G2, not G1 — she must not see G1.
			const { data } = await ava.from('gatherings').select('id').eq('id', gatheringG1).maybeSingle();
			expect(data).toBeNull();
		});
	});

	describe('participation SELECT', () => {
		it('a participant reads only their own participation row', async () => {
			const { data, error } = await lisa
				.from('participation')
				.select('member_id, gathering_id')
				.eq('gathering_id', gatheringG1);
			expect(error, error?.message).toBeNull();
			// Even though G1 has two participation rows, RLS exposes only lisa's own.
			expect(data).toHaveLength(1);
			expect(data![0].member_id).toBe(TEST_USERS.lisa.id);
		});

		it('a participant cannot read a co-participant\'s participation row', async () => {
			const { data } = await lisa
				.from('participation')
				.select('member_id')
				.eq('gathering_id', gatheringG1)
				.eq('member_id', TEST_USERS.marco.id)
				.maybeSingle();
			expect(data).toBeNull();
		});

		it('a non-participant sees zero participation rows of another gathering', async () => {
			const { data } = await ava.from('participation').select('id').eq('gathering_id', gatheringG1);
			expect(data).toEqual([]);
		});
	});

	describe('writes are service-role only', () => {
		it('an authenticated user cannot INSERT a participation row (no grant)', async () => {
			const { error } = await marco
				.from('participation')
				.insert({ gathering_id: gatheringG1, member_id: TEST_USERS.marco.id, turned_up: true });
			expect(error, 'authenticated has no INSERT grant on participation').not.toBeNull();
		});

		it('an authenticated user cannot UPDATE their turnout (no grant)', async () => {
			await lisa.from('participation').update({ turned_up: false }).eq('id', lisaParticipationG1);
			const { data } = await admin
				.from('participation')
				.select('turned_up')
				.eq('id', lisaParticipationG1)
				.single();
			expect(data?.turned_up, 'no UPDATE grant — turnout unchanged').toBe(true);
		});
	});

	describe('slot uniqueness', () => {
		it('rejects a second gatherings row for the same slot', async () => {
			const { error } = await admin
				.from('gatherings')
				.insert({ slot_id: slotG1, prompt_id: promptG1, host_id: TEST_USERS.lisa.id });
			expect(error).not.toBeNull();
			expect(error?.code).toBe('23505'); // unique_violation
		});
	});

	describe('attested_by', () => {
		it('accepts a co-participant id as the attester', async () => {
			// The host lisa's turnout attested by co-participant marco. (Semantic
			// "must be a co-participant" is enforced by the U5 RPC; the column
			// accepts a valid co-participant identity here.)
			const { error } = await admin
				.from('participation')
				.update({ attested_by: TEST_USERS.marco.id })
				.eq('id', lisaParticipationG1);
			expect(error, error?.message).toBeNull();
			const { data } = await admin
				.from('participation')
				.select('attested_by')
				.eq('id', lisaParticipationG1)
				.single();
			expect(data?.attested_by).toBe(TEST_USERS.marco.id);
		});
	});
});
