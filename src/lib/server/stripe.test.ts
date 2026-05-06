import { describe, it, expect } from 'vitest';
import Stripe from 'stripe';
import { createStripeClient, getStripeWebhookCryptoProvider } from './stripe.js';

describe('createStripeClient', () => {
	it('returns a Stripe instance when STRIPE_SECRET_KEY is set', () => {
		const client = createStripeClient({ STRIPE_SECRET_KEY: 'sk_test_dummy' });
		expect(client).toBeInstanceOf(Stripe);
	});

	it('throws synchronously when STRIPE_SECRET_KEY is missing', () => {
		expect(() => createStripeClient({ STRIPE_SECRET_KEY: undefined })).toThrowError(
			/STRIPE_SECRET_KEY is not configured/
		);
	});

	it('throws synchronously when STRIPE_SECRET_KEY is the empty string', () => {
		expect(() => createStripeClient({ STRIPE_SECRET_KEY: '' })).toThrowError(
			/STRIPE_SECRET_KEY is not configured/
		);
	});

	it('does not error during construction (Workers runtime smoke)', () => {
		// On Cloudflare Workers, the default node:http-based client throws at
		// construction time when invoked from a worker context. Constructing
		// here with the fetch HTTP client we wire in must succeed without
		// touching node:http.
		expect(() => createStripeClient({ STRIPE_SECRET_KEY: 'sk_test_dummy' })).not.toThrow();
	});
});

describe('getStripeWebhookCryptoProvider', () => {
	it('returns a SubtleCrypto-based provider suitable for Workers', () => {
		const provider = getStripeWebhookCryptoProvider();
		expect(provider).toBeDefined();
		// SubtleCryptoProvider has a `computeHMACSignatureAsync` method;
		// NodeCryptoProvider would expose `computeHMACSignature` synchronously.
		// Asserting the async API confirms we got the Workers-compatible variant.
		expect(typeof provider.computeHMACSignatureAsync).toBe('function');
	});
});
