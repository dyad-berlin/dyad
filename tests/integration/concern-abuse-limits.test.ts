import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createAdminClient, createAuthenticatedClient, TEST_USERS } from '../helpers/auth.js';

/**
 * Abuse limits on the safeguarding-concern path (feat: unified gathering
 * feedback; issue #57). submit_concern now enforces, in its SECURITY DEFINER
 * body:
 *   * DEDUP — an exact-duplicate concern (same reporter, slot, scope, kind,
 *     subject, detail) is an idempotent no-op, backed by a UNIQUE INDEX.
 *   * CAP — a reporter may file at most MAX_CONCERNS_PER_SLOT (20) DISTINCT
 *     concerns on one slot; beyond that the RPC RAISEs 'concern_cap_reached',
 *     which the service maps to a clean 429 at the endpoint.
 *
 * These drive the real RPC (RLS-scoped client) and the real POST handler with a
 * RequestEvent-shaped `locals` (mirrors report-endpoint.test.ts /
 * feedback-write.test.ts). The kill-switch is re-enforced in the RPC body, so the
 * DB flag is set ON for the write cases and the endpoint's app-layer mock returns
 * true; the dark default is restored afterwards.
 */

const CAP = 20; // keep in sync with v_cap in 20260718120000_concern_abuse_limits.sql

// Kill-switch mock — only the concern endpoint reads it. vi.hoisted so the
// factory can reference it (mirrors feedback-write.test.ts).
const { killSwitch } = vi.hoisted(() => ({ killSwitch: vi.fn().mockResolvedValue(true) }));
vi.mock('$lib/server/app-settings.js', () => ({ getSafetyReportingEnabled: killSwitch }));

const stubLocation = {
	place_id: 'test-place',
	name: 'Test venue',
	address: 'Test address',
	lat: 52.5,
	lng: 13.4
};

const admin = createAdminClient();

interface Fixture {
	prompt: string;
	slot: string;
	gathering: string;
}

// Build a group gathering: prompt + slot + a star of host<->joiner meetings (so
// app.is_slot_participant sees every member), and one participation row per
// member. Mirrors feedback-write.test.ts::setupGathering.
async function setupGathering(
	promptId: string,
	host: { id: string },
	joiners: { id: string }[]
): Promise<Fixture> {
	const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

	await admin
		.from('prompts')
		.insert([{ id: promptId, author_id: host.id, title: 'CAL', state: 'published', region: 'berlin', published_at: new Date().toISOString() }])
		.throwOnError();

	const { data: slots } = await admin
		.from('time_slots')
		.insert([{ prompt_id: promptId, start_time: future, duration_minutes: 60, exact_location: stubLocation, general_area: 'Mitte' }])
		.select('id')
		.throwOnError();
	const slot = slots![0].id;

	const { data: invites } = await admin
		.from('prompt_invitations')
		.insert(
			joiners.map((j) => ({ prompt_id: promptId, slot_id: slot, inviter_id: j.id, invitee_id: host.id, state: 'accepted' }))
		)
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
		.insert(members.map((m) => ({ gathering_id: gathering, member_id: m.id, is_host: m.is_host, turned_up: true, self_report: 'attended' })))
		.throwOnError();

	return { prompt: promptId, slot, gathering };
}

async function teardown(fx: Fixture) {
	await admin.from('safety_concerns').delete().eq('slot_id', fx.slot);
	await admin.from('participation').delete().eq('gathering_id', fx.gathering);
	await admin.from('gatherings').delete().eq('id', fx.gathering);
	await admin.from('meetings').delete().eq('prompt_id', fx.prompt);
	await admin.from('prompt_invitations').delete().eq('prompt_id', fx.prompt);
	await admin.from('time_slots').delete().eq('prompt_id', fx.prompt);
	await admin.from('prompts').delete().eq('id', fx.prompt);
}

async function countConcerns(slot: string, reporter: string): Promise<number> {
	const { data } = await admin
		.from('safety_concerns')
		.select('id')
		.eq('slot_id', slot)
		.eq('reporter_id', reporter);
	return (data ?? []).length;
}

// RequestEvent shim (mirrors feedback-write.test.ts).
function makeEvent(opts: { supabase?: SupabaseClient; user?: User; body?: unknown }) {
	return {
		params: {},
		locals: { supabase: opts.supabase, user: opts.user },
		request: new Request('http://localhost/api/feedback/gathering/concern', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: opts.body === undefined ? '' : JSON.stringify(opts.body)
		})
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

describe('Concern abuse limits (#57)', () => {
	const stamp = Date.now();
	let lisa: SupabaseClient;
	let sophie: SupabaseClient;
	let sophieUser: User;

	let concernPOST: typeof import('../../src/routes/api/feedback/gathering/concern/+server.js').POST;

	beforeAll(async () => {
		[lisa, sophie] = await Promise.all([
			createAuthenticatedClient(TEST_USERS.lisa.email, TEST_USERS.lisa.password),
			createAuthenticatedClient(TEST_USERS.sophie.email, TEST_USERS.sophie.password)
		]);
		sophieUser = (await sophie.auth.getUser()).data.user!;

		// The RPC re-enforces the R9 kill-switch against the live app_settings row,
		// so the DB flag must actually be ON for any insert to land.
		await admin
			.from('app_settings')
			.upsert({ key: 'safety_reporting_enabled', value: true }, { onConflict: 'key' })
			.throwOnError();

		({ POST: concernPOST } = await import('../../src/routes/api/feedback/gathering/concern/+server.js'));
	});

	afterAll(async () => {
		await admin
			.from('app_settings')
			.upsert({ key: 'safety_reporting_enabled', value: false }, { onConflict: 'key' })
			.throwOnError();
	});

	describe('dedup — identical concern is an idempotent no-op', () => {
		const promptD = `cal-dedup-${stamp}`;
		let fx: Fixture;

		beforeAll(async () => {
			fx = await setupGathering(promptD, TEST_USERS.lisa, [TEST_USERS.marco]);
		});
		afterAll(() => teardown(fx));

		it('the same (scope,kind,subject,detail) filed twice stores exactly one row', async () => {
			const args = {
				p_slot: fx.slot,
				p_scope: 'person',
				p_kind: 'other',
				p_subject: TEST_USERS.marco.id,
				p_gathering: fx.gathering,
				p_detail: 'Identical detail text.'
			};
			const first = await lisa.rpc('submit_concern', args);
			expect(first.error, first.error?.message).toBeNull();
			const second = await lisa.rpc('submit_concern', args);
			// No-op, NOT an error — the RPC swallows the unique_violation.
			expect(second.error, second.error?.message).toBeNull();

			expect(await countConcerns(fx.slot, TEST_USERS.lisa.id)).toBe(1);
		});

		it('a differing detail is a DISTINCT concern (dedup keys on content, not just target)', async () => {
			const { error } = await lisa.rpc('submit_concern', {
				p_slot: fx.slot,
				p_scope: 'person',
				p_kind: 'other',
				p_subject: TEST_USERS.marco.id,
				p_gathering: fx.gathering,
				p_detail: 'A genuinely different note.'
			});
			expect(error, error?.message).toBeNull();
			expect(await countConcerns(fx.slot, TEST_USERS.lisa.id)).toBe(2);
		});
	});

	describe('cap — per-reporter ceiling of DISTINCT concerns on one slot', () => {
		const promptC = `cal-cap-${stamp}`;
		let fx: Fixture;

		beforeAll(async () => {
			fx = await setupGathering(promptC, TEST_USERS.sophie, [TEST_USERS.tom]);
		});
		afterAll(() => teardown(fx));

		it(`the ${CAP}th distinct concern succeeds and the ${CAP + 1}th is rejected by the RPC`, async () => {
			// Fill to the cap with CAP distinct concerns (varying detail).
			for (let i = 0; i < CAP; i++) {
				const { error } = await sophie.rpc('submit_concern', {
					p_slot: fx.slot,
					p_scope: 'person',
					p_kind: 'other',
					p_subject: TEST_USERS.tom.id,
					p_gathering: fx.gathering,
					p_detail: `concern ${i}`
				});
				expect(error, `concern ${i} should insert: ${error?.message}`).toBeNull();
			}
			expect(await countConcerns(fx.slot, TEST_USERS.sophie.id)).toBe(CAP);

			// One past the cap — the RPC raises.
			const over = await sophie.rpc('submit_concern', {
				p_slot: fx.slot,
				p_scope: 'person',
				p_kind: 'other',
				p_subject: TEST_USERS.tom.id,
				p_gathering: fx.gathering,
				p_detail: 'one too many'
			});
			expect(over.error, 'the concern past the cap must be rejected').not.toBeNull();
			expect(over.error!.message).toContain('concern_cap_reached');

			// No extra row landed.
			expect(await countConcerns(fx.slot, TEST_USERS.sophie.id)).toBe(CAP);
		});

		it('the endpoint surfaces the cap as a clean 429 (not a 500)', async () => {
			// The slot is already at the cap from the RPC test above.
			const res = await concernPOST(
				makeEvent({
					supabase: sophie,
					user: sophieUser,
					body: {
						slot_id: fx.slot,
						scope: 'person',
						kind: 'other',
						subject_id: TEST_USERS.tom.id,
						gathering_id: fx.gathering,
						detail: 'over the cap via endpoint'
					}
				})
			);
			expect(res.status).toBe(429);
			// Generic, safe message — no internal detail leaks.
			const bodyJson = await res.json();
			expect(bodyJson.error).toBeTruthy();
			expect(bodyJson.error).not.toContain('concern_cap_reached');
		});
	});
});
