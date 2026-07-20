import { describe, it, expect, beforeAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	createAuthenticatedClient,
	createAdminClient,
	TEST_USERS,
	SEED_USERS
} from '../helpers/auth.js';
import { createServices, type Services } from '../helpers/db.js';
import { cleanTestData } from '../helpers/cleanup.js';

// editSlot no-op correctness (UX flow audit P1).
//
// The save-on-close flow (PublishSheet) routes EVERY persisted slot through
// editSlot with its current values. Two bugs followed from a presence-based
// no-op guard that ran AFTER the accepted/retired throws:
//   1. Re-saving a slot whose value didn't change still expired its pending
//      invitations (the responder's invite silently vanished on any save).
//   2. If any slot was already booked, re-saving it threw "Cannot edit a slot
//      that has already been booked" — wedging the author out of editing the
//      OTHER times entirely.
// The fix diffs incoming updates against stored values and returns early on a
// true no-op, before the guards. A genuine change still expires + still rejects
// a booked/retired slot.

const LOC = {
	place_id: 'noop-venue',
	name: 'No-op Venue',
	address: 'Teststr 1, 10999 Berlin',
	lat: 52.5,
	lng: 13.43
};

describe('editSlot no-op correctness', () => {
	let admin: SupabaseClient;
	const MARCO = SEED_USERS.other;
	const DIGIT = SEED_USERS.digit;
	let marco: Services;
	let digit: Services;

	// Values the slot is published with — re-passed verbatim to prove a no-op.
	let startTime: string;
	const DURATION = 60;

	beforeAll(async () => {
		admin = createAdminClient();
		await cleanTestData(admin);
		marco = createServices(await createAuthenticatedClient(MARCO.email, MARCO.password));
		digit = createServices(await createAuthenticatedClient(DIGIT.email, DIGIT.password));
		const d = new Date();
		d.setDate(d.getDate() + 3);
		startTime = d.toISOString();
	});

	async function publishOneSlot(title: string, placeId: string): Promise<{ promptId: string; slotId: string }> {
		const prompt = await marco.promptCommand.create(MARCO.id, {
			title,
			coverImageUrl: 'https://picsum.photos/seed/noop/800/400'
		});
		await marco.promptCommand.publish(
			prompt.id,
			MARCO.id,
			[{ start_time: startTime, duration_minutes: DURATION, location: { ...LOC, place_id: placeId } }],
			null,
			1
		);
		const slots = await marco.promptQuery.getAvailableSlots(prompt.id, MARCO.id);
		return { promptId: prompt.id, slotId: slots[0].id };
	}

	async function pendingCount(slotId: string): Promise<number> {
		const { count } = await admin
			.from('prompt_invitations')
			.select('*', { count: 'exact', head: true })
			.eq('slot_id', slotId)
			.eq('state', 'pending');
		return count ?? 0;
	}

	// A true no-op save mirrors the editor: it sends start_time + duration only,
	// and omits `location` (exact_location is masked from the author's client, so
	// the editor only sends a location on an intentional re-pick).
	function unchanged() {
		return { start_time: startTime, duration_minutes: DURATION };
	}

	it('re-saving an unchanged slot does NOT expire its pending invitation', async () => {
		const { promptId, slotId } = await publishOneSlot('No-op keeps invite', 'noop-a');
		await digit.invitation.create({ promptId, slotId, inviterId: DIGIT.id, inviteeId: MARCO.id });
		expect(await pendingCount(slotId)).toBe(1);

		// The save-on-close no-op: same values, no change.
		await marco.promptCommand.editSlot(slotId, MARCO.id, unchanged());
		expect(await pendingCount(slotId), 'no-op save must not expire the invite').toBe(1);
	});

	it('a genuine change DOES expire pending invitations', async () => {
		const { promptId, slotId } = await publishOneSlot('Change expires invite', 'noop-b');
		await digit.invitation.create({ promptId, slotId, inviterId: DIGIT.id, inviteeId: MARCO.id });
		expect(await pendingCount(slotId)).toBe(1);

		await marco.promptCommand.editSlot(slotId, MARCO.id, {
			start_time: startTime,
			duration_minutes: 90, // real change
			location: { ...LOC, place_id: 'noop-b' }
		});
		expect(await pendingCount(slotId), 'a real change expires pending invites').toBe(0);
	});

	it('re-saving an unchanged BOOKED slot does not throw (no wedge)', async () => {
		const { promptId, slotId } = await publishOneSlot('Booked no-op', 'noop-c');
		const invId = await digit.invitation
			.create({ promptId, slotId, inviterId: DIGIT.id, inviteeId: MARCO.id })
			.then((i) => i.id);
		await marco.invitation.accept(invId); // slot now booked

		// Re-persisting the unchanged booked slot must be a silent no-op, not the
		// "Cannot edit a slot that has already been booked" throw that wedged the batch.
		await expect(marco.promptCommand.editSlot(slotId, MARCO.id, unchanged())).resolves.toBeUndefined();
	});

	it('a genuine change to a booked slot is still rejected (400)', async () => {
		const { promptId, slotId } = await publishOneSlot('Booked change rejected', 'noop-d');
		const invId = await digit.invitation
			.create({ promptId, slotId, inviterId: DIGIT.id, inviteeId: MARCO.id })
			.then((i) => i.id);
		await marco.invitation.accept(invId);

		await expect(
			marco.promptCommand.editSlot(slotId, MARCO.id, {
				start_time: startTime,
				duration_minutes: 120, // real change on a booked slot
				location: { ...LOC, place_id: 'noop-d' }
			})
		).rejects.toMatchObject({ status: 400 });
	});
});
