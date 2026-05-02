import { describe, it, expect } from 'vitest';
import { resolveAdminOperator } from './admin-auth.js';

const PROD_FLAGS = { devMode: false, bypassEnabled: false } as const;
const DEV_BYPASS_FLAGS = { devMode: true, bypassEnabled: true } as const;
const DEV_NO_BYPASS_FLAGS = { devMode: true, bypassEnabled: false } as const;
const PROD_BYPASS_SET_FLAGS = { devMode: false, bypassEnabled: true } as const;

function makeRequest(headers: Record<string, string> = {}): Request {
	const h = new Headers();
	for (const [k, v] of Object.entries(headers)) h.set(k, v);
	return new Request('http://localhost/admin/waitlist', { headers: h });
}

describe('resolveAdminOperator', () => {
	it('returns the operator when Cloudflare Access set the email header', () => {
		const op = resolveAdminOperator(
			makeRequest({ 'cf-access-authenticated-user-email': 'theodore@example.com' }),
			PROD_FLAGS
		);
		expect(op).toEqual({ email: 'theodore@example.com' });
	});

	it('returns null in production when no Cloudflare header', () => {
		expect(resolveAdminOperator(makeRequest(), PROD_FLAGS)).toBeNull();
	});

	it('returns null when the Cloudflare header is empty string', () => {
		expect(
			resolveAdminOperator(
				makeRequest({ 'cf-access-authenticated-user-email': '' }),
				PROD_FLAGS
			)
		).toBeNull();
	});

	it('reads the header case-insensitively', () => {
		const op = resolveAdminOperator(
			makeRequest({ 'Cf-Access-Authenticated-User-Email': 'a@b.c' }),
			PROD_FLAGS
		);
		expect(op).toEqual({ email: 'a@b.c' });
	});

	it('dev bypass returns synthetic operator only when both devMode AND bypassEnabled', () => {
		expect(resolveAdminOperator(makeRequest(), DEV_BYPASS_FLAGS)).toEqual({ email: 'dev@localhost' });
	});

	it('dev bypass is gated off when devMode=false (production with bypass var leaked)', () => {
		// CRITICAL: even if ADMIN_DEV_BYPASS=1 leaks into a production build,
		// the dev=false gate must keep the bypass disabled.
		expect(resolveAdminOperator(makeRequest(), PROD_BYPASS_SET_FLAGS)).toBeNull();
	});

	it('dev bypass is gated off when bypassEnabled=false (dev mode but no env opt-in)', () => {
		expect(resolveAdminOperator(makeRequest(), DEV_NO_BYPASS_FLAGS)).toBeNull();
	});

	it('Cloudflare header takes precedence over dev bypass', () => {
		const op = resolveAdminOperator(
			makeRequest({ 'cf-access-authenticated-user-email': 'real-op@example.com' }),
			DEV_BYPASS_FLAGS
		);
		expect(op).toEqual({ email: 'real-op@example.com' });
	});
});
