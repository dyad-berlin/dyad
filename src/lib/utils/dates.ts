/**
 * Rolling day calendar starting from today.
 * Used by discover page, editor page, and FloatingNav date filter.
 */
export interface WeekDate {
	date: string;       // 'YYYY-MM-DD' (sv-SE locale)
	dayShort: string;   // e.g. 'Mon'
	dayNum: number;     // e.g. 28
	monthShort: string; // e.g. 'Aug' — day grids show it on the 1st of a month
}

/** How far ahead scheduling reaches: the visible week + three folded weeks.
 *  Shared by the publish slot picker and the discover date filter so the two
 *  horizons can't drift apart. */
export const SCHEDULING_HORIZON_DAYS = 28;

/** `count` consecutive days starting `startOffset` days from today. */
export function getUpcomingDates(count: number, startOffset = 0): WeekDate[] {
	const today = new Date();
	return Array.from({ length: count }, (_, i) => {
		const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + startOffset + i);
		return {
			date: d.toLocaleDateString('sv-SE'),
			dayShort: d.toLocaleDateString('en-US', { weekday: 'short' }),
			dayNum: d.getDate(),
			monthShort: d.toLocaleDateString('en-US', { month: 'short' })
		};
	});
}

export function getWeekDates(): WeekDate[] {
	return getUpcomingDates(7);
}

/** Every date key from `a` to `b` inclusive, in chronological order, whichever
 *  way round the endpoints arrive. Used by drag-select sweeps. */
export function enumerateDates(a: string, b: string): string[] {
	const [from, to] = a <= b ? [a, b] : [b, a];
	const out: string[] = [];
	const cursor = new Date(from + 'T12:00:00');
	const end = new Date(to + 'T12:00:00');
	while (cursor <= end) {
		out.push(cursor.toLocaleDateString('sv-SE'));
		cursor.setDate(cursor.getDate() + 1);
	}
	return out;
}

/**
 * Hybrid timestamp: Today / Tomorrow / Day name / "29 Mar"
 */
export function formatHybridDate(iso: string): string {
	const date = new Date(iso);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return 'Today';
	if (diffDays === 1) return 'Tomorrow';
	if (diffDays >= 2 && diffDays <= 6) {
		return date.toLocaleDateString('en-GB', { weekday: 'long' });
	}
	return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** "Sat, Jun 6" — short weekday · month · day, for inline meta/status lines. */
export function formatShortDate(iso: string): string {
	return new Date(iso).toLocaleDateString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	});
}

/** "20 July 2026" — full editorial date, for essay bylines and archive listings. */
export function formatEditorialDate(iso: string): string {
	return new Date(iso).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

/**
 * Past-looking relative date for "when did this happen":
 * today → "today", yesterday → "yesterday", 2-6 days ago → weekday,
 * beyond that → "12 Apr".
 */
export function formatRelativePast(iso: string): string {
	const date = new Date(iso);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

	if (diffDays <= 0) return 'today';
	if (diffDays === 1) return 'yesterday';
	if (diffDays <= 6) return date.toLocaleDateString('en-GB', { weekday: 'long' });
	return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Format time range: "15:00–16:00" */
export function formatSlotTimeRange(iso: string, durationMinutes: number): string {
	const start = new Date(iso);
	const end = new Date(start.getTime() + durationMinutes * 60_000);
	const fmt = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
	return `${fmt(start)}–${fmt(end)}`;
}
