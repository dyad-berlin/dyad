/**
 * Provision the membership Products & Prices in Stripe via the API — so the
 * five fixed tiers live as code, not as manual dashboard clicks.
 *
 * Reads STRIPE_SECRET_PROVISION_KEY — a key with Products + Prices write, kept
 * separate from the app's runtime STRIPE_SECRET_KEY. Set it in .env.local (loaded
 * here via dotenv) or pass it inline for one run.
 *
 * Usage:
 *   npx tsx scripts/stripe-provision-membership.ts --dry-run   # preview only, no Stripe calls / no key needed
 *   npm run stripe:provision                                    # reads STRIPE_SECRET_PROVISION_KEY from .env.local
 *   STRIPE_SECRET_PROVISION_KEY=rk_live_... npm run stripe:provision -- --live
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

import dotenv from 'dotenv';
import Stripe from 'stripe';

// Local secrets live in .env.local; plain `dotenv/config` only reads `.env`.
// Load .env.local first, then .env as fallback (dotenv never overrides a set var).
dotenv.config({ path: '.env.local' });
dotenv.config();

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
	const existing = await stripe.prices.list({ lookup_keys: [tier.envVar], active: true, limit: 1 });
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

function euro(cents: number): string {
	return `€${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
}

async function main() {
	if (process.argv.includes('--dry-run')) {
		console.log('DRY RUN — no Stripe calls, no key needed. Would create these fixed-price Products/Prices:\n');
		for (const t of TIERS) {
			const cadence = t.interval ? `recurring · ${t.interval}` : 'one-time';
			console.log(`  ${t.productName}`);
			console.log(`    ${euro(t.amountCents)} ${CURRENCY.toUpperCase()}  ·  ${cadence}  ·  lookup_key & env: ${t.envVar}`);
		}
		console.log('\nEach Price is a FIXED unit_amount (no custom_unit_amount). Idempotent by lookup_key.');
		console.log('To create for real: set STRIPE_SECRET_PROVISION_KEY, then npm run stripe:provision');
		return;
	}

	const key = process.env.STRIPE_SECRET_PROVISION_KEY;
	if (!key) {
		console.error('STRIPE_SECRET_PROVISION_KEY is not set (a Stripe key with Products + Prices write).\nSet it in .env.local, or pass inline:\n  STRIPE_SECRET_PROVISION_KEY=rk_test_... npm run stripe:provision');
		process.exit(1);
	}
	// Live keys are sk_live_ (full) or rk_live_ (restricted) — catch both.
	const isLive = /_live_/.test(key);
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
