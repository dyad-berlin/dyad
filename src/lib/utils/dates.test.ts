import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getUpcomingDates, getWeekDates, SCHEDULING_HORIZON_DAYS } from './dates';

// Pin the clock: these helpers read `new Date()` internally, so unpinned
// assertions can flake across local midnight, and the month-boundary case is
// only meaningful when the horizon provably crosses a month. 20 Jan 2026 puts
// the 28-day horizon across the Jan→Feb boundary.
const FIXED_NOW = new Date('2026-01-20T10:00:00');

describe('getUpcomingDates', () => {
	beforeEach(() => {
		vi.useFakeTimers({ now: FIXED_NOW });
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns the requested count of consecutive days', () => {
		const days = getUpcomingDates(21, 7);
		expect(days).toHaveLength(21);
		for (let i = 1; i < days.length; i++) {
			const prev = new Date(days[i - 1].date + 'T12:00:00');
			const curr = new Date(days[i].date + 'T12:00:00');
			expect(Math.round((curr.getTime() - prev.getTime()) / 86_400_000)).toBe(1);
		}
	});

	it('starts at the offset: day 7 follows directly after the week rail', () => {
		const rail = getWeekDates();
		const later = getUpcomingDates(SCHEDULING_HORIZON_DAYS - 7, 7);
		const lastRail = new Date(rail[6].date + 'T12:00:00');
		const firstLater = new Date(later[0].date + 'T12:00:00');
		expect(Math.round((firstLater.getTime() - lastRail.getTime()) / 86_400_000)).toBe(1);
	});

	it('getWeekDates stays the 0-offset 7-day window', () => {
		expect(getWeekDates()).toEqual(getUpcomingDates(7));
	});

	it('starts today and ends horizon-1 days out', () => {
		const days = getUpcomingDates(SCHEDULING_HORIZON_DAYS);
		expect(days[0].date).toBe('2026-01-20');
		expect(days[days.length - 1].date).toBe('2026-02-16');
	});

	it('carries the correct month label across a month boundary', () => {
		const days = getUpcomingDates(SCHEDULING_HORIZON_DAYS);
		const firstOfMonth = days.find((d) => d.dayNum === 1);
		expect(firstOfMonth?.date).toBe('2026-02-01');
		expect(firstOfMonth?.monthShort).toBe('Feb');
		const lastOfJanuary = days.find((d) => d.date === '2026-01-31');
		expect(lastOfJanuary?.monthShort).toBe('Jan');
		// Format holds for every entry, not just the boundary pair.
		for (const day of days) {
			expect(day.monthShort).toMatch(/^[A-Z][a-z]{2}$/);
		}
	});
});
