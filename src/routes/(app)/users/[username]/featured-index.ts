/**
 * Index arithmetic for the featured-feedback stepper on a public profile.
 *
 * Extracted from +page.svelte so the wrap-around and the bounds guard are
 * unit-testable — the same reason MapView.pins.ts sits beside MapView.svelte.
 *
 * The bounds guard matters because the index is component-local `$state` while
 * the array it indexes is `$derived` from `data`. SvelteKit reuses the page
 * component across a navigation that keeps the same route id, and re-runs the
 * loader in place on `invalidateAll()` (MeetingFeedbackModal does this from the
 * (app) layout, on whatever page the member is standing on). Either path can
 * swap in a shorter array under an index that survived, so every read of the
 * index is clamped rather than trusted.
 */

/** Largest valid index for a list of `length`, or 0 when the list is empty. */
function lastIndex(length: number): number {
	return Math.max(length - 1, 0);
}

/**
 * Clamp an index into `[0, length - 1]`. Returns 0 for an empty list, so a
 * caller that reads `list[clampFeaturedIndex(i, 0)]` gets `undefined` rather
 * than reading at a negative index.
 */
export function clampFeaturedIndex(index: number, length: number): number {
	if (length <= 0) return 0;
	return Math.min(Math.max(index, 0), lastIndex(length));
}

/**
 * Step `delta` places from `current`, wrapping at both ends so neither arrow is
 * ever a dead control. `current` is clamped first: stepping from an index that
 * outlived a longer list should move relative to what is on screen, not to the
 * stale value.
 */
export function nextFeaturedIndex(current: number, delta: number, length: number): number {
	if (length <= 0) return 0;
	const from = clampFeaturedIndex(current, length);
	return (from + delta + length) % length;
}
