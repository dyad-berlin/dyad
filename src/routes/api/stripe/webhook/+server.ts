import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { makeAdminClient } from '$lib/server/supabase-admin';
import { createStripeClient, getStripeWebhookCryptoProvider } from '$lib/server/stripe';
import {
	getRegisteredEventTypes,
	isStripeEventKind,
	lookupStripeHandler
} from '$lib/server/stripe-event-router';
import type { RequestHandler } from './$types';
import type Stripe from 'stripe';

/**
 * Stripe webhook entry point.
 *
 * Order of operations (this is the load-bearing invariant — do not reorder):
 *
 *   1. Read raw request body once via request.text()
 *   2. Verify signature against STRIPE_WEBHOOK_SECRET via SubtleCrypto
 *   3. Idempotency check: if event.id already in processed_stripe_events,
 *      return 200 immediately without re-processing
 *   4. Look up handler by (event.type, event.data.object.metadata.kind)
 *   5. Run synchronous handler work — throws cause 5xx so Stripe retries
 *   6. INSERT processed_stripe_events row only after step 5 succeeded
 *   7. Optional fire-and-forget side effects via ctx.waitUntil(...)
 *      (falls back to inline await when ctx is undefined, e.g. in dev)
 *   8. Return 200
 *
 * Silent loss is structurally impossible: the idempotency row exists if and
 * only if the synchronous correctness-critical work succeeded. A 5xx leaves
 * no row; Stripe's retry can re-process.
 *
 * Logging discipline (R12a): never log event.data.object or sub-fields.
 * Only event.id, event.type, and metadata.kind go to logs.
 *
 * See plan 003 R3–R6, R12a.
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	// platform.ctx?.waitUntil(...) is the Workers-runtime escape hatch for
	// fire-and-forget side effects after returning 200. The router scaffold
	// here doesn't fire any itself; per-feature handlers (plan 002 features)
	// receive the context via StripeHandlerContext when they need it. Kept in
	// the destructure here so future handler-level extensions don't have to
	// re-thread it.
	void platform;
	const sig = request.headers.get('stripe-signature');
	if (!sig) {
		return json({ error: 'Missing Stripe-Signature header' }, { status: 400 });
	}

	let body: string;
	try {
		body = await request.text();
	} catch {
		return json({ error: 'Could not read request body' }, { status: 400 });
	}

	if (body.length === 0) {
		return json({ error: 'Empty body' }, { status: 400 });
	}

	const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
	if (!webhookSecret) {
		console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET is not configured');
		return json({ error: 'Webhook secret not configured' }, { status: 500 });
	}

	const stripe = createStripeClient({ STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY });
	const cryptoProvider = getStripeWebhookCryptoProvider();

	let event: Stripe.Event;
	try {
		event = await stripe.webhooks.constructEventAsync(
			body,
			sig,
			webhookSecret,
			undefined,
			cryptoProvider
		);
	} catch {
		// Don't echo the underlying Stripe error — generic 400 keeps internals
		// out of the response body. The verified-or-not outcome is the only
		// useful information for the caller.
		return json({ error: 'Invalid signature' }, { status: 400 });
	}

	const supabase = makeAdminClient();

	// Idempotency check. SELECT returns 0 rows for first-time event ids.
	const { data: existing } = await supabase
		.from('processed_stripe_events')
		.select('stripe_event_id')
		.eq('stripe_event_id', event.id)
		.limit(1);

	if (existing && existing.length > 0) {
		// Duplicate delivery. Stripe retried because we previously failed before
		// the idempotency row landed; we already succeeded since (or another
		// instance is concurrently processing). Either way, 200 short-circuits.
		console.error('[stripe/webhook] duplicate event', {
			eventId: event.id,
			eventType: event.type
		});
		return json({ ok: true, deduped: true });
	}

	// Resolve the metadata.kind. Stripe Events have varying object shapes;
	// most relevant types (Checkout Session, PaymentIntent, Subscription) carry
	// metadata at event.data.object.metadata. Treat absence as "unknown kind".
	const objectMetadata =
		(event.data?.object as { metadata?: Record<string, unknown> } | undefined)?.metadata ?? {};
	const rawKind = typeof objectMetadata.kind === 'string' ? objectMetadata.kind : undefined;

	// Distinguish the two unhandled cases per plan 003 U2:
	//   (a) no registered handler for this event.type at all → unrecognized_event_type
	//       (legitimately unhandled, e.g. a Dashboard-manual charge)
	//   (b) event.type has handlers but this metadata.kind has none → unhandled_event_kind
	//       (suspicious; dyad-side code created this session)
	const kind = rawKind && isStripeEventKind(rawKind) ? rawKind : undefined;
	const handler = kind ? lookupStripeHandler(event.type, kind) : undefined;

	if (!handler || !kind) {
		const eventTypeRegistered = getRegisteredEventTypes().has(event.type);
		if (!eventTypeRegistered) {
			console.error('[stripe/webhook] unrecognized_event_type', {
				eventId: event.id,
				eventType: event.type
			});
		} else {
			console.error('[stripe/webhook] unhandled_event_kind', {
				eventId: event.id,
				eventType: event.type,
				metadataKind: rawKind ?? null
			});
		}
		// 200 either way — asking Stripe to retry an unhandled event would loop.
		return json({ ok: true, unhandled: true });
	}

	// Run the handler. Throwing here propagates as a 5xx so Stripe retries.
	try {
		await handler({ event, kind, supabase });
	} catch (err) {
		console.error('[stripe/webhook] handler threw', {
			eventId: event.id,
			eventType: event.type,
			metadataKind: rawKind ?? null,
			error: err instanceof Error ? err.message : 'unknown'
		});
		return json({ error: 'Handler failed' }, { status: 500 });
	}

	// Synchronous work succeeded. Record the idempotency row.
	const { error: insertError } = await supabase
		.from('processed_stripe_events')
		.insert({ stripe_event_id: event.id });

	if (insertError) {
		// Insert can race with a concurrent delivery of the same event id; both
		// instances passed the SELECT check. The PRIMARY KEY collision becomes a
		// unique-violation; the handler already ran, so we treat this as a
		// duplicate and return 200 rather than 5xx (which would trigger another
		// Stripe retry of work that already succeeded).
		console.error('[stripe/webhook] idempotency row insert failed', {
			eventId: event.id,
			eventType: event.type,
			code: insertError.code
		});
		return json({ ok: true, raceDeduped: true });
	}

	return json({ ok: true });
};
