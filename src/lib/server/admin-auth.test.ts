import { describe, it, expect, vi } from 'vitest';
import { resolveAdminOperator, type JwtVerifier } from './admin-auth.js';

const PROD_FLAGS = { devMode: false, bypassEnabled: false } as const;
const DEV_BYPASS_FLAGS = { devMode: true, bypassEnabled: true } as const;
const DEV_NO_BYPASS_FLAGS = { devMode: true, bypassEnabled: false } as const;
const PROD_BYPASS_SET_FLAGS = { devMode: false, bypassEnabled: true } as const;

function makeRequest(headers: Record<string, string> = {}): Request {
	const h = new Headers();
	for (const [k, v] of Object.entries(headers)) h.set(k, v);
	return new Request('http://localhost/admin/waitlist', { headers: h });
}

const goodJwtVerifier: JwtVerifier = async () => ({ email: 'jwt-user@example.com' });
const failingJwtVerifier: JwtVerifier = async () => null;

describe('resolveAdminOperator', () => {
	it('returns the operator when Cloudflare Access set the email header', async () => {
		const op = await resolveAdminOperator(
			makeRequest({ 'cf-access-authenticated-user-email': 'theodore@example.com' }),
			PROD_FLAGS
		);
		expect(op).toEqual({ email: 'theodore@example.com' });
	});

	it('returns null in production when no Cloudflare header or JWT', async () => {
		expect(await resolveAdminOperator(makeRequest(), PROD_FLAGS)).toBeNull();
	});

	it('returns null when the Cloudflare header is empty string and no JWT', async () => {
		expect(
			await resolveAdminOperator(
				makeRequest({ 'cf-access-authenticated-user-email': '' }),
				PROD_FLAGS
			)
		).toBeNull();
	});

	it('reads the header case-insensitively', async () => {
		const op = await resolveAdminOperator(
			makeRequest({ 'Cf-Access-Authenticated-User-Email': 'a@b.c' }),
			PROD_FLAGS
		);
		expect(op).toEqual({ email: 'a@b.c' });
	});

	it('falls back to JWT verification when the email header is missing', async () => {
		const op = await resolveAdminOperator(
			makeRequest({ 'cf-access-jwt-assertion': 'signed.jwt.value' }),
			{ ...PROD_FLAGS, verifyJwt: goodJwtVerifier }
		);
		expect(op).toEqual({ email: 'jwt-user@example.com' });
	});

	it('returns null when JWT verification fails', async () => {
		const op = await resolveAdminOperator(
			makeRequest({ 'cf-access-jwt-assertion': 'tampered.jwt.value' }),
			{ ...PROD_FLAGS, verifyJwt: failingJwtVerifier }
		);
		expect(op).toBeNull();
	});

	it('passes the raw JWT string to the verifier', async () => {
		const verifier = vi.fn(goodJwtVerifier);
		await resolveAdminOperator(
			makeRequest({ 'cf-access-jwt-assertion': 'abc.def.ghi' }),
			{ ...PROD_FLAGS, verifyJwt: verifier }
		);
		expect(verifier).toHaveBeenCalledWith('abc.def.ghi');
	});

	it('does not call the JWT verifier when the email header is already present', async () => {
		const verifier = vi.fn(goodJwtVerifier);
		const op = await resolveAdminOperator(
			makeRequest({
				'cf-access-authenticated-user-email': 'real@example.com',
				'cf-access-jwt-assertion': 'abc.def.ghi'
			}),
			{ ...PROD_FLAGS, verifyJwt: verifier }
		);
		expect(op).toEqual({ email: 'real@example.com' });
		expect(verifier).not.toHaveBeenCalled();
	});

	it('dev bypass returns synthetic operator only when both devMode AND bypassEnabled', async () => {
		expect(await resolveAdminOperator(makeRequest(), DEV_BYPASS_FLAGS)).toEqual({
			email: 'dev@localhost'
		});
	});

	it('dev bypass is gated off when devMode=false (production with bypass var leaked)', async () => {
		// CRITICAL: even if ADMIN_DEV_BYPASS=1 leaks into a production build,
		// the dev=false gate must keep the bypass disabled.
		expect(await resolveAdminOperator(makeRequest(), PROD_BYPASS_SET_FLAGS)).toBeNull();
	});

	it('dev bypass is gated off when bypassEnabled=false (dev mode but no env opt-in)', async () => {
		expect(await resolveAdminOperator(makeRequest(), DEV_NO_BYPASS_FLAGS)).toBeNull();
	});

	it('Cloudflare header takes precedence over dev bypass', async () => {
		const op = await resolveAdminOperator(
			makeRequest({ 'cf-access-authenticated-user-email': 'real-op@example.com' }),
			DEV_BYPASS_FLAGS
		);
		expect(op).toEqual({ email: 'real-op@example.com' });
	});

	it('JWT verification takes precedence over dev bypass', async () => {
		const op = await resolveAdminOperator(
			makeRequest({ 'cf-access-jwt-assertion': 'abc.def.ghi' }),
			{ ...DEV_BYPASS_FLAGS, verifyJwt: goodJwtVerifier }
		);
		expect(op).toEqual({ email: 'jwt-user@example.com' });
	});
});
