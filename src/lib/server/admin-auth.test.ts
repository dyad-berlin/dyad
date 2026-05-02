import { describe, it, expect, vi } from 'vitest';
import { getAuthorizedAdminOperator } from './admin-auth.js';

// Note: we don't mock $app/environment.dev here because vitest runs in
// "non-dev" mode by default — the dev fallback is naturally inactive. To
// exercise the dev-bypass path explicitly, see the conditional test below.

function makeRequest(headers: Record<string, string> = {}): Request {
	const h = new Headers();
	for (const [k, v] of Object.entries(headers)) h.set(k, v);
	return new Request('http://localhost/admin/waitlist', { headers: h });
}

describe('getAuthorizedAdminOperator', () => {
	it('returns the operator when Cloudflare Access set the email header', () => {
		const op = getAuthorizedAdminOperator(
			makeRequest({ 'cf-access-authenticated-user-email': 'theodore@example.com' })
		);
		expect(op).toEqual({ email: 'theodore@example.com' });
	});

	it('returns null when the Cloudflare Access header is missing', () => {
		const op = getAuthorizedAdminOperator(makeRequest());
		expect(op).toBeNull();
	});

	it('returns null when the Cloudflare Access header is empty string', () => {
		const op = getAuthorizedAdminOperator(
			makeRequest({ 'cf-access-authenticated-user-email': '' })
		);
		expect(op).toBeNull();
	});

	it('reads the header case-insensitively (HTTP header convention)', () => {
		const op = getAuthorizedAdminOperator(
			makeRequest({ 'Cf-Access-Authenticated-User-Email': 'a@b.c' })
		);
		expect(op).toEqual({ email: 'a@b.c' });
	});

	it('the dev bypass is not active in test env (dev=false in vitest)', () => {
		// Defensive: confirms the dev fallback isn't accidentally letting requests
		// through during normal test runs.
		vi.stubEnv('ADMIN_DEV_BYPASS', '1');
		const op = getAuthorizedAdminOperator(makeRequest());
		expect(op).toBeNull();
		vi.unstubAllEnvs();
	});
});
