import { describe, it, expect } from 'vitest';
import { SupabaseInvitationService } from './invitation.js';
import { DomainError } from '$lib/domain/errors.js';

/**
 * Regression tests for past-slot invitation handling.
 *
 * Pending invitations on a slot whose start_time has passed are dead:
 * accept_invitation rejects expired slots server-side. These tests lock in
 * the service-level guards that keep them from being created or displayed:
 * - create() throws a 409 DomainError for a past slot.
 * - getPendingForPrompt() drops invitations whose slot time has passed.
 */

const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

// Chainable mock where every query method returns the chain. Terminal
// methods resolve with the stored payload, and the chain itself is thenable
// to model PostgREST's `await query` pattern.
function chainWith(data: unknown) {
	const chain: Record<string, unknown> = {};
	Object.assign(chain, {
		select: () => chain,
		insert: () => chain,
		eq: () => chain,
		order: () => chain,
		single: async () => ({ data, error: null }),
		maybeSingle: async () => ({ data, error: null }),
		then: (cb: (v: { data: unknown; error: null }) => unknown) =>
			cb({ data, error: null })
	});
	return chain;
}

function mockSupabase(tables: Record<string, unknown>) {
	return {
		from(table: string) {
			if (table in tables) return chainWith(tables[table]);
			throw new Error(`unexpected table: ${table}`);
		}
	};
}

const createParams = {
	promptId: 'p1',
	slotId: 's1',
	inviterId: 'u1',
	inviteeId: 'u2'
};

describe('SupabaseInvitationService.create — past-slot guard', () => {
	it('throws a 409 DomainError when the slot start time has passed', async () => {
		const supa = mockSupabase({
			time_slots_public: { start_time: PAST }
		});
		// @ts-expect-error test-only shape
		const svc = new SupabaseInvitationService(supa);
		await expect(svc.create(createParams)).rejects.toThrow(DomainError);
		await expect(svc.create(createParams)).rejects.toMatchObject({
			status: 409,
			message: 'This time has passed.'
		});
	});

	it('creates the invitation when the slot is in the future', async () => {
		const row = { id: 'inv1', ...createParams, state: 'pending' };
		const supa = mockSupabase({
			time_slots_public: { start_time: FUTURE },
			prompt_invitations: row
		});
		// @ts-expect-error test-only shape
		const svc = new SupabaseInvitationService(supa);
		const invitation = await svc.create(createParams);
		expect(invitation.id).toBe('inv1');
	});
});

describe('SupabaseInvitationService.getPendingForPrompt — past-slot filter', () => {
	it('drops invitations whose slot start time has passed and strips the join', async () => {
		const supa = mockSupabase({
			prompt_invitations: [
				{ id: 'past', slot_id: 's1', state: 'pending', slot: { start_time: PAST } },
				{ id: 'upcoming', slot_id: 's2', state: 'pending', slot: { start_time: FUTURE } }
			]
		});
		// @ts-expect-error test-only shape
		const svc = new SupabaseInvitationService(supa);
		const pending = await svc.getPendingForPrompt('p1', 'u1');
		expect(pending.map((inv) => inv.id)).toEqual(['upcoming']);
		expect('slot' in pending[0]).toBe(false);
	});

	it('keeps an invitation whose slot join is missing (defensive)', async () => {
		const supa = mockSupabase({
			prompt_invitations: [{ id: 'noslot', slot_id: 's3', state: 'pending', slot: null }]
		});
		// @ts-expect-error test-only shape
		const svc = new SupabaseInvitationService(supa);
		const pending = await svc.getPendingForPrompt('p1', 'u1');
		expect(pending.map((inv) => inv.id)).toEqual(['noslot']);
	});
});
