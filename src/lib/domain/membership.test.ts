import { describe, it, expect } from 'vitest';
import { toMembershipDisplay } from './membership.js';

describe('toMembershipDisplay', () => {
	it('returns null for no row', () => {
		expect(toMembershipDisplay(null)).toBeNull();
		expect(toMembershipDisplay(undefined)).toBeNull();
	});

	it('maps an active paid subscription', () => {
		expect(toMembershipDisplay({ active: true, cadence: 'annual', source: 'paid' })).toEqual({
			active: true,
			cadence: 'annual',
			source: 'paid'
		});
	});

	it('maps a genuinely lapsed subscription (cadence retained on lapse)', () => {
		expect(toMembershipDisplay({ active: false, cadence: 'monthly', source: 'paid' })).toEqual({
			active: false,
			cadence: 'monthly',
			source: 'paid'
		});
	});

	it('maps an active grant (comp, null cadence)', () => {
		expect(toMembershipDisplay({ active: true, cadence: null, source: 'comp' })).toEqual({
			active: true,
			cadence: null,
			source: 'comp'
		});
	});

	it('maps a revoked grant so surfaces can show "access ended"', () => {
		expect(toMembershipDisplay({ active: false, cadence: null, source: 'comp' })).toEqual({
			active: false,
			cadence: null,
			source: 'comp'
		});
	});

	it('treats a never-activated paid row (abandoned checkout) as a non-member', () => {
		// ensurePaymentRef inserts { source:'paid', active:false } with no cadence
		// before the Stripe redirect; the webhook sets cadence on activation.
		expect(toMembershipDisplay({ active: false, cadence: null, source: 'paid' })).toBeNull();
	});

	it('passes currentPeriodEnd through only when the column was selected', () => {
		expect(
			toMembershipDisplay({ active: true, cadence: 'annual', source: 'paid', current_period_end: '2027-01-01' })
		).toEqual({ active: true, cadence: 'annual', source: 'paid', currentPeriodEnd: '2027-01-01' });
		expect(toMembershipDisplay({ active: true, cadence: 'annual', source: 'paid' })).not.toHaveProperty(
			'currentPeriodEnd'
		);
	});
});
