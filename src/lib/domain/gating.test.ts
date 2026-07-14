import { describe, it, expect } from 'vitest';
import {
	gatingActionForCapacity,
	isProtectedAction,
	PROTECTED_ACTIONS,
	PROTECTED_ACTION_META
} from './gating.js';

describe('gatingActionForCapacity', () => {
	it('maps capacity 1 to the one-on-one action', () => {
		expect(gatingActionForCapacity('respond_take_slot', 1)).toBe('respond_take_slot_1on1');
		expect(gatingActionForCapacity('invite_to_meet', 1)).toBe('invite_to_meet_1on1');
	});

	it('maps NULL capacity to the group action (legacy unlimited)', () => {
		expect(gatingActionForCapacity('respond_take_slot', null)).toBe('respond_take_slot_group');
		expect(gatingActionForCapacity('invite_to_meet', null)).toBe('invite_to_meet_group');
	});

	it('maps capacity >= 2 to the group action', () => {
		for (const cap of [2, 3, 7]) {
			expect(gatingActionForCapacity('respond_take_slot', cap)).toBe('respond_take_slot_group');
			expect(gatingActionForCapacity('invite_to_meet', cap)).toBe('invite_to_meet_group');
		}
	});

	it('only ever returns a protected action', () => {
		for (const cap of [1, 2, null]) {
			expect(isProtectedAction(gatingActionForCapacity('respond_take_slot', cap))).toBe(true);
			expect(isProtectedAction(gatingActionForCapacity('invite_to_meet', cap))).toBe(true);
		}
	});
});

describe('PROTECTED_ACTIONS catalogue', () => {
	it('is the five expected keys', () => {
		expect([...PROTECTED_ACTIONS]).toEqual([
			'create_conversation',
			'respond_take_slot_1on1',
			'respond_take_slot_group',
			'invite_to_meet_1on1',
			'invite_to_meet_group'
		]);
	});

	it('has meta for every protected action', () => {
		for (const action of PROTECTED_ACTIONS) {
			expect(PROTECTED_ACTION_META[action]?.label).toBeTruthy();
			expect(PROTECTED_ACTION_META[action]?.hint).toBeTruthy();
		}
	});

	it('rejects the retired size-blind keys', () => {
		expect(isProtectedAction('respond_take_slot')).toBe(false);
		expect(isProtectedAction('invite_to_meet')).toBe(false);
	});
});
