import { describe, it, expect, vi } from 'vitest';
import type Stripe from 'stripe';
import { getOrCreateStripeCustomer } from './stripe-customer.js';

function makeSupabaseMock(opts: {
	existingCustomerId?: string | null;
	upsertReturns?: string;
	upsertError?: { message: string } | null;
}) {
	const select = vi.fn().mockReturnValue({
		eq: vi.fn().mockReturnValue({
			maybeSingle: vi.fn().mockResolvedValue({
				data: opts.existingCustomerId
					? { stripe_customer_id: opts.existingCustomerId }
					: null,
				error: null
			})
		})
	});

	const rpc = vi.fn().mockResolvedValue({
		data: opts.upsertError ? null : (opts.upsertReturns ?? 'cus_resolved'),
		error: opts.upsertError ?? null
	});

	return {
		from: vi.fn().mockReturnValue({ select }),
		rpc
	};
}

function makeStripeMock(opts: { createReturnsId?: string; createCalls?: { args: unknown[] }[] }) {
	const calls: { args: unknown[] }[] = opts.createCalls ?? [];
	const create = vi.fn().mockImplementation(async (...args: unknown[]) => {
		calls.push({ args });
		return { id: opts.createReturnsId ?? 'cus_new' };
	});
	return {
		stripe: { customers: { create } } as unknown as Stripe,
		create,
		calls
	};
}

describe('getOrCreateStripeCustomer', () => {
	it('returns the existing customer id without calling Stripe when one is present', async () => {
		const supabase = makeSupabaseMock({ existingCustomerId: 'cus_existing' });
		const { stripe, create } = makeStripeMock({});

		const id = await getOrCreateStripeCustomer(
			'00000000-0000-0000-0000-000000000001',
			stripe,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			supabase as any
		);

		expect(id).toBe('cus_existing');
		expect(create).not.toHaveBeenCalled();
		expect(supabase.rpc).not.toHaveBeenCalled();
	});

	it('creates a Stripe Customer with no PII fields when none exists', async () => {
		const supabase = makeSupabaseMock({ existingCustomerId: null, upsertReturns: 'cus_new' });
		const { stripe, create } = makeStripeMock({ createReturnsId: 'cus_new' });

		const id = await getOrCreateStripeCustomer(
			'00000000-0000-0000-0000-000000000002',
			stripe,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			supabase as any
		);

		expect(id).toBe('cus_new');
		expect(create).toHaveBeenCalledTimes(1);

		const [params] = create.mock.calls[0] as [Record<string, unknown>, ...unknown[]];

		// Opacity contract: no PII fields anywhere in the Customer create call.
		expect(params).not.toHaveProperty('email');
		expect(params).not.toHaveProperty('name');
		expect(params).not.toHaveProperty('phone');
		expect(params).not.toHaveProperty('address');
		expect(params).not.toHaveProperty('shipping');

		// Only the opaque dyad_user_id correlation key.
		expect(params.metadata).toEqual({ dyad_user_id: '00000000-0000-0000-0000-000000000002' });
	});

	it('passes idempotencyKey based on the userId so retries do not orphan customers', async () => {
		const supabase = makeSupabaseMock({ existingCustomerId: null, upsertReturns: 'cus_new' });
		const { stripe, create } = makeStripeMock({ createReturnsId: 'cus_new' });

		const userId = '00000000-0000-0000-0000-000000000003';
		await getOrCreateStripeCustomer(
			userId,
			stripe,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			supabase as any
		);

		const [, options] = create.mock.calls[0] as [unknown, { idempotencyKey?: string }];
		expect(options.idempotencyKey).toBe(`customer:${userId}`);
	});

	it('upserts via the SECURITY DEFINER RPC after Stripe-side create succeeds', async () => {
		const supabase = makeSupabaseMock({ existingCustomerId: null, upsertReturns: 'cus_new' });
		const { stripe } = makeStripeMock({ createReturnsId: 'cus_new' });

		await getOrCreateStripeCustomer(
			'00000000-0000-0000-0000-000000000004',
			stripe,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			supabase as any
		);

		expect(supabase.rpc).toHaveBeenCalledTimes(1);
		expect(supabase.rpc).toHaveBeenCalledWith('upsert_profile_payment_customer', {
			p_user_id: '00000000-0000-0000-0000-000000000004',
			p_stripe_customer_id: 'cus_new'
		});
	});

	it('throws when the dyad-side upsert errors after Stripe-side create succeeds', async () => {
		const supabase = makeSupabaseMock({
			existingCustomerId: null,
			upsertError: { message: 'connection refused' }
		});
		const { stripe } = makeStripeMock({ createReturnsId: 'cus_new' });

		await expect(
			getOrCreateStripeCustomer(
				'00000000-0000-0000-0000-000000000005',
				stripe,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				supabase as any
			)
		).rejects.toThrowError(/Failed to upsert profile_payments/);
	});
});
