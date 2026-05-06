import Stripe from 'stripe';

/**
 * Single entry point for constructing a Stripe client. Used by every
 * server-side payment-bearing code path: webhook handler, Checkout-session
 * creation, customer-portal redirects, and any future Express Checkout
 * server hops.
 *
 * Cloudflare Workers compatibility: the SDK requires a fetch-based HTTP
 * client because the Workers runtime does not expose Node's `http`. The
 * SDK ships `createFetchHttpClient()` for exactly this case.
 *
 * Webhook signature verification additionally requires a SubtleCrypto
 * provider on Workers; `getStripeWebhookCryptoProvider()` exposes it for
 * the webhook handler to pass into `constructEventAsync(...)`.
 *
 * Secrets live in Cloudflare Pages environment variables, never in source.
 * The local `.env.local` is gitignored. See CLAUDE.md "Environment
 * Variables" for the full env-var contract.
 *
 * Throws synchronously if STRIPE_SECRET_KEY is missing — every caller is
 * a server-side handler where a missing secret is an unrecoverable misconfig
 * and should fail fast at handler entry rather than silently making
 * unauthenticated calls to Stripe.
 */
export function createStripeClient(env: {
	STRIPE_SECRET_KEY: string | undefined;
}): Stripe {
	const apiKey = env.STRIPE_SECRET_KEY;
	if (!apiKey) {
		throw new Error('STRIPE_SECRET_KEY is not configured');
	}

	return new Stripe(apiKey, {
		httpClient: Stripe.createFetchHttpClient()
	});
}

/**
 * Workers-compatible SubtleCrypto provider for Stripe webhook signature
 * verification. Pass into `client.webhooks.constructEventAsync(body, sig,
 * secret, tolerance, cryptoProvider)`.
 */
export function getStripeWebhookCryptoProvider(): InstanceType<typeof Stripe.CryptoProvider> {
	return Stripe.createSubtleCryptoProvider();
}
