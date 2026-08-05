import { describe, it, expect } from 'vitest';
import { clampFeaturedIndex, nextFeaturedIndex } from './featured-index';

describe('clampFeaturedIndex', () => {
	it('leaves an in-range index alone', () => {
		expect(clampFeaturedIndex(0, 3)).toBe(0);
		expect(clampFeaturedIndex(1, 3)).toBe(1);
		expect(clampFeaturedIndex(2, 3)).toBe(2);
	});

	it('pulls an index that outlived a longer list back to the last item', () => {
		// The stepper sat at "3 of 5", then the loader swapped in a 2-item list.
		expect(clampFeaturedIndex(4, 2)).toBe(1);
		expect(clampFeaturedIndex(2, 1)).toBe(0);
	});

	it('returns 0 for an empty list rather than -1', () => {
		// Reading list[-1] would be undefined too, but 0 keeps the counter honest.
		expect(clampFeaturedIndex(0, 0)).toBe(0);
		expect(clampFeaturedIndex(3, 0)).toBe(0);
	});

	it('floors a negative index at 0', () => {
		expect(clampFeaturedIndex(-1, 3)).toBe(0);
	});
});

describe('nextFeaturedIndex', () => {
	it('steps forward and back within range', () => {
		expect(nextFeaturedIndex(0, 1, 3)).toBe(1);
		expect(nextFeaturedIndex(1, 1, 3)).toBe(2);
		expect(nextFeaturedIndex(2, -1, 3)).toBe(1);
	});

	it('wraps forward off the end to the first item', () => {
		expect(nextFeaturedIndex(2, 1, 3)).toBe(0);
	});

	it('wraps backward off the start to the last item', () => {
		expect(nextFeaturedIndex(0, -1, 3)).toBe(2);
	});

	it('is the identity for a single-item list', () => {
		// The nav is hidden at length 1, so this is belt-and-braces.
		expect(nextFeaturedIndex(0, 1, 1)).toBe(0);
		expect(nextFeaturedIndex(0, -1, 1)).toBe(0);
	});

	it('steps relative to the clamped position when the list shrank', () => {
		// Index 4 against a 2-item list clamps to 1; stepping forward wraps to 0.
		expect(nextFeaturedIndex(4, 1, 2)).toBe(0);
		expect(nextFeaturedIndex(4, -1, 2)).toBe(0);
	});

	it('returns 0 for an empty list instead of NaN', () => {
		// `(i + delta + 0) % 0` is NaN, which would blank the card.
		expect(nextFeaturedIndex(0, 1, 0)).toBe(0);
		expect(nextFeaturedIndex(2, -1, 0)).toBe(0);
	});
});
