/**
 * Provision the membership Products & Prices in Stripe via the API — so the
 * five fixed tiers live as code, not as manual dashboard clicks.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe-provision-membership.ts
 *   STRIPE_SECRET_KEY=sk_live_... npx tsx scripts/stripe-provision-membership.ts --live
 *
 * Creates one Product per tier (separate Products so Stripe reports subscriber
 * counts per tier) and one FIXED-price Price each, then prints the
 * STRIPE_PRICE_ID_* lines to paste into the Cloudflare Pages env.
 *
 * Idempotent: each Price carries a stable `lookup_key` (= its env var name); a
 * re-run reuses the existing Price/Product instead of duplicating. Create-only —
 * it never edits or deletes. Refuses a live key unless `--live` is passed.
 *
 * Amounts below are the source of truth and MUST match the displayed prices in
 * src/lib/copy.ts (cadenceMonthlyPrice / monthlySolidarityPrice / etc.).
 */

import 'dotenv/config';
import Stripe from 'stripe';

interface Tier {
	key: string; // metadata marker on the Product
	envVar: string; // the Cloudflare env var the checkout endpoint reads
	productName: string;
	amountCents: number; // EUR cents — must match copy.ts
	interval: 'month' | 'year' | null; // null = one-time (lifetime)
}

// Keep in sync with copy.ts and src/routes/api/membership/checkout/+server.ts.
const TIERS: Tier[] = [
	{ key: 'monthly_solidarity', envVar: 'STRIPE_PRICE_ID_MONTHLY_SOLIDARITY', productName: 'dyad Membership — Solidarity (monthly)', amountCents: 700, interval: 'month' },
	{ key: 'monthly_standard', envVar: 'STRIPE_PRICE_ID_MONTHLY_STANDARD', productName: 'dyad Membership — Standard (monthly)', amountCents: 1200, interval: 'month' },
	{ key: 'monthly_supporter', envVar: 'STRIPE_PRICE_ID_MONTHLY_SUPPORTER', productName: 'dyad Membership — Supporter (monthly)', amountCents: 1700, interval: 'month' },
	{ key: 'annual', envVar: 'STRIPE_PRICE_ID_ANNUAL', productName: 'dyad Membership — Yearly', amountCents: 10000, interval: 'year' },
	{ key: 'lifetime', envVar: 'STRIPE_PRICE_ID_LIFETIME', productName: 'dyad Membership — Lifetime', amountCents: 40000, interval: null }
];

const CURRENCY = 'eur';

async function findOrCreateProduct(stripe: Stripe, tier: Tier): Promise<string> {
	const found = await stripe.products.search({
		query: `active:'true' AND metadata['dyad_membership_tier']:'${tier.key}'`,
		limit: 1
	});
	if (found.data[0]) {
		console.log(`  product exists: ${found.data[0].id} (${tier.productName})`);
		return found.data[0].id;
	}
	const product = await stripe.products.create({
		name: tier.productName,
		metadata: { dyad_membership_tier: tier.key }
	});
	console.log(`  product created: ${product.id} (${tier.productName})`);
	return product.id;
}

async function findOrCreatePrice(stripe: Stripe, tier: Tier, productId: string): Promise<string> {
	// lookup_key is unique per account — the idempotency handle for a re-run.
	const existing = await stripe.prices.list({ lookup_key: tier.envVar, active: true, limit: 1 });
	if (existing.data[0]) {
		console.log(`  price exists:   ${existing.data[0].id} [${tier.envVar}]`);
		return existing.data[0].id;
	}
	const price = await stripe.prices.create({
		product: productId,
		currency: CURRENCY,
		unit_amount: tier.amountCents, // FIXED amount (no custom_unit_amount)
		lookup_key: tier.envVar,
		transfer_lookup_key: true,
		...(tier.interval ? { recurring: { interval: tier.interval } } : {})
	});
	console.log(`  price created:  ${price.id} [${tier.envVar}]`);
	return price.id;
}

async function main() {
	const key = process.env.STRIPE_SECRET_KEY;
	if (!key) {
		console.error('STRIPE_SECRET_KEY is not set. Pass a test key first:\n  STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe-provision-membership.ts');
		process.exit(1);
	}
	const isLive = key.startsWith('sk_live_');
	if (isLive && !process.argv.includes('--live')) {
		console.error('Refusing to run against a LIVE key without --live. Provision in test mode first, verify, then re-run with --live.');
		process.exit(1);
	}
	console.log(`Provisioning membership products in Stripe (${isLive ? 'LIVE' : 'TEST'} mode)…\n`);

	const stripe = new Stripe(key);
	const envLines: string[] = [];
	for (const tier of TIERS) {
		console.log(`${tier.key}:`);
		const productId = await findOrCreateProduct(stripe, tier);
		const priceId = await findOrCreatePrice(stripe, tier, productId);
		envLines.push(`${tier.envVar}=${priceId}`);
	}

	console.log('\nDone. Paste these into the Cloudflare Pages environment:\n');
	console.log(envLines.join('\n'));
	console.log('\nNext: create the webhook (subscription + charge.refunded + charge.dispute.created),');
	console.log('enable the Customer Portal + Stripe Tax, then set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET.');
}

main().catch((err) => {
	console.error('Provisioning failed:', err instanceof Error ? err.message : err);
	process.exit(1);
});
