import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAuthenticatedClient, createAdminClient, TEST_USERS, SEED_USERS } from '../helpers/auth.js';
import { createServices, type Services } from '../helpers/db.js';
import { cleanTestData } from '../helpers/cleanup.js';

// Confidentiality contract for safety_concerns (plan U1):
//  * A participant of a gathering can file a concern about a co-participant.
//  * A non-participant cannot file (reporter OR reported must share the slot).
//  * No self-reports.
//  * Users can never READ concerns (no SELECT policy) — including the reported
//    person. Only the service-role admin plane reads them.
//
// Seed: author (lisa) publishes a prompt+slot; marco invites (invitee = author)
// and accepts → one meeting on the slot with participants {lisa, marco}.

describe('safety_concerns RLS', () => {
	let admin: SupabaseClient;
	let lisaClient: SupabaseClient; // author + a participant
	let marcoClient: SupabaseClient; // inviter + the other participant
	let sophieClient: SupabaseClient; // NOT on the slot
	let slotId: string;

	const LISA = SEED_USERS.digit; // author / participant_a
	const MARCO = SEED_USERS.other; // inviter / participant_b
	const SOPHIE = TEST_USERS.sophie; // outsider

	beforeAll(async () => {
		admin = createAdminClient();
		await cleanTestData(admin);

		lisaClient = await createAuthenticatedClient(LISA.email, LISA.password);
		marcoClient = await createAuthenticatedClient(MARCO.email, MARCO.password);
		sophieClient = await createAuthenticatedClient(SOPHIE.email, SOPHIE.password);

		const lisaServices: Services = createServices(lisaClient);
		const marcoServices: Services = createServices(marcoClient);

		const prompt = await lisaServices.promptCommand.create(LISA.id, {
			title: 'Safety RLS seed',
			coverImageUrl: 'https://picsum.photos/seed/safety/800/400'
		});
		const threeDays = new Date();
		threeDays.setDate(threeDays.getDate() + 3);
		await lisaServices.promptCommand.publish(
			prompt.id,
			LISA.id,
			[
				{
					start_time: threeDays.toISOString(),
					duration_minutes: 60,
					location: { place_id: 'safety-rls', name: 'Venue', address: 'Str 1, 10999 Berlin', lat: 52.5, lng: 13.43 }
				}
			],
			null,
			1
		);
		const slots = await lisaServices.promptQuery.getAvailableSlots(prompt.id, LISA.id);
		slotId = slots[0].id;

		const inv = await marcoServices.invitation.create({
			promptId: prompt.id,
			slotId,
			inviterId: MARCO.id,
			inviteeId: LISA.id
		});
		// Materialise the meeting directly (admin) rather than via accept_invitation,
		// whose membership gate depends on local app_settings state. The RLS under
		// test only needs a meeting on the slot with participants {lisa, marco}.
		await admin
			.from('meetings')
			.insert({
				invitation_id: inv.id,
				prompt_id: prompt.id,
				participant_a: LISA.id,
				participant_b: MARCO.id,
				slot_id: slotId,
				scheduled_time: threeDays.toISOString(),
				duration_minutes: 60,
				state: 'completed'
			})
			.throwOnError();
	});

	afterAll(async () => {
		await admin.from('safety_concerns').delete().eq('slot_id', slotId);
		await cleanTestData(admin);
	});

	it('a co-participant can file a concern about the other participant', async () => {
		const { error } = await marcoClient
			.from('safety_concerns')
			.insert({ slot_id: slotId, reporter_id: MARCO.id, reported_id: LISA.id, kind: 'no_show' });
		expect(error).toBeNull();
	});

	it('either direction works — the author can also file about the inviter', async () => {
		const { error } = await lisaClient
			.from('safety_concerns')
			.insert({ slot_id: slotId, reporter_id: LISA.id, reported_id: MARCO.id, kind: 'felt_unsafe' });
		expect(error).toBeNull();
	});

	it('a non-participant cannot file about a participant', async () => {
		const { error } = await sophieClient
			.from('safety_concerns')
			.insert({ slot_id: slotId, reporter_id: SOPHIE.id, reported_id: LISA.id, kind: 'other' });
		expect(error).not.toBeNull(); // RLS WITH CHECK rejects
	});

	it('a participant cannot file about someone who was not in the gathering', async () => {
		const { error } = await marcoClient
			.from('safety_concerns')
			.insert({ slot_id: slotId, reporter_id: MARCO.id, reported_id: SOPHIE.id, kind: 'other' });
		expect(error).not.toBeNull();
	});

	it('rejects a self-report', async () => {
		const { error } = await marcoClient
			.from('safety_concerns')
			.insert({ slot_id: slotId, reporter_id: MARCO.id, reported_id: MARCO.id, kind: 'other' });
		expect(error).not.toBeNull();
	});

	it('rejects filing as someone else (reporter must be the caller)', async () => {
		const { error } = await marcoClient
			.from('safety_concerns')
			.insert({ slot_id: slotId, reporter_id: LISA.id, reported_id: SOPHIE.id, kind: 'other' });
		expect(error).not.toBeNull();
	});

	it('the reported person cannot read concerns about them', async () => {
		// lisa was reported by marco in the first test; she must see nothing.
		const { data } = await lisaClient.from('safety_concerns').select('*').eq('reported_id', LISA.id);
		expect(data ?? []).toHaveLength(0);
	});

	it('no user (even a participant) can read any concern', async () => {
		const { data } = await marcoClient.from('safety_concerns').select('*');
		expect(data ?? []).toHaveLength(0);
	});

	it('the service-role admin plane can read concerns', async () => {
		const { data, error } = await admin.from('safety_concerns').select('*').eq('slot_id', slotId);
		expect(error).toBeNull();
		expect((data ?? []).length).toBeGreaterThanOrEqual(1);
	});
});
