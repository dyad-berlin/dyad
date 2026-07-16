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

// ── U9: feedback-gate integration (dual-read) ────────────────────────────────
//
// After U4 dual-writes at slot advance, the feedback gate must enforce the NEW
// mandatory attendance-confirmation obligation (an unconfirmed
// participation.self_report on a GROUP gathering, plan R10) WITHOUT
// double-prompting alongside the legacy group_feedback gate for the same slot.
//
// Proven here:
//   * group slot: with the flag ON a participant is gated to the NEW obligation
//     (kind='gathering', formId=gathering id); the legacy group_feedback 'due'
//     row still exists (dual-write) but the gate SUPPRESSES it — no double-prompt.
//   * submitting attendance (submit_attendance sets self_report) clears the gate,
//     even though the legacy group_feedback row is still 'due' (suppression holds).
//   * flag OFF: the new gate is dormant and the legacy group_feedback gate fires
//     (kind='group') — a migration-free rollback path.
//   * 1-on-1 slot: unchanged — the feedback_forms gate (kind='one_on_one') governs
//     under BOTH flag states; the participation gate never fires (no group_feedback
//     for the slot), so a 1-on-1 member is never routed to the new-model form.

describe('Feedback gate dual-read (U9)', () => {
	let adminClient: SupabaseClient;

	// Group prompt author + joiners.
	let sophieServices: Services;
	let digitClient: SupabaseClient;
	let digitServices: Services;
	let tomServices: Services;
	// 1-on-1 prompt author + a joiner uninvolved in the group slot.
	let marcoServices: Services;
	let ninaServices: Services;

	const SOPHIE = TEST_USERS.sophie;
	const MARCO = SEED_USERS.other; // marco
	const DIGIT = SEED_USERS.digit; // lisa
	const TOM = TEST_USERS.tom;
	const NINA = TEST_USERS.nina;

	beforeAll(async () => {
		adminClient = createAdminClient();
		await cleanTestData(adminClient);

		sophieServices = createServices(
			await createAuthenticatedClient(SOPHIE.email, SOPHIE.password)
		);
		digitClient = await createAuthenticatedClient(DIGIT.email, DIGIT.password);
		digitServices = createServices(digitClient);
		tomServices = createServices(await createAuthenticatedClient(TOM.email, TOM.password));
		marcoServices = createServices(
			await createAuthenticatedClient(MARCO.email, MARCO.password)
		);
		ninaServices = createServices(await createAuthenticatedClient(NINA.email, NINA.password));
	});

	afterAll(() => cleanTestData(adminClient));

	async function publish(opts: {
		author: { id: string };
		authorServices: Services;
		capacity: number;
		title: string;
		placeIdSuffix: string;
	}): Promise<{ promptId: string; slotId: string }> {
		const prompt = await opts.authorServices.promptCommand.create(opts.author.id, {
			title: opts.title,
			coverImageUrl: 'https://picsum.photos/seed/gg/800/400'
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
						place_id: `gg-${opts.placeIdSuffix}`,
						name: 'Gate Venue',
						address: 'Gatestr 1, 10999 Berlin',
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
			.throwOnError();
		const { error } = await adminClient.rpc('advance_scheduled_meetings');
		expect(error).toBeNull();
	}

	async function gatheringIdForSlot(slotId: string): Promise<string> {
		const { data } = await adminClient.from('gatherings').select('id').eq('slot_id', slotId).single();
		return (data as { id: string }).id;
	}

	describe('group slot — new obligation gates, legacy suppressed', () => {
		let slotId: string;
		let gatheringId: string;

		it('sets up and advances a group slot (2 joiners → 3 participants)', async () => {
			const { promptId, slotId: sid } = await publish({
				author: SOPHIE,
				authorServices: sophieServices,
				capacity: 2,
				title: 'Gate group prompt',
				placeIdSuffix: 'grp'
			});
			slotId = sid;
			const invA = await invite(digitServices, DIGIT.id, SOPHIE.id, promptId, slotId);
			const invB = await invite(tomServices, TOM.id, SOPHIE.id, promptId, slotId);
			await sophieServices.invitation.accept(invA);
			await sophieServices.invitation.accept(invB);
			await advancePast(slotId);
			gatheringId = await gatheringIdForSlot(slotId);
			expect(gatheringId).toBeTruthy();
		});

		it('dual-write intact: legacy group_feedback "due" rows exist for the slot', async () => {
			const { data: gf } = await adminClient
				.from('group_feedback')
				.select('reviewer_id, state')
				.eq('slot_id', slotId);
			expect(gf ?? []).toHaveLength(3);
			for (const r of gf ?? []) expect(r.state).toBe('due');
		});

		it('flag OFF: new gate dormant, legacy group_feedback gate fires (kind=group)', async () => {
			const status = await digitServices.gate.checkGate(DIGIT.id, false);
			expect(status.gated).toBe(true);
			if (!status.gated) throw new Error('expected gated');
			expect(status.kind).toBe('group');
		});

		it('flag ON: gated to the NEW obligation (kind=gathering, formId=gathering id) — no double-prompt', async () => {
			const status = await digitServices.gate.checkGate(DIGIT.id, true);
			expect(status.gated).toBe(true);
			if (!status.gated) throw new Error('expected gated');
			// The NEW obligation fires, NOT the legacy group_feedback gate for the
			// same slot — the crux of no-double-prompt.
			expect(status.kind).toBe('gathering');
			expect(status.formId).toBe(gatheringId);
		});

		it('submitting attendance clears the gate (flag ON) even though group_feedback is still "due"', async () => {
			const { error } = await digitClient.rpc('submit_attendance', {
				p_gathering: gatheringId,
				p_self_report: 'attended'
			});
			expect(error).toBeNull();

			// Legacy group_feedback for digit is untouched by attendance — still 'due'.
			const { data: gf } = await adminClient
				.from('group_feedback')
				.select('state')
				.eq('slot_id', slotId)
				.eq('reviewer_id', DIGIT.id)
				.single();
			expect((gf as { state: string }).state).toBe('due');

			// Yet the gate is clear: the gathering obligation is confirmed and the
			// legacy row stays suppressed (slot has a gathering row).
			const after = await digitServices.gate.checkGate(DIGIT.id, true);
			expect(after.gated).toBe(false);
		});

		it('flag OFF after attendance: legacy group_feedback gate returns (rollback path)', async () => {
			// With the flag off, the still-'due' group_feedback row gates again —
			// proving the rollback restores exactly the legacy behaviour.
			const status = await digitServices.gate.checkGate(DIGIT.id, false);
			expect(status.gated).toBe(true);
			if (!status.gated) throw new Error('expected gated');
			expect(status.kind).toBe('group');
		});
	});

	describe('1-on-1 slot — legacy feedback_forms gate unchanged', () => {
		let slotId: string;

		it('sets up and advances a 1-on-1 slot', async () => {
			const { promptId, slotId: sid } = await publish({
				author: MARCO,
				authorServices: marcoServices,
				capacity: 1,
				title: 'Gate 1-on-1 prompt',
				placeIdSuffix: '1v1'
			});
			slotId = sid;
			const inv = await invite(ninaServices, NINA.id, MARCO.id, promptId, slotId);
			await marcoServices.invitation.accept(inv);
			await advancePast(slotId);
		});

		it('no group_feedback exists for the 1-on-1 slot (feedback_forms path)', async () => {
			const { data: gf } = await adminClient
				.from('group_feedback')
				.select('id')
				.eq('slot_id', slotId);
			expect(gf ?? []).toHaveLength(0);
		});

		it('flag ON: one_on_one gate governs, NOT the gathering gate', async () => {
			// nina has a gathering row + unconfirmed participation for this slot, but
			// the participation candidate requires a GROUP gathering (group_feedback
			// present) — the 1-on-1 has none, so it is excluded and one_on_one fires.
			const status = await ninaServices.gate.checkGate(NINA.id, true);
			expect(status.gated).toBe(true);
			if (!status.gated) throw new Error('expected gated');
			expect(status.kind).toBe('one_on_one');
		});

		it('flag OFF: still one_on_one (unchanged)', async () => {
			const status = await ninaServices.gate.checkGate(NINA.id, false);
			expect(status.gated).toBe(true);
			if (!status.gated) throw new Error('expected gated');
			expect(status.kind).toBe('one_on_one');
		});
	});
});
