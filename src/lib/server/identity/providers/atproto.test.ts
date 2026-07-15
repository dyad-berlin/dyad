import { describe, it, expect, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import { signSessionToken, verifySessionToken } from './session-token.js';

const SECRET = 'test-atproto-session-secret-32-bytes-min';
const SCOPE = 'atmosphere';
const KIND = 'dyad-atproto-session';
const NOW = 1_750_000_000;

// Pin the provider's config so factory behavior is hermetic. The plugin's
// $env/dynamic/private snapshot reflects .env files, not vi.stubEnv, so a mock
// is the only way to control it deterministically across local and CI.
vi.mock('$env/dynamic/private', () => ({
	env: {
		ATPROTO_SCOPE_SLUG: 'atmosphere',
		ATPROTO_BASE_URL: 'http://127.0.0.1:5173',
		ATPROTO_SESSION_SECRET: 'test-atproto-session-secret-32-bytes-min'
	}
}));

/** Minimal Cookies double recording get/set/delete for the verbs the provider uses. */
function fakeCookies(seed: Record<string, string> = {}) {
	const jar = new Map(Object.entries(seed));
	const deleted: string[] = [];
	return {
		deleted,
		get: (name: string) => jar.get(name),
		set: (name: string, value: string) => jar.set(name, value),
		delete: (name: string) => {
			jar.delete(name);
			deleted.push(name);
		}
	} as unknown as Cookies & { deleted: string[] };
}

describe('atproto session token (pure, via session-token)', () => {
	it('round-trips member id, scope, and expiry under the atproto kind', async () => {
		const claims = { memberId: 'did-hash-abc', scope: SCOPE, expiresAt: NOW + 3600 };
		const token = await signSessionToken(KIND, SECRET, claims);
		expect(await verifySessionToken(KIND, SECRET, token, NOW)).toEqual(claims);
	});

	it("rejects a token minted under another provider's kind", async () => {
		const token = await signSessionToken('dyad-other-session', SECRET, {
			memberId: 'x',
			scope: SCOPE,
			expiresAt: NOW + 3600
		});
		expect(await verifySessionToken(KIND, SECRET, token, NOW)).toBeNull();
	});

	it('rejects an expired token', async () => {
		const token = await signSessionToken(KIND, SECRET, {
			memberId: 'x',
			scope: SCOPE,
			expiresAt: NOW - 1
		});
		expect(await verifySessionToken(KIND, SECRET, token, NOW)).toBeNull();
	});
});

describe('atproto provider', () => {
	it('rejects establish with no authorization code before any network call', async () => {
		const { atprotoProvider } = await import('./atproto.js');
		const result = await atprotoProvider()!.establish(fakeCookies(), { state: 'abc' });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.code).toBe('credential_invalid');
	});

	it('resolves a valid session token to a scope session', async () => {
		const token = await signSessionToken(KIND, SECRET, {
			memberId: 'did-hash-abc',
			scope: SCOPE,
			expiresAt: NOW + 3600
		});
		const { atprotoProvider } = await import('./atproto.js');
		const session = await atprotoProvider()!.resolveSession(
			fakeCookies({ atproto_session: token }),
			NOW
		);
		expect(session).toMatchObject({
			provider: 'atproto',
			substrate: 'atproto',
			scope: SCOPE,
			memberId: 'did-hash-abc'
		});
	});

	it('evicts a token whose scope no longer matches the configured scope', async () => {
		const token = await signSessionToken(KIND, SECRET, {
			memberId: 'did-hash-abc',
			scope: 'a-scope-this-deployment-does-not-grant',
			expiresAt: NOW + 3600
		});
		const cookies = fakeCookies({ atproto_session: token });
		const { atprotoProvider } = await import('./atproto.js');
		expect(await atprotoProvider()!.resolveSession(cookies, NOW)).toBeNull();
		expect(cookies.deleted).toContain('atproto_session');
	});

	it('returns null when no session cookie is present', async () => {
		const { atprotoProvider } = await import('./atproto.js');
		expect(await atprotoProvider()!.resolveSession(fakeCookies(), NOW)).toBeNull();
	});

	it('reads a pending identity (with handle hint) from a pending token', async () => {
		const token = await signSessionToken('dyad-atproto-pending', SECRET, {
			memberId: 'did-hash-pending',
			scope: SCOPE,
			expiresAt: NOW + 900,
			hint: 'alice.bsky.social'
		});
		const { readPendingIdentity } = await import('./atproto.js');
		expect(await readPendingIdentity(fakeCookies({ atproto_pending: token }), NOW)).toEqual({
			memberId: 'did-hash-pending',
			scope: SCOPE,
			handle: 'alice.bsky.social'
		});
	});

	it('does not accept a live session token as a pending identity', async () => {
		const sessionToken = await signSessionToken(KIND, SECRET, {
			memberId: 'did-hash-abc',
			scope: SCOPE,
			expiresAt: NOW + 3600
		});
		const { readPendingIdentity } = await import('./atproto.js');
		expect(
			await readPendingIdentity(fakeCookies({ atproto_pending: sessionToken }), NOW)
		).toBeNull();
	});

	it('does not accept a pending token as a live session', async () => {
		const pendingToken = await signSessionToken('dyad-atproto-pending', SECRET, {
			memberId: 'did-hash-pending',
			scope: SCOPE,
			expiresAt: NOW + 900
		});
		const { atprotoProvider } = await import('./atproto.js');
		expect(
			await atprotoProvider()!.resolveSession(fakeCookies({ atproto_session: pendingToken }), NOW)
		).toBeNull();
	});
});
