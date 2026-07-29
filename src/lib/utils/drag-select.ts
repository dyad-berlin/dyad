import { enumerateDates } from './dates.js';

/**
 * Spreadsheet-style drag-select over date cells, shared by the discover When
 * filter's rail and the calendar modal (the publish sheet stays tap-only —
 * its 3-slot ceiling makes range sweeps moot).
 *
 * Semantics: the sweep follows its origin. Pointer-down on an unselected day
 * starts a selecting sweep; on a selected day, a deselecting sweep. On every
 * move the swept range is applied over a snapshot of the pre-drag selection,
 * so backtracking mid-drag reverts days that leave the range.
 *
 * Mechanics: pointer-down applies the origin immediately (so a plain tap
 * still works and needs no click handler); window-level pointermove
 * hit-tests via elementFromPoint against `[data-date]` cells, and pointerup
 * or pointercancel ends the session. The synthetic click that follows the
 * pointer session is consumed so cells can keep an onclick fallback for
 * keyboard activation (Enter/Space fire click with no preceding pointerdown).
 */
export interface DragSelectController {
	/** Attach to each cell's onpointerdown, passing its date key. */
	start(e: PointerEvent, date: string): void;
	/** Call first in the cell's onclick; true means a pointer session already
	 *  handled this activation and the click must be ignored. */
	consumeClick(): boolean;
}

export function createDragSelect(opts: {
	getSelected: () => Set<string>;
	replace: (next: Set<string>) => void;
}): DragSelectController {
	let origin: string | null = null;
	let snapshot: Set<string> | null = null;
	let selecting = true;
	let sessionHadPointer = false;

	function apply(current: string) {
		if (origin === null || snapshot === null) return;
		const next = new Set(snapshot);
		for (const date of enumerateDates(origin, current)) {
			if (selecting) next.add(date);
			else next.delete(date);
		}
		opts.replace(next);
	}

	function onMove(e: PointerEvent) {
		const el = document.elementFromPoint(e.clientX, e.clientY);
		const date = el?.closest<HTMLElement>('[data-date]')?.dataset.date;
		if (date) apply(date);
	}

	function end() {
		origin = null;
		snapshot = null;
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', end);
		window.removeEventListener('pointercancel', end);
	}

	return {
		start(e: PointerEvent, date: string) {
			// Primary button / touch contact only.
			if (e.button !== 0) return;
			origin = date;
			snapshot = new Set(opts.getSelected());
			selecting = !snapshot.has(date);
			sessionHadPointer = true;
			apply(date);
			window.addEventListener('pointermove', onMove);
			window.addEventListener('pointerup', end);
			window.addEventListener('pointercancel', end);
		},
		consumeClick() {
			const had = sessionHadPointer;
			sessionHadPointer = false;
			return had;
		}
	};
}
