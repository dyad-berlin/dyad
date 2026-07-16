import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	createAuthenticatedClient,
	createAdminClient,
	SEED_USERS,
	TEST_USERS
} from '../helpers/auth.js';
import { createServices, type Services } from '../helpers/db.js';
import { cleanTestData } from '../helpers/cleanup.js';

// ── U4: additive seeding of the unified gathering tables at slot advance ──────
//
// advance_scheduled_meetings() now, per advancing slot, ADDITIVELY upserts one
// `gatherings` row, one `participation` row per distinct participant, and one
// `gathering_feedback` row per distinct participant — ALONGSIDE the legacy
// group_feedback / feedback_forms minting, which must stay intact (KTD7). This
// proves dual-write and idempotence for both meeting shapes, and that a slot with
// no advancing meetings mints nothing.

describe('Gathering seeding on advance (U4)', () => {
	let adminClient: SupabaseClient;

	// Author of the group prompt (sophie is not feedback-gated in the seed).
	let sophieServices: Services;
	// Author of the 1-on-1 prompt.
	let marcoServices: Services;
	// Joiners.
	let digitServices: Services;
	let tomServices: Services;

	const SOPHIE = TEST_USERS.sophie;
	const MARCO = SEED_USERS.other; // marco
	const DIGIT = SEED_USERS.digit; // lisa
	const TOM = TEST_USERS.tom;

	beforeAll(async () => {
		adminClient = createAdminClient();
		await cleanTestData(adminClient);

		sophieServices = createServices(
			await createAuthenticatedClient(SOPHIE.email, SOPHIE.password)
		);
		marcoServices = createServices(
			await createAuthenticatedClient(MARCO.email, MARCO.password)
		);
		digitServices = createServices(
			await createAuthenticatedClient(DIGIT.email, DIGIT.password)
		);
		tomServices = createServices(
			await createAuthenticatedClient(TOM.email, TOM.password)
		);
	});

	afterAll(() => cleanTestData(adminClient));

	// Publish a prompt (by `author`) with one future slot at `capacity`.
	async function publish(opts: {
		author: { id: string };
		authorServices: Services;
		capacity: number;
		title: string;
		placeIdSuffix: string;
	}): Promise<{ promptId: string; slotId: string }> {
		const prompt = await opts.authorServices.promptCommand.create(opts.author.id, {
			title: opts.title,
			coverImageUrl: 'https://picsum.photos/seed/gs/800/400'
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
						place_id: `gs-${opts.placeIdSuffix}`,
						name: 'Gathering Venue',
						address: 'Gatherstr 1, 10999 Berlin',
						lat: 52.5,
						lng: 13.43
					}
				}
			],
			null,
			opts.capacity
		);
		const slots = await opts.authorServices.promptQuery.getAvailableSlots(
			prompt.id,
			opts.author.id
		);
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
		const inv = await inviterServices.invitation.create({
			promptId,
			slotId,
			inviterId,
			inviteeId
		});
		return inv.id;
	}

	// Force a slot's meetings into the past and advance the scheduler.
	async function advancePast(slotId: string): Promise<number> {
		const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
		await adminClient.from('time_slots').update({ start_time: past }).eq('id', slotId).throwOnError();
		await adminClient
			.from('meetings')
			.update({ scheduled_time: past })
			.eq('slot_id', slotId)
			.throwOnError();
		const { data: count, error } = await adminClient.rpc('advance_scheduled_meetings');
		expect(error).toBeNull();
		return count as number;
	}

	// Snapshot the new + legacy row shape for a slot.
	async function snapshot(slotId: string) {
		const { data: gatherings } = await adminClient
			.from('gatherings')
			.select('id, host_id, closed_at, prompt_id')
			.eq('slot_id', slotId);
		const gathering = (gatherings ?? [])[0] ?? null;
		let participation: { member_id: string; is_host: boolean; turned_up: boolean; self_report: string | null }[] = [];
		let gatheringFeedback: { reviewer_id: string; meet_again: boolean | null }[] = [];
		if (gathering) {
			participation = (
				await adminClient
					.from('participation')
					.select('member_id, is_host, turned_up, self_report')
					.eq('gathering_id', gathering.id)
			).data ?? [];
			gatheringFeedback = (
				await adminClient
					.from('gathering_feedback')
					.select('reviewer_id, meet_again')
					.eq('gathering_id', gathering.id)
			).data ?? [];
		}
		const groupFeedback = (
			await adminClient.from('group_feedback').select('reviewer_id, state').eq('slot_id', slotId)
		).data ?? [];
		return { gatherings: gatherings ?? [], gathering, participation, gatheringFeedback, groupFeedback };
	}

	describe('group slot (2 joiners → 3 distinct participants)', () => {
		let slotId: string;
		let meetingIds: string[] = [];

		it('sets up and advances a group slot', async () => {
			const { promptId, slotId: sid } = await publish({
				author: SOPHIE,
				authorServices: sophieServices,
				capacity: 2,
				title: 'Group seeding prompt',
				placeIdSuffix: 'grp'
			});
			slotId = sid;
			const invA = await invite(digitServices, DIGIT.id, SOPHIE.id, promptId, slotId);
			const invB = await invite(tomServices, TOM.id, SOPHIE.id, promptId, slotId);
			const m1 = await sophieServices.invitation.accept(invA);
			const m2 = await sophieServices.invitation.accept(invB);
			meetingIds = [m1, m2];
			const count = await advancePast(slotId);
			expect(count).toBeGreaterThanOrEqual(2);
		});

		it('mints 1 gathering + 3 participation + 3 gathering_feedback (new tables)', async () => {
			const s = await snapshot(slotId);
			expect(s.gatherings).toHaveLength(1);
			expect(s.gathering!.host_id).toBe(SOPHIE.id);
			expect(s.gathering!.closed_at).toBeTruthy();

			expect(s.participation).toHaveLength(3);
			expect(new Set(s.participation.map((p) => p.member_id))).toEqual(
				new Set([SOPHIE.id, DIGIT.id, TOM.id])
			);
			// Host flagged on the author only.
			const host = s.participation.filter((p) => p.is_host);
			expect(host).toHaveLength(1);
			expect(host[0].member_id).toBe(SOPHIE.id);
			// Turnout unconfirmed until self-report (U5).
			for (const p of s.participation) {
				expect(p.turned_up).toBe(false);
				expect(p.self_report).toBeNull();
			}

			expect(s.gatheringFeedback).toHaveLength(3);
			expect(new Set(s.gatheringFeedback.map((g) => g.reviewer_id))).toEqual(
				new Set([SOPHIE.id, DIGIT.id, TOM.id])
			);
			for (const g of s.gatheringFeedback) expect(g.meet_again).toBeNull();
		});

		it('legacy group_feedback rows STILL exist (dual-write)', async () => {
			const s = await snapshot(slotId);
			expect(s.groupFeedback).toHaveLength(3);
			for (const g of s.groupFeedback) expect(g.state).toBe('due');
			expect(new Set(s.groupFeedback.map((g) => g.reviewer_id))).toEqual(
				new Set([SOPHIE.id, DIGIT.id, TOM.id])
			);
		});

		it('re-running advance is a no-op on new AND legacy tables', async () => {
			const { error } = await adminClient.rpc('advance_scheduled_meetings');
			expect(error).toBeNull();
			const s = await snapshot(slotId);
			expect(s.gatherings).toHaveLength(1);
			expect(s.participation).toHaveLength(3);
			expect(s.gatheringFeedback).toHaveLength(3);
			expect(s.groupFeedback).toHaveLength(3);
		});
	});

	describe('1-on-1 slot (1 joiner → 2 distinct participants)', () => {
		let slotId: string;
		let meetingId: string;

		it('sets up and advances a 1-on-1 slot', async () => {
			const { promptId, slotId: sid } = await publish({
				author: MARCO,
				authorServices: marcoServices,
				capacity: 1,
				title: '1-on-1 seeding prompt',
				placeIdSuffix: '1v1'
			});
			slotId = sid;
			const inv = await invite(digitServices, DIGIT.id, MARCO.id, promptId, slotId);
			meetingId = await marcoServices.invitation.accept(inv);
			const count = await advancePast(slotId);
			expect(count).toBeGreaterThanOrEqual(1);
		});

		it('mints 1 gathering + 2 participation + 2 gathering_feedback (new tables)', async () => {
			const s = await snapshot(slotId);
			expect(s.gatherings).toHaveLength(1);
			expect(s.gathering!.host_id).toBe(MARCO.id);
			expect(s.participation).toHaveLength(2);
			expect(new Set(s.participation.map((p) => p.member_id))).toEqual(
				new Set([MARCO.id, DIGIT.id])
			);
			const host = s.participation.filter((p) => p.is_host);
			expect(host).toHaveLength(1);
			expect(host[0].member_id).toBe(MARCO.id);
			expect(s.gatheringFeedback).toHaveLength(2);
		});

		it('legacy feedback_forms (2 directional) STILL exist (dual-write)', async () => {
			const { data: forms } = await adminClient
				.from('feedback_forms')
				.select('id, reviewer_id, reviewee_id, state')
				.eq('meeting_id', meetingId);
			expect(forms ?? []).toHaveLength(2);
			for (const f of forms ?? []) expect(f.state).toBe('due');
			// The 1-on-1 meeting stays awaiting_feedback (legacy reveal machine).
			const { data: meeting } = await adminClient
				.from('meetings')
				.select('state')
				.eq('id', meetingId)
				.single();
			expect(meeting!.state).toBe('awaiting_feedback');
		});

		it('re-running advance is a no-op on new AND legacy tables', async () => {
			const { error } = await adminClient.rpc('advance_scheduled_meetings');
			expect(error).toBeNull();
			const s = await snapshot(slotId);
			expect(s.gatherings).toHaveLength(1);
			expect(s.participation).toHaveLength(2);
			expect(s.gatheringFeedback).toHaveLength(2);
			const { data: forms } = await adminClient
				.from('feedback_forms')
				.select('id')
				.eq('meeting_id', meetingId);
			expect(forms ?? []).toHaveLength(2);
		});
	});

	describe('slot with no advancing meetings mints nothing new', () => {
		it('a published slot with no accepted meeting produces no gathering', async () => {
			const { slotId } = await publish({
				author: MARCO,
				authorServices: marcoServices,
				capacity: 1,
				title: 'Idle seeding prompt',
				placeIdSuffix: 'idle'
			});
			// Push the (empty) slot into the past and advance — no meetings exist.
			const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
			await adminClient.from('time_slots').update({ start_time: past }).eq('id', slotId).throwOnError();
			const { error } = await adminClient.rpc('advance_scheduled_meetings');
			expect(error).toBeNull();

			const s = await snapshot(slotId);
			expect(s.gatherings).toHaveLength(0);
			expect(s.participation).toHaveLength(0);
			expect(s.gatheringFeedback).toHaveLength(0);
			expect(s.groupFeedback).toHaveLength(0);
		});
	});
});
