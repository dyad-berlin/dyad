import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	STRIPE_EVENT_KIND,
	registerStripeHandler,
	lookupStripeHandler,
	getRegisteredEventTypes,
	isStripeEventKind,
	__resetStripeHandlerRegistryForTesting
} from './stripe-event-router.js';

describe('stripe-event-router', () => {
	beforeEach(() => {
		__resetStripeHandlerRegistryForTesting();
	});

	describe('STRIPE_EVENT_KIND', () => {
		it('exposes the canonical kind tokens', () => {
			expect(STRIPE_EVENT_KIND.foundingCircle).toBe('founding_circle');
			expect(STRIPE_EVENT_KIND.membership).toBe('membership');
			expect(STRIPE_EVENT_KIND.trinkgeld).toBe('trinkgeld');
			expect(STRIPE_EVENT_KIND.venuePatronContribution).toBe('venue_patron_contribution');
		});
	});

	describe('isStripeEventKind', () => {
		it('returns true for known kinds', () => {
			expect(isStripeEventKind('founding_circle')).toBe(true);
			expect(isStripeEventKind('membership')).toBe(true);
			expect(isStripeEventKind('trinkgeld')).toBe(true);
			expect(isStripeEventKind('venue_patron_contribution')).toBe(true);
		});

		it('returns false for unknown kinds', () => {
			expect(isStripeEventKind('subscription')).toBe(false);
			expect(isStripeEventKind('')).toBe(false);
			expect(isStripeEventKind('FOUNDING_CIRCLE')).toBe(false);
		});
	});

	describe('register + lookup', () => {
		it('returns the registered handler for a matching (eventType, kind) pair', () => {
			const handler = vi.fn();
			registerStripeHandler('checkout.session.completed', STRIPE_EVENT_KIND.foundingCircle, handler);

			const found = lookupStripeHandler('checkout.session.completed', 'founding_circle');
			expect(found).toBe(handler);
		});

		it('returns undefined when no handler matches the eventType', () => {
			registerStripeHandler('checkout.session.completed', STRIPE_EVENT_KIND.foundingCircle, vi.fn());

			expect(
				lookupStripeHandler('payment_intent.succeeded', 'founding_circle')
			).toBeUndefined();
		});

		it('returns undefined when the metadata.kind is unknown', () => {
			registerStripeHandler('checkout.session.completed', STRIPE_EVENT_KIND.foundingCircle, vi.fn());

			expect(
				lookupStripeHandler('checkout.session.completed', 'subscription')
			).toBeUndefined();
		});

		it('returns undefined when the metadata.kind is undefined', () => {
			registerStripeHandler('checkout.session.completed', STRIPE_EVENT_KIND.foundingCircle, vi.fn());

			expect(lookupStripeHandler('checkout.session.completed', undefined)).toBeUndefined();
		});

		it('throws when the same (eventType, kind) is registered twice', () => {
			registerStripeHandler('checkout.session.completed', STRIPE_EVENT_KIND.foundingCircle, vi.fn());

			expect(() =>
				registerStripeHandler(
					'checkout.session.completed',
					STRIPE_EVENT_KIND.foundingCircle,
					vi.fn()
				)
			).toThrowError(/already registered/);
		});

		it('allows the same eventType with different kinds', () => {
			const founding = vi.fn();
			const membership = vi.fn();
			registerStripeHandler('checkout.session.completed', STRIPE_EVENT_KIND.foundingCircle, founding);
			registerStripeHandler('checkout.session.completed', STRIPE_EVENT_KIND.membership, membership);

			expect(lookupStripeHandler('checkout.session.completed', 'founding_circle')).toBe(founding);
			expect(lookupStripeHandler('checkout.session.completed', 'membership')).toBe(membership);
		});
	});

	describe('getRegisteredEventTypes', () => {
		it('returns the set of event types with at least one registered handler', () => {
			registerStripeHandler('checkout.session.completed', STRIPE_EVENT_KIND.foundingCircle, vi.fn());
			registerStripeHandler('payment_intent.succeeded', STRIPE_EVENT_KIND.trinkgeld, vi.fn());

			const types = getRegisteredEventTypes();
			expect(types).toEqual(new Set(['checkout.session.completed', 'payment_intent.succeeded']));
		});

		it('returns an empty set when nothing is registered', () => {
			expect(getRegisteredEventTypes()).toEqual(new Set());
		});

		it('returns a fresh Set on each call (consumers cannot mutate the registry)', () => {
			registerStripeHandler('checkout.session.completed', STRIPE_EVENT_KIND.foundingCircle, vi.fn());
			const a = getRegisteredEventTypes();
			a.add('forged.event.type');
			const b = getRegisteredEventTypes();
			expect(b.has('forged.event.type')).toBe(false);
		});
	});
});
