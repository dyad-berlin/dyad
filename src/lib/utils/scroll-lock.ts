/**
 * Ref-counted body scroll lock.
 *
 * Several overlays can be open at once (auth dialog over the expanded landing
 * map, the zine menu). Direct `document.body.style.overflow` writes clobber
 * each other: whichever overlay closes second restores '' while the first is
 * still open. A module-level count keeps the body locked until the last
 * holder releases, and the first `lock()` remembers whatever inline overflow
 * value was there so the last `unlock()` can put it back.
 *
 * SSR-safe: both functions are no-ops when `document` is undefined.
 */

let count = 0;
let savedOverflow = '';

/** Lock body scroll. Sets `overflow: hidden` on the 0 -> 1 transition. */
export function lock(): void {
	if (typeof document === 'undefined') return;
	if (count === 0) {
		savedOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
	}
	count++;
}

/**
 * Release one hold on body scroll. Restores the pre-lock overflow value on
 * the 1 -> 0 transition. Calling without a matching `lock()` is a no-op.
 */
export function unlock(): void {
	if (typeof document === 'undefined') return;
	if (count === 0) return;
	count--;
	if (count === 0) {
		document.body.style.overflow = savedOverflow;
		savedOverflow = '';
	}
}
