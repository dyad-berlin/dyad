import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Record a successful Stripe transaction in the dyad-side audit log.
 *
 * Idempotent on `stripe_payment_intent_id`: a duplicate call with the same
 * payment intent id is a no-op (ON CONFLICT DO NOTHING). This is what makes
 * the webhook handler's "INSERT-after-handler-succeeds" pattern safe under
 * Stripe retries — the second retry's handler still calls recordPayment,
 * the audit-log row is already there, no second insert occurs.
 *
 * Accepted `kind` values are the strings in `STRIPE_EVENT_KIND` from
 * stripe-event-router.ts. Take care not to introduce new kinds without
 * adding them to the router constant — the constant is the single source
 * of truth and the lint test enforces it.
 *
 * Caller MUST be invoking with the service-role client (the table grants
 * SELECT/INSERT only to service_role). Authenticated callers will see an
 * RLS rejection.
 */
export async function recordPayment(
	supabase: SupabaseClient,
	args: {
		stripePaymentIntentId: string;
		userId: string | null;
		kind: string;
		amountCents: number;
	}
): Promise<void> {
	if (args.amountCents <= 0) {
		throw new Error('amountCents must be positive');
	}

	const { error } = await supabase.from('payments').insert(
		{
			stripe_payment_intent_id: args.stripePaymentIntentId,
			user_id: args.userId,
			kind: args.kind,
			amount_cents: args.amountCents
		},
		{
			// ON CONFLICT DO NOTHING via the upsert call's defaultToNull pattern —
			// supabase-js doesn't expose `ON CONFLICT DO NOTHING` directly on
			// .insert(), so we use the unique-violation code (23505) as the
			// signal that this stripe_payment_intent_id is already recorded.
		}
	);

	if (error) {
		// Postgres unique-violation = already recorded. Idempotent return.
		if (error.code === '23505') return;
		throw new Error(`Failed to record payment: ${error.message}`);
	}
}
