import { describe, it, expect } from 'vitest';
import {
	othersBeyond,
	deriveStackLayout,
	buildParticipantsFromSiblings,
	cancellablePairs
} from './gathering.js';

describe('othersBeyond', () => {
	it('subtracts the identified seats from occupancy', () => {
		expect(othersBeyond(3, 2)).toBe(1);
	});

	it('clamps to zero when identified exceeds occupancy', () => {
		expect(othersBeyond(2, 3)).toBe(0);
	});

	it('single identified seat (the viewer or host)', () => {
		expect(othersBeyond(3, 1)).toBe(2);
	});

	it('one occupied, one identified → no others', () => {
		expect(othersBeyond(1, 1)).toBe(0);
	});

	it('empty slot with one identified seat → no others', () => {
		expect(othersBeyond(0, 1)).toBe(0);
	});
});

describe('deriveStackLayout', () => {
	it('identified + anon both fit, no overflow', () => {
		// 3 identified (incl. self) + 3 anon, max 6 → everything visible.
		expect(deriveStackLayout(3, 3, 6)).toEqual({ visibleCount: 3, anonShown: 3, overflow: 0 });
	});

	it('identified fills the width, anon overflows', () => {
		// 6 identified fill the 6 slots; all 4 anon overflow.
		expect(deriveStackLayout(6, 4, 6)).toEqual({ visibleCount: 6, anonShown: 0, overflow: 4 });
	});

	it('empty stack', () => {
		expect(deriveStackLayout(0, 0, 6)).toEqual({ visibleCount: 0, anonShown: 0, overflow: 0 });
	});

	it('one identified, anon fills the rest then overflows', () => {
		// 1 identified + 7 anon, max 6 → 1 named, 5 anon shown, 2 overflow.
		expect(deriveStackLayout(1, 7, 6)).toEqual({ visibleCount: 1, anonShown: 5, overflow: 2 });
	});
});

describe('buildParticipantsFromSiblings', () => {
	const me = 'viewer';

	it('maps the other participant when the viewer is participant_a', () => {
		const map = buildParticipantsFromSiblings(
			[{ id: 'm1', participant_a: me, participant_b: 'partner' }],
			me
		);
		expect(map).toEqual(new Map([['partner', 'm1']]));
	});

	it('first-wins on duplicate partner rows', () => {
		const map = buildParticipantsFromSiblings(
			[
				{ id: 'm1', participant_a: me, participant_b: 'partner' },
				{ id: 'm2', participant_a: 'partner', participant_b: me }
			],
			me
		);
		expect(map.get('partner')).toBe('m1');
		expect(map.size).toBe(1);
	});

	it('skips a row pairing the viewer with themself', () => {
		const map = buildParticipantsFromSiblings(
			[{ id: 'm1', participant_a: me, participant_b: me }],
			me
		);
		expect(map.size).toBe(0);
	});

	it('empty input yields an empty map', () => {
		expect(buildParticipantsFromSiblings([], me)).toEqual(new Map());
	});
});

describe('cancellablePairs', () => {
	it('keeps only scheduled pairs', () => {
		const pairs = [
			{ username: 'a', meetingId: 'm1', state: 'scheduled' },
			{ username: 'b', meetingId: 'm2', state: 'awaiting_feedback' },
			{ username: 'c', meetingId: 'm3', state: 'completed' },
			{ username: 'd', meetingId: 'm4', state: 'cancelled_late' },
			{ username: 'e', meetingId: 'm5', state: 'scheduled' }
		];
		expect(cancellablePairs(pairs).map((p) => p.meetingId)).toEqual(['m1', 'm5']);
	});

	it('returns an empty list when no pair is scheduled', () => {
		expect(
			cancellablePairs([{ username: 'a', meetingId: 'm1', state: 'completed' }])
		).toEqual([]);
	});

	it('is a no-op when every pair is scheduled', () => {
		const pairs = [
			{ username: 'a', meetingId: 'm1', state: 'scheduled' },
			{ username: 'b', meetingId: 'm2', state: 'scheduled' }
		];
		expect(cancellablePairs(pairs)).toEqual(pairs);
	});

	it('empty input yields an empty list', () => {
		expect(cancellablePairs([])).toEqual([]);
	});
});
