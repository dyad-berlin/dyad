import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, createAuthenticatedClient, TEST_USERS } from '../helpers/auth.js';

/**
 * safety_concerns RLS + structural confidentiality (feat: unified gathering
 * feedback, U2 — the safeguarding core).
 *
 * The invariant under test is HARD and STRUCTURAL: a concern is visible ONLY to
 * stewards (service-role, which bypasses RLS), NEVER to the reported person or
 * any participant — enforced by the ABSENCE of any authenticated SELECT
 * grant/policy, not by a WHERE clause.
 *
 * The report gate is SCHEDULED CO-MEMBERSHIP (app.is_slot_participant), which is
 * turnout-BLIND: it reads the `meetings` on a slot, not participation.turned_up,
 * so a no-show is reportable though the subject was absent.
 *
 * Fixtures — two independent slots so cross-slot steward reads keyed on subject
 * can be asserted, and a non-participant (ava) can be checked against the gate:
 *   Slot1 (lisa's prompt): meeting lisa(host, participant_a) <-> marco (1-on-1).
 *   Slot2 (ava's prompt):  meeting ava(host)  <-> marco (marco is the shared
 *                          subject across both slots).
 * Slot1 also seeds a gathering where marco did NOT turn up (no_show gate proof).
 */
describe('safety_concerns RLS + structural confidentiality (U2)', () => {
	const admin = createAdminClient();
	let lisa: SupabaseClient;
	let marco: SupabaseClient;
	let ava: SupabaseClient;

	const stamp = Date.now();
	const prompt1 = `sc-rls-p1-${stamp}`;
	const prompt2 = `sc-rls-p2-${stamp}`;
	let slot1: string;
	let slot2: string;
	let gathering1: string;

	const stubLocation = {
		place_id: 'test-place',
		name: 'Test venue',
		address: 'Test address',
		lat: 52.5,
		lng: 13.4
	};

	async function cleanup() {
		// FK teardown order: concerns/gatherings cascade from slots, but meetings
		// are ON DELETE RESTRICT on prompt_id and reference invitations. Delete
		// leaves first, then work back to prompts.
		await admin.from('safety_concerns').delete().in('slot_id', [slot1, slot2].filter(Boolean));
		await admin.from('gatherings').delete().in('prompt_id', [prompt1, prompt2]);
		await admin.from('meetings').delete().in('prompt_id', [prompt1, prompt2]);
		await admin.from('prompt_invitations').delete().in('prompt_id', [prompt1, prompt2]);
		await admin.from('time_slots').delete().in('prompt_id', [prompt1, prompt2]);
		await admin.from('prompts').delete().in('id', [prompt1, prompt2]);
	}

	beforeAll(async () => {
		[lisa, marco, ava] = await Promise.all([
			createAuthenticatedClient(TEST_USERS.lisa.email, TEST_USERS.lisa.password),
			createAuthenticatedClient(TEST_USERS.marco.email, TEST_USERS.marco.password),
			createAuthenticatedClient(TEST_USERS.ava.email, TEST_USERS.ava.password)
		]);

		const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

		await admin
			.from('prompts')
			.insert([
				{ id: prompt1, author_id: TEST_USERS.lisa.id, title: 'P1', state: 'published', region: 'berlin', published_at: new Date().toISOString() },
				{ id: prompt2, author_id: TEST_USERS.ava.id, title: 'P2', state: 'published', region: 'berlin', published_at: new Date().toISOString() }
			])
			.throwOnError();

		const { data: slots } = await admin
			.from('time_slots')
			.insert([
				{ prompt_id: prompt1, start_time: future, duration_minutes: 60, exact_location: stubLocation, general_area: 'Mitte' },
				{ prompt_id: prompt2, start_time: future, duration_minutes: 60, exact_location: stubLocation, general_area: 'Neukölln' }
			])
			.select('id, prompt_id')
			.throwOnError();
		slot1 = slots!.find((s) => s.prompt_id === prompt1)!.id;
		slot2 = slots!.find((s) => s.prompt_id === prompt2)!.id;

		// Invitations back the meetings (meetings.invitation_id is NOT NULL UNIQUE).
		const { data: invites } = await admin
			.from('prompt_invitations')
			.insert([
				{ prompt_id: prompt1, slot_id: slot1, inviter_id: TEST_USERS.marco.id, invitee_id: TEST_USERS.lisa.id, state: 'accepted' },
				{ prompt_id: prompt2, slot_id: slot2, inviter_id: TEST_USERS.marco.id, invitee_id: TEST_USERS.ava.id, state: 'accepted' }
			])
			.select('id, slot_id')
			.throwOnError();
		const invite1 = invites!.find((i) => i.slot_id === slot1)!.id;
		const invite2 = invites!.find((i) => i.slot_id === slot2)!.id;

		// Scheduled meetings — the co-membership gate keys off these, turnout-blind.
		// Slot1: lisa (author/host, participant_a) <-> marco.
		// Slot2: ava (author/host) <-> marco (marco is the shared subject).
		await admin
			.from('meetings')
			.insert([
				{ invitation_id: invite1, slot_id: slot1, participant_a: TEST_USERS.lisa.id, participant_b: TEST_USERS.marco.id, prompt_id: prompt1, scheduled_time: future, duration_minutes: 60 },
				{ invitation_id: invite2, slot_id: slot2, participant_a: TEST_USERS.ava.id, participant_b: TEST_USERS.marco.id, prompt_id: prompt2, scheduled_time: future, duration_minutes: 60 }
			])
			.throwOnError();

		// A gathering on slot1 where marco did NOT turn up — proves the no_show
		// concern gate is scheduled membership, not turnout.
		const { data: gatherings } = await admin
			.from('gatherings')
			.insert([{ slot_id: slot1, prompt_id: prompt1, host_id: TEST_USERS.lisa.id }])
			.select('id')
			.throwOnError();
		gathering1 = gatherings![0].id;

		await admin
			.from('participation')
			.insert([
				{ gathering_id: gathering1, member_id: TEST_USERS.lisa.id, is_host: true, turned_up: true, self_report: 'attended' },
				{ gathering_id: gathering1, member_id: TEST_USERS.marco.id, is_host: false, turned_up: false, self_report: 'absent' }
			])
			.throwOnError();
	});

	afterAll(cleanup);

	describe('INSERT gate (scheduled co-membership, turnout-blind)', () => {
		it('a co-participant files a no_show concern about a co-participant who did NOT turn up', async () => {
			// lisa reports marco (marco was scheduled on slot1 but did not turn up).
			// Gate is scheduled membership (meetings), not turnout — so this inserts.
			const { error } = await lisa.from('safety_concerns').insert({
				slot_id: slot1,
				gathering_id: gathering1,
				reporter_id: TEST_USERS.lisa.id,
				subject_id: TEST_USERS.marco.id,
				scope: 'person',
				kind: 'no_show',
				detail: 'Did not show up.'
			});
			expect(error, error?.message).toBeNull();
		});

		it('a gathering-scoped concern (subject_id NULL, scope=gathering) inserts', async () => {
			const { error } = await marco.from('safety_concerns').insert({
				slot_id: slot1,
				gathering_id: gathering1,
				reporter_id: TEST_USERS.marco.id,
				subject_id: null,
				scope: 'gathering',
				kind: 'other',
				detail: 'Something felt off about the meeting overall.'
			});
			expect(error, error?.message).toBeNull();
		});

		it('a felt_unsafe concern about the shared subject on the OTHER slot inserts', async () => {
			// ava reports marco on slot2 (both scheduled there). Second slot, same
			// subject — sets up the cross-slot steward-read assertion below.
			const { error } = await ava.from('safety_concerns').insert({
				slot_id: slot2,
				reporter_id: TEST_USERS.ava.id,
				subject_id: TEST_USERS.marco.id,
				scope: 'person',
				kind: 'felt_unsafe',
				detail: 'Felt uncomfortable.'
			});
			expect(error, error?.message).toBeNull();
		});

		it('rejects a self-report (reporter_id = subject_id)', async () => {
			const { error } = await lisa.from('safety_concerns').insert({
				slot_id: slot1,
				reporter_id: TEST_USERS.lisa.id,
				subject_id: TEST_USERS.lisa.id,
				scope: 'person',
				kind: 'other'
			});
			expect(error, 'self-report must be rejected').not.toBeNull();
		});

		it('rejects a non-participant reporter (is_slot_participant false)', async () => {
			// ava is NOT scheduled on slot1 — the WITH CHECK gate blocks her.
			const { error } = await ava.from('safety_concerns').insert({
				slot_id: slot1,
				reporter_id: TEST_USERS.ava.id,
				subject_id: TEST_USERS.marco.id,
				scope: 'person',
				kind: 'other'
			});
			expect(error, 'non-participant reporter must be blocked by the gate').not.toBeNull();
		});

		it('rejects a concern whose subject was not scheduled on the slot (target constraint)', async () => {
			// lisa is a slot1 participant, but ava is NOT — a participant cannot name
			// an outsider as the subject. WITH CHECK constrains the target, not just
			// the actor.
			const { error } = await lisa.from('safety_concerns').insert({
				slot_id: slot1,
				reporter_id: TEST_USERS.lisa.id,
				subject_id: TEST_USERS.ava.id,
				scope: 'person',
				kind: 'other'
			});
			expect(error, 'subject must also be a slot participant').not.toBeNull();
		});

		it('cannot spoof the reporter_id to another user (reporter_id = current user)', async () => {
			// marco tries to file a concern AS lisa. reporter_id must equal the caller.
			const { error } = await marco.from('safety_concerns').insert({
				slot_id: slot1,
				reporter_id: TEST_USERS.lisa.id,
				subject_id: TEST_USERS.marco.id,
				scope: 'person',
				kind: 'other'
			});
			expect(error, 'reporter_id spoofing must be blocked').not.toBeNull();
		});
	});

	describe('CHECK constraints', () => {
		it('rejects scope=person with a NULL subject_id', async () => {
			const { error } = await admin.from('safety_concerns').insert({
				slot_id: slot1,
				reporter_id: TEST_USERS.lisa.id,
				subject_id: null,
				scope: 'person',
				kind: 'other'
			});
			expect(error, 'scope=person requires a subject').not.toBeNull();
			expect(error?.code).toBe('23514'); // check_violation
		});

		it('rejects scope=gathering with a non-NULL subject_id', async () => {
			const { error } = await admin.from('safety_concerns').insert({
				slot_id: slot1,
				reporter_id: TEST_USERS.lisa.id,
				subject_id: TEST_USERS.marco.id,
				scope: 'gathering',
				kind: 'other'
			});
			expect(error, 'scope=gathering forbids a subject').not.toBeNull();
			expect(error?.code).toBe('23514');
		});
	});

	describe('structural confidentiality — NO authenticated read', () => {
		it('the reporter cannot read back the concern they filed', async () => {
			const { data, error } = await lisa
				.from('safety_concerns')
				.select('id')
				.eq('slot_id', slot1);
			// Either zero rows (RLS filters all) or a permission error — never data.
			expect(data ?? []).toEqual([]);
			// If PostgREST surfaces a grant error instead, that is equally acceptable.
			if (error) expect(data).toBeNull();
		});

		it('the reported person (subject) cannot read concerns about themselves', async () => {
			const { data } = await marco
				.from('safety_concerns')
				.select('id')
				.eq('subject_id', TEST_USERS.marco.id);
			expect(data ?? []).toEqual([]);
		});

		it('a third participant cannot read the slot concerns', async () => {
			const { data } = await ava.from('safety_concerns').select('id').eq('slot_id', slot2);
			expect(data ?? []).toEqual([]);
		});
	});

	describe('steward (service-role) read — coherent per-subject history across slots', () => {
		it('reads all concerns about the shared subject from BOTH slots keyed on subject_id', async () => {
			const { data, error } = await admin
				.from('safety_concerns')
				.select('id, slot_id, kind')
				.eq('subject_id', TEST_USERS.marco.id)
				.in('slot_id', [slot1, slot2]);
			expect(error, error?.message).toBeNull();
			// marco is subject on slot1 (no_show, from lisa) and slot2 (felt_unsafe,
			// from ava) — one steward history spanning two meetings (R2/AE2).
			expect(data!.length).toBe(2);
			const slotsSeen = new Set(data!.map((r) => r.slot_id));
			expect(slotsSeen.has(slot1)).toBe(true);
			expect(slotsSeen.has(slot2)).toBe(true);
		});
	});

	describe('erase-prevention — slot_id is ON DELETE RESTRICT', () => {
		it('a concern blocks deletion of its time_slot (and transitively its prompt)', async () => {
			// The threat: a reported host erases the record against them by deleting
			// their own prompt — time_slots.prompt_id is ON DELETE CASCADE and authors
			// can deletePrompt(). safety_concerns.slot_id is ON DELETE RESTRICT, so the
			// concern pins the slot in place and the cascade cannot reach it.
			const { error: insertErr } = await admin.from('safety_concerns').insert({
				slot_id: slot1,
				reporter_id: TEST_USERS.lisa.id,
				subject_id: TEST_USERS.marco.id,
				scope: 'person',
				kind: 'felt_unsafe',
				detail: 'Pinned record — must survive slot/prompt teardown.'
			});
			expect(insertErr, insertErr?.message).toBeNull();

			// Direct slot delete is blocked by the RESTRICT FK.
			const { error: slotDelErr } = await admin.from('time_slots').delete().eq('id', slot1);
			expect(slotDelErr, 'deleting a slot with a concern must be blocked').not.toBeNull();
			expect(slotDelErr?.code).toBe('23503'); // foreign_key_violation (RESTRICT)

			// Prompt delete cascades to time_slots, which is transitively blocked by
			// the same RESTRICT — the host cannot erase the record this way either.
			const { error: promptDelErr } = await admin.from('prompts').delete().eq('id', prompt1);
			expect(promptDelErr, 'deleting the parent prompt must fail transitively').not.toBeNull();
			expect(promptDelErr?.code).toBe('23503');

			// The concern (and its slot) are still there.
			const { data: still } = await admin
				.from('safety_concerns')
				.select('id')
				.eq('slot_id', slot1);
			expect((still ?? []).length).toBeGreaterThan(0);
		});
	});

	describe('confidentiality regression guard', () => {
		it('audit_safety_concerns_read_paths reports no read path', async () => {
			const { data, error } = await admin.rpc('audit_safety_concerns_read_paths');
			expect(error, error?.message).toBeNull();
			const offenders = (data ?? []).map(
				(row: { kind: string; detail: string }) => `${row.kind}:${row.detail}`
			);
			expect(
				offenders,
				`safety_concerns has a read path that punctures the confidentiality ` +
					`invariant (R3): ${offenders.join(', ')}. No authenticated/anon SELECT ` +
					`grant and no SELECT/ALL policy may exist on this table — steward reads ` +
					`are service-role only. See 20260715120150_assert_safety_concerns_no_read.sql.`
			).toEqual([]);
		});
	});
});
