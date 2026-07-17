import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createAdminClient, createAuthenticatedClient, TEST_USERS } from '../helpers/auth.js';

/**
 * Unified gathering feedback — WRITE PATH (feat: unified gathering feedback, U5).
 *
 * Exercises the SECURITY DEFINER RPCs against a real local Supabase (via
 * authenticated + service-role clients), then drives the SvelteKit endpoints
 * directly (RequestEvent-shaped locals carrying the caller's RLS-scoped client),
 * asserting the API standards (JSON, 400 on malformed body, 401 unauthenticated).
 *
 * RPC gates under test:
 *   * submit_attendance — caller records own turnout; only the HOST may attest
 *     others; a non-host attesting is rejected; a non-participant is rejected.
 *   * submit_public_feedback — turnout gate + tag-vocabulary validation.
 *   * promote_public_feedback — subject-only (returns boolean).
 *   * submit_concern — scheduled-co-membership gate (turnout-blind); self-report
 *     and non-participant rejected.
 *
 * The reporting kill-switch is an app-layer check; the concern-endpoint block
 * mocks getSafetyReportingEnabled so both on (200) and off (403) are covered
 * without touching $env in the integration runner.
 */

// Kill-switch mock — only the concern endpoint reads it. vi.hoisted so the
// factory can reference it (mirrors notification-emails.membership.test.ts).
const { killSwitch } = vi.hoisted(() => ({ killSwitch: vi.fn().mockResolvedValue(true) }));
vi.mock('$lib/server/app-settings.js', () => ({ getSafetyReportingEnabled: killSwitch }));

const stubLocation = {
	place_id: 'test-place',
	name: 'Test venue',
	address: 'Test address',
	lat: 52.5,
	lng: 13.4
};

interface Fixture {
	prompt: string;
	slot: string;
	gathering: string;
}

const admin = createAdminClient();

/**
 * Build a group gathering: prompt + slot + gathering, a star of host<->joiner
 * meetings (so app.is_slot_participant sees every member), and one participation
 * row per member. `attended` seeds turned_up=true/self_report='attended'; false
 * seeds the 'due' state (turned_up=false, self_report=null) so submit_attendance
 * has a transition to make.
 */
async function setupGathering(
	promptId: string,
	host: { id: string },
	joiners: { id: string }[],
	attended: boolean
): Promise<Fixture> {
	const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

	await admin
		.from('prompts')
		.insert([
			{ id: promptId, author_id: host.id, title: 'FW', state: 'published', region: 'berlin', published_at: new Date().toISOString() }
		])
		.throwOnError();

	const { data: slots } = await admin
		.from('time_slots')
		.insert([{ prompt_id: promptId, start_time: future, duration_minutes: 60, exact_location: stubLocation, general_area: 'Mitte' }])
		.select('id')
		.throwOnError();
	const slot = slots![0].id;

	// Invitations back the meetings (meetings.invitation_id is NOT NULL UNIQUE).
	const { data: invites } = await admin
		.from('prompt_invitations')
		.insert(
			joiners.map((j) => ({
				prompt_id: promptId,
				slot_id: slot,
				inviter_id: j.id,
				invitee_id: host.id,
				state: 'accepted'
			}))
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
		.insert(
			members.map((m) => ({
				gathering_id: gathering,
				member_id: m.id,
				is_host: m.is_host,
				turned_up: attended,
				self_report: attended ? 'attended' : null
			}))
		)
		.throwOnError();

	return { prompt: promptId, slot, gathering };
}

async function teardown(prompts: string[], slots: string[], gatherings: string[]) {
	await admin.from('safety_concerns').delete().in('slot_id', slots);
	await admin.from('public_feedback').delete().in('gathering_id', gatherings);
	await admin.from('gathering_feedback').delete().in('gathering_id', gatherings);
	await admin.from('participation').delete().in('gathering_id', gatherings);
	await admin.from('gatherings').delete().in('id', gatherings);
	await admin.from('meetings').delete().in('prompt_id', prompts);
	await admin.from('prompt_invitations').delete().in('prompt_id', prompts);
	await admin.from('time_slots').delete().in('prompt_id', prompts);
	await admin.from('prompts').delete().in('id', prompts);
}

// ── RPC-level ───────────────────────────────────────────────────────────────

describe('gathering write RPCs (U5)', () => {
	const stamp = Date.now();
	const promptR = `fw-rpc-${stamp}`;
	let lisa: SupabaseClient;
	let marco: SupabaseClient;
	let ava: SupabaseClient;
	let ben: SupabaseClient;
	let nina: SupabaseClient;
	let fx: Fixture;

	beforeAll(async () => {
		[lisa, marco, ava, ben, nina] = await Promise.all([
			createAuthenticatedClient(TEST_USERS.lisa.email, TEST_USERS.lisa.password),
			createAuthenticatedClient(TEST_USERS.marco.email, TEST_USERS.marco.password),
			createAuthenticatedClient(TEST_USERS.ava.email, TEST_USERS.ava.password),
			createAuthenticatedClient(TEST_USERS.ben.email, TEST_USERS.ben.password),
			createAuthenticatedClient(TEST_USERS.nina.email, TEST_USERS.nina.password)
		]);
		// 'due' state — submit_attendance must transition it.
		fx = await setupGathering(promptR, TEST_USERS.lisa, [TEST_USERS.marco, TEST_USERS.ava, TEST_USERS.ben], false);
	});

	afterAll(() => teardown([promptR], [fx.slot], [fx.gathering]));

	describe('submit_attendance', () => {
		it('a participant self-reports attendance (turned_up derived from self_report)', async () => {
			const { error } = await marco.rpc('submit_attendance', {
				p_gathering: fx.gathering,
				p_self_report: 'attended'
			});
			expect(error, error?.message).toBeNull();

			const { data } = await admin
				.from('participation')
				.select('turned_up, self_report')
				.eq('gathering_id', fx.gathering)
				.eq('member_id', TEST_USERS.marco.id)
				.single();
			expect(data!.turned_up).toBe(true);
			expect(data!.self_report).toBe('attended');
		});

		it('the HOST attests others’ turnout (attested_by = host)', async () => {
			const { error } = await lisa.rpc('submit_attendance', {
				p_gathering: fx.gathering,
				p_self_report: 'attended',
				p_turnout: { [TEST_USERS.ava.id]: true, [TEST_USERS.ben.id]: false }
			});
			expect(error, error?.message).toBeNull();

			const { data } = await admin
				.from('participation')
				.select('member_id, turned_up, attested_by')
				.eq('gathering_id', fx.gathering)
				.in('member_id', [TEST_USERS.ava.id, TEST_USERS.ben.id]);
			const byId = Object.fromEntries(data!.map((r) => [r.member_id, r]));
			expect(byId[TEST_USERS.ava.id].turned_up).toBe(true);
			expect(byId[TEST_USERS.ava.id].attested_by).toBe(TEST_USERS.lisa.id);
			expect(byId[TEST_USERS.ben.id].turned_up).toBe(false);
			expect(byId[TEST_USERS.ben.id].attested_by).toBe(TEST_USERS.lisa.id);
		});

		it('a NON-host cannot attest others', async () => {
			const { error } = await marco.rpc('submit_attendance', {
				p_gathering: fx.gathering,
				p_self_report: 'attended',
				p_turnout: { [TEST_USERS.ava.id]: false }
			});
			expect(error, 'a non-host attesting others must be rejected').not.toBeNull();

			// ava's turnout is unchanged (still true from the host's attestation).
			const { data } = await admin
				.from('participation')
				.select('turned_up')
				.eq('gathering_id', fx.gathering)
				.eq('member_id', TEST_USERS.ava.id)
				.single();
			expect(data!.turned_up).toBe(true);
		});

		it('a non-participant cannot submit attendance', async () => {
			const { error } = await nina.rpc('submit_attendance', {
				p_gathering: fx.gathering,
				p_self_report: 'attended'
			});
			expect(error, 'a non-participant must be rejected').not.toBeNull();
		});
	});

	describe('submit_public_feedback', () => {
		it('inserts with valid vocabulary tags when both turned up (marco -> ava)', async () => {
			const { error } = await marco.rpc('submit_public_feedback', {
				p_gathering: fx.gathering,
				p_reviewee: TEST_USERS.ava.id,
				p_tags: ['thoughtful', 'curious'],
				p_free_text: 'Good chat.'
			});
			expect(error, error?.message).toBeNull();

			const { data } = await admin
				.from('public_feedback')
				.select('tags')
				.eq('gathering_id', fx.gathering)
				.eq('reviewer_id', TEST_USERS.marco.id)
				.eq('reviewee_id', TEST_USERS.ava.id)
				.single();
			expect(data!.tags).toEqual(['thoughtful', 'curious']);
		});

		it('rejects an out-of-vocabulary tag', async () => {
			const { error } = await marco.rpc('submit_public_feedback', {
				p_gathering: fx.gathering,
				p_reviewee: TEST_USERS.ava.id,
				p_tags: ['thoughtful', 'not_a_real_vocab_word']
			});
			expect(error, 'an out-of-vocabulary tag must be rejected').not.toBeNull();
		});

		it('rejects an edge naming a participant who did not turn up (ben)', async () => {
			const { error } = await marco.rpc('submit_public_feedback', {
				p_gathering: fx.gathering,
				p_reviewee: TEST_USERS.ben.id,
				p_tags: ['warm']
			});
			expect(error, 'both_present must reject an absent reviewee').not.toBeNull();
		});
	});

	describe('promote_public_feedback (subject-only)', () => {
		async function feedbackId(): Promise<string> {
			const { data } = await admin
				.from('public_feedback')
				.select('id')
				.eq('gathering_id', fx.gathering)
				.eq('reviewer_id', TEST_USERS.marco.id)
				.eq('reviewee_id', TEST_USERS.ava.id)
				.single();
			return data!.id;
		}

		it('a non-subject promotion is a no-op (returns false)', async () => {
			const id = await feedbackId();
			const { data, error } = await ben.rpc('promote_public_feedback', { p_feedback_id: id });
			expect(error, error?.message).toBeNull();
			expect(data).toBe(false);
			const { data: row } = await admin.from('public_feedback').select('made_public_at').eq('id', id).single();
			expect(row!.made_public_at).toBeNull();
		});

		it('the SUBJECT promotes it (returns true, made_public_at set)', async () => {
			const id = await feedbackId();
			const { data, error } = await ava.rpc('promote_public_feedback', { p_feedback_id: id });
			expect(error, error?.message).toBeNull();
			expect(data).toBe(true);
			const { data: row } = await admin.from('public_feedback').select('made_public_at').eq('id', id).single();
			expect(row!.made_public_at).not.toBeNull();
		});
	});

	describe('submit_concern (turnout-blind co-membership gate)', () => {
		// The RPC re-enforces the R9 kill-switch in its own body, so writes only
		// succeed with the flag ON. Set it for the gate tests; the last test flips
		// it OFF to prove the in-RPC guard fails closed. Restore dark default after.
		beforeAll(async () => {
			await admin
				.from('app_settings')
				.upsert({ key: 'safety_reporting_enabled', value: true }, { onConflict: 'key' })
				.throwOnError();
		});
		afterAll(async () => {
			await admin
				.from('app_settings')
				.upsert({ key: 'safety_reporting_enabled', value: false }, { onConflict: 'key' })
				.throwOnError();
		});

		it('a co-participant files a no_show concern about another (steward-readable)', async () => {
			const { error } = await lisa.rpc('submit_concern', {
				p_slot: fx.slot,
				p_scope: 'person',
				p_kind: 'no_show',
				p_subject: TEST_USERS.marco.id,
				p_gathering: fx.gathering,
				p_detail: 'Did not attend.'
			});
			expect(error, error?.message).toBeNull();

			const { data } = await admin
				.from('safety_concerns')
				.select('kind, reporter_id')
				.eq('slot_id', fx.slot)
				.eq('subject_id', TEST_USERS.marco.id);
			expect((data ?? []).length).toBeGreaterThanOrEqual(1);
			expect(data!.some((r) => r.kind === 'no_show' && r.reporter_id === TEST_USERS.lisa.id)).toBe(true);
		});

		it('rejects a self-report', async () => {
			const { error } = await lisa.rpc('submit_concern', {
				p_slot: fx.slot,
				p_scope: 'person',
				p_kind: 'other',
				p_subject: TEST_USERS.lisa.id
			});
			expect(error, 'a self-report must be rejected').not.toBeNull();
		});

		it('rejects a non-participant reporter', async () => {
			const { error } = await nina.rpc('submit_concern', {
				p_slot: fx.slot,
				p_scope: 'person',
				p_kind: 'other',
				p_subject: TEST_USERS.marco.id
			});
			expect(error, 'a non-participant reporter must be rejected by the gate').not.toBeNull();
		});

		it('the RPC itself rejects when the kill-switch is off (R9, defense in depth)', async () => {
			// A direct RPC call bypasses the endpoint check, so the RPC must fail
			// closed on its own — the dark-launch guarantee cannot rest on the
			// endpoint alone. Flip the flag off, attempt an otherwise-valid concern,
			// expect rejection; restore on for the afterAll's benefit.
			await admin
				.from('app_settings')
				.upsert({ key: 'safety_reporting_enabled', value: false }, { onConflict: 'key' })
				.throwOnError();
			const { error } = await lisa.rpc('submit_concern', {
				p_slot: fx.slot,
				p_scope: 'person',
				p_kind: 'no_show',
				p_subject: TEST_USERS.ava.id,
				p_gathering: fx.gathering,
				p_detail: 'Should be blocked while dark.'
			});
			expect(error, 'the RPC must reject when reporting is disabled').not.toBeNull();
			await admin
				.from('app_settings')
				.upsert({ key: 'safety_reporting_enabled', value: true }, { onConflict: 'key' })
				.throwOnError();
		});
	});
});

// ── Endpoint-level ────────────────────────────────────────────────────────

// Build a RequestEvent-shaped object good enough for the handlers. They read
// params, locals.user, locals.supabase, and request.json(). Mirrors
// tests/integration/report-endpoint.test.ts.
function makeEvent(opts: {
	params?: Record<string, string>;
	supabase?: SupabaseClient;
	user?: User;
	body?: unknown;
	rawBody?: string;
}) {
	const body = opts.rawBody ?? (opts.body === undefined ? '' : JSON.stringify(opts.body));
	return {
		params: opts.params ?? {},
		locals: { supabase: opts.supabase, user: opts.user },
		request: new Request('http://localhost/api/feedback/gathering/x', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body
		})
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

async function statusOfThrow(fn: () => unknown): Promise<number> {
	try {
		await fn();
		throw new Error('expected the handler to throw');
	} catch (e) {
		return (e as { status?: number }).status ?? 0;
	}
}

describe('gathering feedback endpoints (U5)', () => {
	const stamp = Date.now();
	const promptE = `fw-ep-${stamp}`;
	let sophie: SupabaseClient;
	let tom: SupabaseClient;
	let kai: SupabaseClient;
	let sophieUser: User;
	let tomUser: User;
	let kaiUser: User;
	let fx: Fixture;

	// Handlers imported dynamically so the app-settings mock is in place first.
	let attendancePOST: typeof import('../../src/routes/api/feedback/gathering/attendance/+server.js').POST;
	let publicPOST: typeof import('../../src/routes/api/feedback/gathering/public/+server.js').POST;
	let promotePOST: typeof import('../../src/routes/api/feedback/gathering/public/[id]/promote/+server.js').POST;
	let concernPOST: typeof import('../../src/routes/api/feedback/gathering/concern/+server.js').POST;

	beforeAll(async () => {
		[sophie, tom, kai] = await Promise.all([
			createAuthenticatedClient(TEST_USERS.sophie.email, TEST_USERS.sophie.password),
			createAuthenticatedClient(TEST_USERS.tom.email, TEST_USERS.tom.password),
			createAuthenticatedClient(TEST_USERS.kai.email, TEST_USERS.kai.password)
		]);
		sophieUser = (await sophie.auth.getUser()).data.user!;
		tomUser = (await tom.auth.getUser()).data.user!;
		kaiUser = (await kai.auth.getUser()).data.user!;

		// Everyone turned up so both_present holds for the public/promote endpoints.
		fx = await setupGathering(promptE, TEST_USERS.sophie, [TEST_USERS.tom, TEST_USERS.kai], true);

		({ POST: attendancePOST } = await import('../../src/routes/api/feedback/gathering/attendance/+server.js'));
		({ POST: publicPOST } = await import('../../src/routes/api/feedback/gathering/public/+server.js'));
		({ POST: promotePOST } = await import('../../src/routes/api/feedback/gathering/public/[id]/promote/+server.js'));
		({ POST: concernPOST } = await import('../../src/routes/api/feedback/gathering/concern/+server.js'));
	});

	afterAll(() => teardown([promptE], [fx.slot], [fx.gathering]));

	describe('attendance endpoint', () => {
		it('returns JSON ok for a valid self-report', async () => {
			const res = await attendancePOST(
				makeEvent({ supabase: tom, user: tomUser, body: { gathering_id: fx.gathering, self_report: 'attended' } })
			);
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ ok: true });
		});

		it('400 on malformed JSON body', async () => {
			const res = await attendancePOST(makeEvent({ supabase: tom, user: tomUser, rawBody: '{not json' }));
			expect(res.status).toBe(400);
			expect((await res.json()).error).toBeTruthy();
		});

		it('400 on an invalid self_report', async () => {
			const res = await attendancePOST(
				makeEvent({ supabase: tom, user: tomUser, body: { gathering_id: fx.gathering, self_report: 'nope' } })
			);
			expect(res.status).toBe(400);
		});

		it('401 when unauthenticated', async () => {
			const status = await statusOfThrow(() =>
				attendancePOST(makeEvent({ body: { gathering_id: fx.gathering, self_report: 'attended' } }))
			);
			expect(status).toBe(401);
		});
	});

	describe('public feedback endpoint', () => {
		it('returns JSON ok for a valid edge (tom -> kai)', async () => {
			const res = await publicPOST(
				makeEvent({ supabase: tom, user: tomUser, body: { gathering_id: fx.gathering, reviewee_id: TEST_USERS.kai.id, tags: ['warm'] } })
			);
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ ok: true });
		});

		it('400 on malformed JSON body', async () => {
			const res = await publicPOST(makeEvent({ supabase: tom, user: tomUser, rawBody: 'oops' }));
			expect(res.status).toBe(400);
		});

		it('400 when too many tags', async () => {
			const res = await publicPOST(
				makeEvent({ supabase: tom, user: tomUser, body: { gathering_id: fx.gathering, reviewee_id: TEST_USERS.kai.id, tags: Array(11).fill('warm') } })
			);
			expect(res.status).toBe(400);
		});

		it('401 when unauthenticated', async () => {
			const status = await statusOfThrow(() =>
				publicPOST(makeEvent({ body: { gathering_id: fx.gathering, reviewee_id: TEST_USERS.kai.id } }))
			);
			expect(status).toBe(401);
		});
	});

	describe('promote endpoint', () => {
		async function feedbackId(): Promise<string> {
			const { data } = await admin
				.from('public_feedback')
				.select('id')
				.eq('gathering_id', fx.gathering)
				.eq('reviewer_id', TEST_USERS.tom.id)
				.eq('reviewee_id', TEST_USERS.kai.id)
				.single();
			return data!.id;
		}

		it('the subject promotes → 200', async () => {
			const id = await feedbackId();
			const res = await promotePOST(makeEvent({ params: { id }, supabase: kai, user: kaiUser }));
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ ok: true });
		});

		it('a non-subject → 403', async () => {
			const id = await feedbackId();
			// tom is the reviewer, not the subject — cannot promote.
			const res = await promotePOST(makeEvent({ params: { id }, supabase: tom, user: tomUser }));
			expect(res.status).toBe(403);
		});

		it('401 when unauthenticated', async () => {
			const id = await feedbackId();
			const status = await statusOfThrow(() => promotePOST(makeEvent({ params: { id } })));
			expect(status).toBe(401);
		});
	});

	describe('concern endpoint (kill-switch)', () => {
		// submit_concern now re-enforces the kill-switch in its own body (reads the
		// real app_settings row), so the endpoint mock alone is not enough — the DB
		// flag must actually be ON for the enabled-path cases to insert. Set it here
		// and restore the dark default afterwards.
		beforeAll(async () => {
			await admin
				.from('app_settings')
				.upsert({ key: 'safety_reporting_enabled', value: true }, { onConflict: 'key' })
				.throwOnError();
		});
		afterAll(async () => {
			await admin
				.from('app_settings')
				.upsert({ key: 'safety_reporting_enabled', value: false }, { onConflict: 'key' })
				.throwOnError();
		});

		it('returns JSON ok when reporting is enabled', async () => {
			killSwitch.mockResolvedValue(true);
			const res = await concernPOST(
				makeEvent({ supabase: sophie, user: sophieUser, body: { slot_id: fx.slot, scope: 'person', kind: 'no_show', subject_id: TEST_USERS.tom.id, gathering_id: fx.gathering } })
			);
			expect(res.status).toBe(200);
			expect(await res.json()).toEqual({ ok: true });
		});

		it('403 not_available when the kill-switch is off', async () => {
			killSwitch.mockResolvedValue(false);
			const res = await concernPOST(
				makeEvent({ supabase: sophie, user: sophieUser, body: { slot_id: fx.slot, scope: 'person', kind: 'no_show', subject_id: TEST_USERS.tom.id } })
			);
			expect(res.status).toBe(403);
			expect((await res.json()).error).toBe('not_available');
			killSwitch.mockResolvedValue(true);
		});

		it('400 on malformed JSON body', async () => {
			killSwitch.mockResolvedValue(true);
			const res = await concernPOST(makeEvent({ supabase: sophie, user: sophieUser, rawBody: '{bad' }));
			expect(res.status).toBe(400);
		});

		it('400 when scope=person without a subject', async () => {
			killSwitch.mockResolvedValue(true);
			const res = await concernPOST(
				makeEvent({ supabase: sophie, user: sophieUser, body: { slot_id: fx.slot, scope: 'person', kind: 'other' } })
			);
			expect(res.status).toBe(400);
		});

		it('401 when unauthenticated', async () => {
			const status = await statusOfThrow(() =>
				concernPOST(makeEvent({ body: { slot_id: fx.slot, scope: 'gathering', kind: 'other' } }))
			);
			expect(status).toBe(401);
		});
	});
});
