import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { requireIdentity } from '$lib/services/identity.js';
import { parseJsonBody } from '$lib/server/parse-body.js';
import { createStripeClient } from '$lib/server/stripe.js';
import { makeAdminClient } from '$lib/server/supabase-admin.js';
import { ensurePaymentRef } from '$lib/server/stripe-customer.js';
import {
	MEMBERSHIP_CADENCES,
	MEMBERSHIP_MONTHLY_TIERS,
	type MembershipMonthlyTier
} from '$lib/domain/types.js';
import { handleServiceError } from '$lib/server/handle-service-error.js';

// Annual/lifetime each map to a single Price. Monthly is a solidarity scale, so
// each tier is its own Price (see MONTHLY_TIER_PRICE_ENV).
const PRICE_ENV: Record<'annual' | 'lifetime', string> = {
	annual: 'STRIPE_PRICE_ID_ANNUAL',
	lifetime: 'STRIPE_PRICE_ID_LIFETIME'
};

const MONTHLY_TIER_PRICE_ENV: Record<MembershipMonthlyTier, string> = {
	solidarity: 'STRIPE_PRICE_ID_MONTHLY_SOLIDARITY',
	standard: 'STRIPE_PRICE_ID_MONTHLY_STANDARD',
	supporter: 'STRIPE_PRICE_ID_MONTHLY_SUPPORTER'
};

/**
 * POST /api/membership/checkout — create a server-side Checkout Session and
 * return its URL for a full-page redirect (no embedded Stripe.js).
 *
 * The Session is bound to the actor via an opaque payment_ref (NOT the actor
 * id). Each monthly tier is its own fixed-price Stripe Price (solidarity €7 /
 * standard €12 / supporter €17), so the tier the member picks is the amount
 * charged — and Stripe reports subscriber counts per tier. Entitlement is set
 * by the webhook, never here — success_url lands on /membership which polls the row.
 */
export const POST: RequestHandler = async ({ request, locals, url }) => {
	const actor = requireIdentity(locals);

	const [body, errorResponse] = await parseJsonBody<{ cadence?: string; tier?: string }>(request);
	if (errorResponse) return errorResponse;

	const cadence = body.cadence;
	if (typeof cadence !== 'string' || !(MEMBERSHIP_CADENCES as readonly string[]).includes(cadence)) {
		return json({ error: 'invalid_cadence' }, { status: 400 });
	}

	// Monthly requires a solidarity tier (each tier is its own Price); annual and
	// lifetime resolve directly from the cadence.
	let priceEnvKey: string;
	if (cadence === 'monthly') {
		const tier = body.tier;
		if (typeof tier !== 'string' || !(MEMBERSHIP_MONTHLY_TIERS as readonly string[]).includes(tier)) {
			return json({ error: 'invalid_tier' }, { status: 400 });
		}
		priceEnvKey = MONTHLY_TIER_PRICE_ENV[tier as MembershipMonthlyTier];
	} else {
		priceEnvKey = PRICE_ENV[cadence as 'annual' | 'lifetime'];
	}
	const priceId = env[priceEnvKey];
	if (!priceId) {
		// Valid cadence/tier, but not offered on this deploy (no Price configured).
		return json({ error: 'cadence_unavailable' }, { status: 400 });
	}

	let stripe;
	try {
		stripe = createStripeClient(env.STRIPE_SECRET_KEY);
	} catch {
		return json({ error: 'unavailable' }, { status: 503 });
	}

	const admin = makeAdminClient();

	// Cross-cadence collision: buying lifetime while a live subscription exists
	// would orphan that subscription. Block — the member cancels in the portal first.
	const { data: existing } = await admin
		.from('memberships')
		.select('stripe_subscription_id, active')
		.eq('identity_id', actor.id)
		.maybeSingle();
	if (cadence === 'lifetime' && existing?.stripe_subscription_id && existing.active) {
		return json({ error: 'cancel_subscription_first' }, { status: 409 });
	}

	let paymentRef: string;
	try {
		paymentRef = await ensurePaymentRef(admin, actor.id);
	} catch (err) {
		return handleServiceError(err, '[membership/checkout:payment_ref]');
	}

	const isLifetime = cadence === 'lifetime';
	try {
		const session = await stripe.checkout.sessions.create({
			mode: isLifetime ? 'payment' : 'subscription',
			line_items: [{ price: priceId, quantity: 1 }],
			client_reference_id: paymentRef, // opaque pseudonym, never the actor id
			success_url: `${url.origin}/membership?status=success`,
			cancel_url: `${url.origin}/membership?status=cancelled`,
			automatic_tax: { enabled: true },
			// Lifetime (payment mode): force a Customer so refund/dispute events
			// carry a customer id the webhook can resolve. Subscription mode always
			// creates one, and carries payment_ref in the subscription metadata.
			...(isLifetime
				? { customer_creation: 'always' }
				: { subscription_data: { metadata: { payment_ref: paymentRef } } })
		});

		if (!session.url) {
			console.error('[membership/checkout] session created without a url');
			return json({ error: 'checkout_failed' }, { status: 502 });
		}
		return json({ url: session.url });
	} catch (err) {
		// Stripe API failure — generic 502, no internal detail to the client.
		console.error('[membership/checkout] stripe error:', err instanceof Error ? err.message : 'unknown');
		return json({ error: 'checkout_failed' }, { status: 502 });
	}
};
