import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import {
	createAuthenticatedClient,
	createAdminClient,
	TEST_USERS,
	SEED_USERS
} from '../helpers/auth.js';
import { createServices, type Services } from '../helpers/db.js';
import { cleanTestData } from '../helpers/cleanup.js';
import { POST as acceptPOST } from '../../src/routes/api/invitations/[id]/accept/+server.js';

// ── Security contracts for the capacity / gathering surface (#59) ──────────────
//
// The lifecycle suite proves the happy paths; this file pins the SECURITY
// boundaries the #51 review flagged as unpinned:
//   * get_prompt_slot_occupancy: denied to anon; hidden prompts leak nothing to
//     non-authors (author bypass intact).
//   * submit_group_feedback: a non-owner cannot submit someone else's form.
//   * the group feedback gate fires for EVERY participant (author + all joiners),
//     under both flag states — not just the one joiner asserted elsewhere.
//   * the invite-time capacity guard returns a clean 409 at the HTTP layer.
//   * joiner-visibility asymmetry: a joiner's meeting exposes no co-attendee
//     identities (pairwise RLS — a joiner never sees the other joiners).

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY ?? '';

function makeAcceptEvent(invitationId: string, supabase: SupabaseClient, user: User) {
	return {
		params: { id: invitationId },
		locals: { supabase, user },
		platform: undefined,
		request: new Request(`http://localhost/api/invitations/${invitationId}/accept`, { method: 'POST' })
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

describe('Capacity / gathering security contracts (#59)', () => {
	let adminClient: SupabaseClient;

	let marcoClient: SupabaseClient;
	let marcoServices: Services;
	let sophieServices: Services;
	let digitClient: SupabaseClient;
	let digitServices: Services;
	let tomServices: Services;

	let marcoUser: User;

	const MARCO = SEED_USERS.other; // marco
	const DIGIT = SEED_USERS.digit; // lisa
	const SOPHIE = TEST_USERS.sophie;
	const TOM = TEST_USERS.tom;

	beforeAll(async () => {
		adminClient = createAdminClient();
		await cleanTestData(adminClient);

		marcoClient = await createAuthenticatedClient(MARCO.email, MARCO.password);
		marcoServices = createServices(marcoClient);
		sophieServices = createServices(await createAuthenticatedClient(SOPHIE.email, SOPHIE.password));
		digitClient = await createAuthenticatedClient(DIGIT.email, DIGIT.password);
		digitServices = createServices(digitClient);
		tomServices = createServices(await createAuthenticatedClient(TOM.email, TOM.password));

		marcoUser = (await marcoClient.auth.getUser()).data.user!;
	});

	afterAll(() => cleanTestData(adminClient));

	async function publishWithCapacity(opts: {
		author: { id: string };
		authorServices: Services;
		capacity: number;
		title: string;
		placeIdSuffix: string;
	}): Promise<{ promptId: string; slotId: string }> {
		const prompt = await opts.authorServices.promptCommand.create(opts.author.id, {
			title: opts.title,
			coverImageUrl: 'https://picsum.photos/seed/sec/800/400'
		});
		const threeDays = new Date();
		threeDays.setDate(threeDays.getDate() + 3);
		await opts.authorServices.promptCommand.publish(
			prompt.id,
			opts.author.id,
			[
				{
					start_time: threeDays.toISOString(),
					duration_minutes: 60,
					location: {
						place_id: `sec-${opts.placeIdSuffix}`,
						name: 'Sec Venue',
						address: 'Secstr 1, 10999 Berlin',
						lat: 52.5,
						lng: 13.43
					}
				}
			],
			null,
			opts.capacity
		);
		const slots = await opts.authorServices.promptQuery.getAvailableSlots(prompt.id, opts.author.id);
		expect(slots.length).toBe(1);
		return { promptId: prompt.id, slotId: slots[0].id };
	}

	async function invite(
		inviterServices: Services,
		inviterId: string,
		inviteeId: string,
		promptId: string,
		slotId: string
	): Promise<string> {
		const inv = await inviterServices.invitation.create({ promptId, slotId, inviterId, inviteeId });
		return inv.id;
	}

	async function advancePast(slotId: string): Promise<void> {
		const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
		await adminClient.from('time_slots').update({ start_time: past }).eq('id', slotId).throwOnError();
		await adminClient
			.from('meetings')
			.update({ scheduled_time: past })
			.eq('slot_id', slotId)
			.in('state', ['scheduled', 'awaiting_feedback'])
			.throwOnError();
		const { error } = await adminClient.rpc('advance_scheduled_meetings');
		expect(error).toBeNull();
	}

	describe('get_prompt_slot_occupancy access control', () => {
		it('an anonymous caller gets no rows (auth floor)', async () => {
			const { promptId } = await publishWithCapacity({
				author: MARCO,
				authorServices: marcoServices,
				capacity: 2,
				title: 'Occ anon prompt',
				placeIdSuffix: 'occ-anon'
			});
			const anon = createClient(SUPABASE_URL, ANON_KEY, {
				auth: { persistSession: false, autoRefreshToken: false }
			});
			const { data } = await anon.rpc('get_prompt_slot_occupancy', { p_prompt_id: promptId });
			// Empty set (the RPC returns early for a NULL caller) — never an occupancy leak.
			expect(data ?? []).toHaveLength(0);
		});

		it('a hidden prompt yields an empty set for a non-author but not for the author', async () => {
			const { promptId, slotId } = await publishWithCapacity({
				author: MARCO,
				authorServices: marcoServices,
				capacity: 2,
				title: 'Occ hidden prompt',
				placeIdSuffix: 'occ-hidden'
			});
			// Hide it from public discovery.
			await adminClient.from('prompts').update({ hidden_at: new Date().toISOString() }).eq('id', promptId).throwOnError();

			// Non-author (digit): hidden prompts are invisible → empty set, no leak.
			const { data: asDigit } = await digitClient.rpc('get_prompt_slot_occupancy', { p_prompt_id: promptId });
			expect(asDigit ?? []).toHaveLength(0);

			// Author (marco) still reads their own prompt's occupancy (author bypass).
			const { data: asAuthor } = await marcoClient.rpc('get_prompt_slot_occupancy', { p_prompt_id: promptId });
			expect((asAuthor ?? []).some((r: { slot_id: string }) => r.slot_id === slotId)).toBe(true);
		});
	});

	describe('invite-time capacity guard at the HTTP layer', () => {
		it('the accept endpoint returns 409 JSON when the slot is full', async () => {
			const { promptId, slotId } = await publishWithCapacity({
				author: MARCO,
				authorServices: marcoServices,
				capacity: 1,
				title: 'HTTP cap prompt',
				placeIdSuffix: 'http-cap'
			});
			const invA = await invite(digitServices, DIGIT.id, MARCO.id, promptId, slotId);
			const invB = await invite(sophieServices, SOPHIE.id, MARCO.id, promptId, slotId);
			await marcoServices.invitation.accept(invA); // fills the single seat

			// Drive the real POST handler — the author accepting the second invite on
			// a full slot must get a clean 409 JSON, not a 500 or an HTML error page.
			const res = await acceptPOST(makeAcceptEvent(invB, marcoClient, marcoUser));
			expect(res.status).toBe(409);
			const body = await res.json();
			expect(body.error).toBeTruthy();
			// Generic, safe copy — no table/constraint names.
			expect(typeof body.error).toBe('string');
		});
	});

	describe('group gathering: gate + wrong-owner + joiner visibility', () => {
		let promptId: string;
		let slotId: string;
		let gatheringId: string;
		let digitMeetingId: string;
		let tomMeetingId: string;

		beforeAll(async () => {
			({ promptId, slotId } = await publishWithCapacity({
				author: SOPHIE,
				authorServices: sophieServices,
				capacity: 2,
				title: 'Sec group prompt',
				placeIdSuffix: 'grp'
			}));
			const invA = await invite(digitServices, DIGIT.id, SOPHIE.id, promptId, slotId);
			const invB = await invite(tomServices, TOM.id, SOPHIE.id, promptId, slotId);
			digitMeetingId = await sophieServices.invitation.accept(invA);
			tomMeetingId = await sophieServices.invitation.accept(invB);
			await advancePast(slotId);
			const { data } = await adminClient.from('gatherings').select('id').eq('slot_id', slotId).single();
			gatheringId = (data as { id: string }).id;
		});

		it('the group feedback gate fires for EVERY participant (author + both joiners)', async () => {
			// Flag OFF → legacy group_feedback gate (kind=group) for all three.
			for (const [who, svc] of [
				[SOPHIE.id, sophieServices],
				[DIGIT.id, digitServices],
				[TOM.id, tomServices]
			] as const) {
				const off = await svc.gate.checkGate(who, false);
				expect(off.gated, `${who} should be gated (flag off)`).toBe(true);
				if (!off.gated) throw new Error('expected gated');
				expect(off.kind).toBe('group');

				// Flag ON → the unified obligation (kind=gathering, formId=gathering id).
				const on = await svc.gate.checkGate(who, true);
				expect(on.gated, `${who} should be gated (flag on)`).toBe(true);
				if (!on.gated) throw new Error('expected gated');
				expect(on.kind).toBe('gathering');
				expect(on.formId).toBe(gatheringId);
			}
		});

		it('submit_group_feedback rejects a non-owner submitting someone else’s form', async () => {
			// Find digit's own group_feedback form, then have tom try to submit it.
			const { data: digitForm } = await adminClient
				.from('group_feedback')
				.select('id')
				.eq('slot_id', slotId)
				.eq('reviewer_id', DIGIT.id)
				.single();
			const formId = (digitForm as { id: string }).id;

			await expect(
				tomServices.feedback.submitGroupFeedback(formId, { meet_again: true })
			).rejects.toThrow();

			// Untouched: still 'due', owned by digit.
			const { data: after } = await adminClient
				.from('group_feedback')
				.select('state, reviewer_id')
				.eq('id', formId)
				.single();
			expect((after as { state: string }).state).toBe('due');
			expect((after as { reviewer_id: string }).reviewer_id).toBe(DIGIT.id);
		});

		it('a joiner’s meeting exposes no co-attendee identities (pairwise RLS)', async () => {
			// digit's RLS-scoped read of the slot's meetings returns ONLY digit's own
			// pair (sophie <-> digit). tom (the other joiner) never appears — the
			// gathering does not turn joiners into each other's co-attendees.
			const { data: visible } = await digitClient
				.from('meetings')
				.select('id, participant_a, participant_b')
				.eq('slot_id', slotId);
			expect(visible ?? []).toHaveLength(1);
			const row = (visible ?? [])[0];
			expect(row.id).toBe(digitMeetingId);
			const participants = new Set([row.participant_a, row.participant_b]);
			expect(participants).toEqual(new Set([SOPHIE.id, DIGIT.id]));
			expect(participants.has(TOM.id)).toBe(false);

			// And digit cannot read tom's meeting by id.
			const { data: tomRow } = await digitClient
				.from('meetings')
				.select('id')
				.eq('id', tomMeetingId)
				.maybeSingle();
			expect(tomRow).toBeNull();
		});
	});
});
