import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, createAuthenticatedClient, TEST_USERS } from '../helpers/auth.js';

/**
 * get_gathering_roster RPC (feat: unified gathering feedback, U6).
 *
 * The post-gathering feedback form centres on the co-participants ("the people
 * you met"), but participation RLS is own-row-only (U1) — a caller cannot read a
 * co-participant's row directly. This SECURITY DEFINER RPC is the sanctioned read
 * path: it returns the roster (caller EXCLUDED) for a gathering the caller
 * participates in, and an empty set for a non-participant (guarded; no leak).
 *
 * Fixtures (mirror gatherings-rls.test.ts):
 *   G1 (slot on lisa's prompt): lisa (host, turned up) + marco (turned up).
 *   G2 (slot on ava's prompt):  ava  (host)           + ben.
 * lisa/marco can read G1's roster; ava is NOT in G1 and must get an empty set.
 */
describe('get_gathering_roster RPC (U6)', () => {
	const admin = createAdminClient();
	let lisa: SupabaseClient;
	let marco: SupabaseClient;
	let ava: SupabaseClient;

	const stamp = Date.now();
	const promptG1 = `roster-g1-${stamp}`;
	const promptG2 = `roster-g2-${stamp}`;
	let gatheringG1: string;
	let gatheringG2: string;

	const stubLocation = {
		place_id: 'test-place',
		name: 'Test venue',
		address: 'Test address',
		lat: 52.5,
		lng: 13.4
	};

	async function cleanup() {
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
		const slotG1 = slots!.find((s) => s.prompt_id === promptG1)!.id;
		const slotG2 = slots!.find((s) => s.prompt_id === promptG2)!.id;

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

		await admin
			.from('participation')
			.insert([
				{ gathering_id: gatheringG1, member_id: TEST_USERS.lisa.id, is_host: true, turned_up: true, self_report: 'attended' },
				{ gathering_id: gatheringG1, member_id: TEST_USERS.marco.id, is_host: false, turned_up: true, self_report: 'attended' },
				{ gathering_id: gatheringG2, member_id: TEST_USERS.ava.id, is_host: true, turned_up: true, self_report: 'attended' },
				{ gathering_id: gatheringG2, member_id: TEST_USERS.ben.id, is_host: false, turned_up: false, self_report: 'absent' }
			])
			.throwOnError();
	});

	afterAll(cleanup);

	it('a participant reads the co-participant roster, EXCLUDING themselves', async () => {
		const { data, error } = await lisa.rpc('get_gathering_roster', { p_gathering: gatheringG1 });
		expect(error, error?.message).toBeNull();
		expect(data).toHaveLength(1);
		expect(data![0].member_id).toBe(TEST_USERS.marco.id);
		expect(data![0].is_host).toBe(false);
		expect(data![0].turned_up).toBe(true);
		// A display name is always resolved (never null / raw id when a profile exists).
		expect(typeof data![0].display_name).toBe('string');
		expect(data![0].display_name.length).toBeGreaterThan(0);
	});

	it('a joiner reads the roster and sees the host', async () => {
		const { data, error } = await marco.rpc('get_gathering_roster', { p_gathering: gatheringG1 });
		expect(error, error?.message).toBeNull();
		expect(data).toHaveLength(1);
		expect(data![0].member_id).toBe(TEST_USERS.lisa.id);
		expect(data![0].is_host).toBe(true);
	});

	it('a NON-participant gets an empty set (guarded — no leak)', async () => {
		// ava is in G2, not G1 — she must not read G1's roster.
		const { data, error } = await ava.rpc('get_gathering_roster', { p_gathering: gatheringG1 });
		expect(error, error?.message).toBeNull();
		expect(data).toEqual([]);
	});

	it('reflects turnout — a no-show co-participant is flagged turned_up=false', async () => {
		const { data, error } = await ava.rpc('get_gathering_roster', { p_gathering: gatheringG2 });
		expect(error, error?.message).toBeNull();
		expect(data).toHaveLength(1);
		expect(data![0].member_id).toBe(TEST_USERS.ben.id);
		expect(data![0].turned_up).toBe(false);
	});
});
