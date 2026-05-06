import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { glob } from 'glob';

/**
 * Payment opacity lint test.
 *
 * The structural defense for plan 003 R11 / R13: scan every payment-bearing
 * file for forbidden field names and reject any introduction of contact-
 * bearing data into dyad's payment surface.
 *
 * This is the load-bearing automated check. The "lint" framing in the plan
 * is loose — this is a vitest-driven scan run as part of the unit test
 * suite, not an ESLint rule. It runs in pre-push hooks and CI.
 *
 * The forbidden-token list is intentionally broad. False positives in this
 * test should be resolved by renaming the offending field or moving it out
 * of the payment-bearing surface, NOT by extending the allow list — the
 * point is that payment-related code never names contact-bearing data,
 * regardless of intent.
 *
 * Untyped JSON columns in payment-bearing migrations (`metadata JSONB`,
 * `notes TEXT`, `extra JSONB`) are the most likely drift vector and are
 * also rejected — the lint must close that escape hatch explicitly.
 */

const PAYMENT_FILE_GLOBS = [
	// Migration files with payment-related names
	'supabase/migrations/*payment*.sql',
	'supabase/migrations/*tip*.sql',
	'supabase/migrations/*subscription*.sql',
	'supabase/migrations/*founding*.sql',
	'supabase/migrations/*venue_patron*.sql',
	'supabase/migrations/*meeting_tip*.sql',
	'supabase/migrations/*processed_stripe*.sql',
	'supabase/migrations/*profile_payments*.sql',
	// Server-side payment code
	'src/lib/server/stripe*.ts',
	'src/lib/server/payments-audit*.ts',
	// Per-feature service files (some don't exist yet — globs return [])
	'src/lib/services/founding-circle.ts',
	'src/lib/services/membership.ts',
	'src/lib/services/trinkgeld.ts',
	'src/lib/services/venue-partnership.ts',
	// Per-feature API endpoints
	'src/routes/api/founding-circle/**/*.ts',
	'src/routes/api/membership/**/*.ts',
	'src/routes/api/trinkgeld/**/*.ts',
	'src/routes/api/venue-patron/**/*.ts',
	'src/routes/api/stripe/**/*.ts'
];

// Forbidden tokens, as case-sensitive substring matches. Both casings are
// covered because Postgres column names are typically snake_case while
// TypeScript code uses camelCase.
const FORBIDDEN_TOKENS = [
	// Snake case
	'email',
	'phone',
	'card_',
	'cvc',
	'iban',
	'holder_name',
	'billing_',
	'shipping_',
	'payer_',
	'declined_at',
	'decline_',
	// Camel case
	'payerEmail',
	'payerName',
	'holderName',
	'billingAddress',
	'shippingAddress',
	'declinedAt',
	'cardBrand',
	'lastFour',
	// PII-shaped attributes that often slip in
	'firstName',
	'lastName',
	'fullName'
];

// Untyped JSON / freeform columns that could hide contact-bearing data.
// Rejected in payment-bearing migration files only.
const FORBIDDEN_MIGRATION_FREEFORM_PATTERNS = [
	/\bmetadata\s+JSONB\b/i,
	/\bnotes\s+TEXT\b/i,
	/\bextra\s+JSONB\b/i,
	/\bdetails\s+JSONB\b/i,
	/\binfo\s+JSONB\b/i
];

// Some forbidden tokens have legitimate uses in test code, comments, or
// documentation strings about what we DO NOT do. Allow specific lines that
// are about negation. The matcher checks whether the line is part of a
// negation clause; if so, the token is permitted.
const NEGATION_PATTERNS = [
	/\bnot?\s+have\b/i, // "not have email"
	/\bno\s+email\b/i,
	/\bno\s+pii\b/i,
	/\bnever\s+stores?\b/i,
	/\bnever\s+writes?\b/i,
	/\bnever\s+logs?\b/i,
	/\bMUST\s+NOT\b/i,
	/\bdo\s+NOT\b/i,
	/\bno\s+contact\b/i,
	/\bopaque\s+tokens?\b/i,
	/\bopacity\s+contract\b/i,
	/\bforbidden\b/i,
	// .not.toHaveProperty('email') in tests
	/\bnot\.toHaveProperty\b/,
	// Documentation comments saying "this does NOT contain X"
	/\b(no|without|sans)\s+(email|name|phone|address)\b/i
];

function isLineExempt(line: string): boolean {
	return NEGATION_PATTERNS.some((p) => p.test(line));
}

function findOffenders(filePath: string, content: string): string[] {
	const offenders: string[] = [];
	const lines = content.split('\n');

	const isMigration = filePath.endsWith('.sql');

	lines.forEach((line, idx) => {
		if (isLineExempt(line)) return;

		// Token check (substring; case-sensitive).
		for (const token of FORBIDDEN_TOKENS) {
			if (line.includes(token)) {
				offenders.push(`${filePath}:${idx + 1}: forbidden token "${token}" in: ${line.trim()}`);
			}
		}

		// Migration-only freeform-JSON check.
		if (isMigration) {
			for (const pattern of FORBIDDEN_MIGRATION_FREEFORM_PATTERNS) {
				if (pattern.test(line)) {
					offenders.push(
						`${filePath}:${idx + 1}: untyped freeform column not allowed in payment-bearing migrations: ${line.trim()}`
					);
				}
			}
		}
	});

	return offenders;
}

describe('payment opacity lint', () => {
	it('rejects forbidden tokens in payment-bearing files', async () => {
		const repoRoot = resolve(__dirname, '..', '..');
		const allOffenders: string[] = [];

		for (const pattern of PAYMENT_FILE_GLOBS) {
			const files = await glob(pattern, { cwd: repoRoot, absolute: true });
			for (const filePath of files) {
				const content = readFileSync(filePath, 'utf-8');
				const relPath = relative(repoRoot, filePath);
				allOffenders.push(...findOffenders(relPath, content));
			}
		}

		if (allOffenders.length > 0) {
			throw new Error(
				`Payment opacity contract violated. The following payment-bearing files contain forbidden tokens or untyped freeform columns. Either rename the offending field or move it out of the payment-bearing surface — do NOT extend the allow list.\n\n${allOffenders.join('\n')}`
			);
		}

		expect(allOffenders.length).toBe(0);
	});

	it('catches forbidden tokens in synthetic test fixtures (regression guard for the lint itself)', () => {
		const synthetic = `
CREATE TABLE payments_bad (
  id UUID PRIMARY KEY,
  email TEXT,
  card_brand TEXT
);
`;
		const offenders = findOffenders('supabase/migrations/synthetic_payment_bad.sql', synthetic);
		expect(offenders.length).toBeGreaterThan(0);
		expect(offenders.some((o) => o.includes('email'))).toBe(true);
		expect(offenders.some((o) => o.includes('card_'))).toBe(true);
	});

	it('catches forbidden untyped JSON columns in synthetic migration fixtures', () => {
		const synthetic = `
CREATE TABLE meeting_tips_bad (
  id UUID PRIMARY KEY,
  metadata JSONB
);
`;
		const offenders = findOffenders('supabase/migrations/synthetic_tip_bad.sql', synthetic);
		expect(offenders.some((o) => o.includes('untyped freeform'))).toBe(true);
	});

	it('does NOT flag forbidden tokens that appear in negation clauses', () => {
		const synthetic = `
-- This table MUST NOT contain email or phone fields.
CREATE TABLE payments_clean (
  stripe_payment_intent_id TEXT PRIMARY KEY
);
`;
		const offenders = findOffenders('supabase/migrations/clean.sql', synthetic);
		expect(offenders.length).toBe(0);
	});
});
