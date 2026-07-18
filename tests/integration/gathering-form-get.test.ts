import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createAdminClient, createAuthenticatedClient, TEST_USERS } from '../helpers/auth.js';
import { GET } from '../../src/routes/api/feedback/gathering/[id]/+server.js';

/**
 * Agent-parity GET for the gathering feedback form (#60). A programmatic caller
 * that hits the gathering gate (403 { kind:'gathering', formId }) can now READ
 * the form state without scraping the HTML page, mirroring the UI loader at
 * src/routes/(app)/feedback/gathering/[id]/+page.server.ts.
 *
 * Same auth + RLS posture as the loader: 401 unauthenticated, 404 (no leak) for
 * a non-participant or unknown id, `status:'done'` when the caller already
 * confirmed, and the full form payload (roster + vocabulary + host flag +
 * kill-switch) when the obligation is still due.
 */

const stubLocation = { place_id: 'test-place', name: 'Test venue', address: 'Test address', lat: 52.5, lng: 13.4 };
const admin = createAdminClient();

interface Fixture {
	prompt: string;
	slot: string;
	gathering: string;
}

// host + joiners; every participation row is 'due' (self_report NULL) unless
// overridden per-member afterwards.
async function setupGathering(promptId: string, host: { id: string }, joiners: { id: string }[]): Promise<Fixture> {
	const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
	await admin
		.from('prompts')
		.insert([{ id: promptId, author_id: host.id, title: 'GET', state: 'published', region: 'berlin', published_at: new Date().toISOString() }])
		.throwOnError();
	const { data: slots } = await admin
		.from('time_slots')
		.insert([{ prompt_id: promptId, start_time: future, duration_minutes: 60, exact_location: stubLocation, general_area: 'Mitte' }])
		.select('id')
		.throwOnError();
	const slot = slots![0].id;
	const { data: invites } = await admin
		.from('prompt_invitations')
		.insert(joiners.map((j) => ({ prompt_id: promptId, slot_id: slot, inviter_id: j.id, invitee_id: host.id, state: 'accepted' })))
		.select('id, inviter_id')
		.throwOnError();
	await admin
		.from('meetings')
		.insert(
			joiners.map((j) => ({
				invitation_id: invites!.find((i) => i.inviter_id === j.id)!.id,
				slot_id: slot,
				participant_a: host.id,
				participant_b: j.id,
				prompt_id: promptId,
				scheduled_time: future,
				duration_minutes: 60
			}))
		)
		.throwOnError();
	const { data: gatherings } = await admin
		.from('gatherings')
		.insert([{ slot_id: slot, prompt_id: promptId, host_id: host.id }])
		.select('id')
		.throwOnError();
	const gathering = gatherings![0].id;
	const members = [{ id: host.id, is_host: true }, ...joiners.map((j) => ({ id: j.id, is_host: false }))];
	await admin
		.from('participation')
		.insert(members.map((m) => ({ gathering_id: gathering, member_id: m.id, is_host: m.is_host, turned_up: false, self_report: null })))
		.throwOnError();
	return { prompt: promptId, slot, gathering };
}

async function teardown(fx: Fixture) {
	await admin.from('participation').delete().eq('gathering_id', fx.gathering);
	await admin.from('gatherings').delete().eq('id', fx.gathering);
	await admin.from('meetings').delete().eq('prompt_id', fx.prompt);
	await admin.from('prompt_invitations').delete().eq('prompt_id', fx.prompt);
	await admin.from('time_slots').delete().eq('prompt_id', fx.prompt);
	await admin.from('prompts').delete().eq('id', fx.prompt);
}

function makeEvent(opts: { id: string; supabase?: SupabaseClient; user?: User }) {
	return {
		params: { id: opts.id },
		locals: { supabase: opts.supabase, user: opts.user },
		request: new Request('http://localhost/api/feedback/gathering/x', { method: 'GET' })
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

describe('GET /api/feedback/gathering/[id] — agent-parity (#60)', () => {
	const stamp = Date.now();
	const promptG = `gfg-${stamp}`;
	let lisa: SupabaseClient; // host
	let marco: SupabaseClient; // due joiner
	let ben: SupabaseClient; // confirmed joiner
	let ava: SupabaseClient; // non-participant
	let lisaUser: User;
	let marcoUser: User;
	let benUser: User;
	let avaUser: User;
	let fx: Fixture;

	beforeAll(async () => {
		[lisa, marco, ben, ava] = await Promise.all([
			createAuthenticatedClient(TEST_USERS.lisa.email, TEST_USERS.lisa.password),
			createAuthenticatedClient(TEST_USERS.marco.email, TEST_USERS.marco.password),
			createAuthenticatedClient(TEST_USERS.ben.email, TEST_USERS.ben.password),
			createAuthenticatedClient(TEST_USERS.ava.email, TEST_USERS.ava.password)
		]);
		[lisaUser, marcoUser, benUser, avaUser] = await Promise.all([
			lisa.auth.getUser().then((r) => r.data.user!),
			marco.auth.getUser().then((r) => r.data.user!),
			ben.auth.getUser().then((r) => r.data.user!),
			ava.auth.getUser().then((r) => r.data.user!)
		]);
		fx = await setupGathering(promptG, TEST_USERS.lisa, [TEST_USERS.marco, TEST_USERS.ben]);
		// ben has already confirmed attendance.
		await admin
			.from('participation')
			.update({ turned_up: true, self_report: 'attended' })
			.eq('gathering_id', fx.gathering)
			.eq('member_id', TEST_USERS.ben.id)
			.throwOnError();
	});

	afterAll(() => teardown(fx));

	it('401 when unauthenticated', async () => {
		let status = 0;
		try {
			await GET(makeEvent({ id: fx.gathering }));
		} catch (e) {
			status = (e as { status?: number }).status ?? 0;
		}
		expect(status).toBe(401);
	});

	it('a due joiner gets status:due with roster + vocabulary + host flag', async () => {
		const res = await GET(makeEvent({ id: fx.gathering, supabase: marco, user: marcoUser }));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.status).toBe('due');
		expect(body.gatheringId).toBe(fx.gathering);
		expect(body.slotId).toBe(fx.slot);
		expect(body.isHost).toBe(false);
		expect(Array.isArray(body.roster)).toBe(true);
		// Roster excludes the caller; the host (lisa) must appear.
		expect(body.roster.some((r: { member_id: string }) => r.member_id === TEST_USERS.lisa.id)).toBe(true);
		expect(body.roster.some((r: { member_id: string }) => r.member_id === TEST_USERS.marco.id)).toBe(false);
		expect(Array.isArray(body.vocabulary)).toBe(true);
		expect(typeof body.safetyReportingEnabled).toBe('boolean');
	});

	it('the host sees isHost:true', async () => {
		const res = await GET(makeEvent({ id: fx.gathering, supabase: lisa, user: lisaUser }));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.status).toBe('due');
		expect(body.isHost).toBe(true);
	});

	it('an already-confirmed participant gets status:done (nothing due)', async () => {
		const res = await GET(makeEvent({ id: fx.gathering, supabase: ben, user: benUser }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ status: 'done' });
	});

	it('a non-participant gets 404 (no existence leak)', async () => {
		const res = await GET(makeEvent({ id: fx.gathering, supabase: ava, user: avaUser }));
		expect(res.status).toBe(404);
		expect((await res.json()).error).toBe('not_found');
	});

	it('an unknown gathering id gets 404 (no existence leak)', async () => {
		const res = await GET(
			makeEvent({ id: '00000000-0000-0000-0000-000000000000', supabase: marco, user: marcoUser })
		);
		expect(res.status).toBe(404);
	});
});
