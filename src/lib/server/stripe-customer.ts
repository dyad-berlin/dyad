import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get or create the Stripe Customer for a dyad user. Creates the Customer
 * lazily on first interaction, so most users never have a Stripe Customer
 * record at all.
 *
 * The Customer record at Stripe carries NO contact-bearing data —
 * specifically no email, name, phone, or address (per plan 003 R11
 * payment opacity contract). The only metadata is `client_reference_id`
 * holding the opaque dyad user_id, used to correlate Stripe-side events
 * back to dyad-side rows.
 *
 * Idempotency: the create call passes `idempotencyKey: userId` so that a
 * retry after partial-write failure (worker timeout, transient DB error,
 * deploy mid-flight) returns the same Stripe Customer id rather than
 * creating an orphan. Combined with the `ON CONFLICT (user_id)` upsert in
 * `app.upsert_profile_payment_customer`, this closes the race where two
 * concurrent first-call attempts could each create a Customer.
 *
 * Caller MUST be invoking with the service-role Supabase client (the
 * upsert RPC's GRANT is service-role-only; the SELECT policy on
 * profile_payments scopes member reads to their own row).
 */
export async function getOrCreateStripeCustomer(
	userId: string,
	stripe: Stripe,
	supabase: SupabaseClient
): Promise<string> {
	// Read first via the regular table — works for both service-role
	// (no RLS) and authenticated (own row only) callers.
	const { data: existing } = await supabase
		.from('profile_payments')
		.select('stripe_customer_id')
		.eq('user_id', userId)
		.maybeSingle();

	if (existing?.stripe_customer_id) {
		return existing.stripe_customer_id;
	}

	// Create the Customer at Stripe. NO email, name, phone, address.
	// `metadata.dyad_user_id` is the only correlation field and is itself
	// an opaque UUID. `idempotencyKey: userId` ensures a retried call after
	// a partial-write failure returns the same Customer id.
	const customer = await stripe.customers.create(
		{
			metadata: { dyad_user_id: userId }
		},
		{ idempotencyKey: `customer:${userId}` }
	);

	// Upsert via the SECURITY DEFINER RPC. ON CONFLICT preserves the
	// existing customer id if one was written by a concurrent first-call.
	const { data: resolved, error } = await supabase.rpc('upsert_profile_payment_customer', {
		p_user_id: userId,
		p_stripe_customer_id: customer.id
	});

	if (error) {
		// The Customer exists at Stripe (the idempotency key means a retry
		// returns the same id). Surface the error so the caller can decide
		// whether to retry the dyad-side write or report failure.
		throw new Error(`Failed to upsert profile_payments: ${error.message}`);
	}

	// `resolved` is the canonical customer id — either the one we just created
	// or the one a concurrent first-call wrote first.
	return resolved as string;
}
