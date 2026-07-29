import { describe, it, expect } from 'vitest';
import { getUpcomingDates, getWeekDates, SCHEDULING_HORIZON_DAYS } from './dates';

describe('getUpcomingDates', () => {
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

	it('carries a month label for grid cells on the 1st of a month', () => {
		// Within any 28-day horizon at least one month boundary can occur; assert
		// the field is always present and plausible rather than date-dependent.
		for (const day of getUpcomingDates(SCHEDULING_HORIZON_DAYS)) {
			expect(day.monthShort).toMatch(/^[A-Z][a-z]{2}$/);
		}
	});
});
