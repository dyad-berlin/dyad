import { describe, it, expect, vi } from 'vitest';
import { recordPayment } from './payments-audit.js';

function makeSupabaseMock(opts: { insertError?: { code?: string; message: string } | null }) {
	const insert = vi.fn().mockResolvedValue({
		data: opts.insertError ? null : [{}],
		error: opts.insertError ?? null
	});
	return {
		from: vi.fn().mockReturnValue({ insert }),
		insert
	};
}

describe('recordPayment', () => {
	it('inserts a payment row with the four fields', async () => {
		const supabase = makeSupabaseMock({});
		await recordPayment(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			supabase as any,
			{
				stripePaymentIntentId: 'pi_test_123',
				userId: '00000000-0000-0000-0000-000000000001',
				kind: 'founding_circle',
				amountCents: 39900
			}
		);

		expect(supabase.from).toHaveBeenCalledWith('payments');
		const inserted = (supabase.insert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
		expect(inserted).toEqual({
			stripe_payment_intent_id: 'pi_test_123',
			user_id: '00000000-0000-0000-0000-000000000001',
			kind: 'founding_circle',
			amount_cents: 39900
		});
	});

	it('is idempotent on stripe_payment_intent_id (unique-violation = no-op)', async () => {
		const supabase = makeSupabaseMock({
			insertError: { code: '23505', message: 'duplicate key value violates unique constraint' }
		});

		await expect(
			recordPayment(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				supabase as any,
				{
					stripePaymentIntentId: 'pi_test_123',
					userId: 'u1',
					kind: 'trinkgeld',
					amountCents: 500
				}
			)
		).resolves.toBeUndefined();
	});

	it('throws on non-unique-violation database errors', async () => {
		const supabase = makeSupabaseMock({
			insertError: { code: '08006', message: 'connection failure' }
		});

		await expect(
			recordPayment(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				supabase as any,
				{
					stripePaymentIntentId: 'pi_test_456',
					userId: null,
					kind: 'membership',
					amountCents: 15000
				}
			)
		).rejects.toThrowError(/Failed to record payment/);
	});

	it('rejects amountCents = 0 to prevent obscured zero-amount audit holes', async () => {
		const supabase = makeSupabaseMock({});
		await expect(
			recordPayment(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				supabase as any,
				{
					stripePaymentIntentId: 'pi_x',
					userId: null,
					kind: 'membership',
					amountCents: 0
				}
			)
		).rejects.toThrowError(/positive/);
	});

	it('rejects negative amountCents', async () => {
		const supabase = makeSupabaseMock({});
		await expect(
			recordPayment(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				supabase as any,
				{
					stripePaymentIntentId: 'pi_x',
					userId: null,
					kind: 'membership',
					amountCents: -100
				}
			)
		).rejects.toThrowError(/positive/);
	});

	it('accepts user_id null (e.g. when identity has been deleted)', async () => {
		const supabase = makeSupabaseMock({});
		await expect(
			recordPayment(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				supabase as any,
				{
					stripePaymentIntentId: 'pi_orphan',
					userId: null,
					kind: 'venue_patron_contribution',
					amountCents: 30000
				}
			)
		).resolves.toBeUndefined();
	});
});
