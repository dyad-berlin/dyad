import { describe, it, expect } from 'vitest';
import { signEudiSessionToken, verifyEudiSessionToken } from './eudi-session.js';
import { splitPemCertificates } from './eudi.js';

const SECRET = 'test-eudi-session-secret-32-bytes-min!!';
const NOW = 1_750_000_000;

describe('EUDI session token (pure)', () => {
	it('round-trips member id, scope, and expiry', async () => {
		const claims = { memberId: 'one-shot-actor-id', scope: 'some-corner', expiresAt: NOW + 3600 };
		const token = await signEudiSessionToken(SECRET, claims);
		const verified = await verifyEudiSessionToken(SECRET, token, NOW);
		expect(verified).toEqual(claims);
	});

	it('returns null once the session has lapsed', async () => {
		const token = await signEudiSessionToken(SECRET, {
			memberId: 'm',
			scope: 's',
			expiresAt: NOW + 60
		});
		expect(await verifyEudiSessionToken(SECRET, token, NOW + 61)).toBeNull();
	});

	it('returns null under a different secret', async () => {
		const token = await signEudiSessionToken(SECRET, { memberId: 'm', scope: 's', expiresAt: NOW + 60 });
		expect(
			await verifyEudiSessionToken('a-different-secret-key-also-32-bytes!', token, NOW)
		).toBeNull();
	});

	it('returns null for a tampered token', async () => {
		const token = await signEudiSessionToken(SECRET, { memberId: 'm', scope: 's', expiresAt: NOW + 60 });
		const [header, payload, sig] = token.split('.');
		const forged = Buffer.from(
			JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), scope: 'wider-scope' })
		).toString('base64url');
		expect(await verifyEudiSessionToken(SECRET, `${header}.${forged}.${sig}`, NOW)).toBeNull();
	});

	it('returns null for garbage and for foreign JWTs', async () => {
		expect(await verifyEudiSessionToken(SECRET, 'not-a-jwt', NOW)).toBeNull();
		expect(await verifyEudiSessionToken(SECRET, '', NOW)).toBeNull();
		// A structurally valid JWT signed with our secret but not an EUDI
		// session token (no kind claim) must not become a session.
		const { SignJWT } = await import('jose');
		const foreign = await new SignJWT({ scope: 's' })
			.setProtectedHeader({ alg: 'HS256' })
			.setSubject('m')
			.setExpirationTime(NOW + 60)
			.sign(new TextEncoder().encode(SECRET));
		expect(await verifyEudiSessionToken(SECRET, foreign, NOW)).toBeNull();
	});

	it('requires a secret to sign', async () => {
		await expect(
			signEudiSessionToken('', { memberId: 'm', scope: 's', expiresAt: NOW + 60 })
		).rejects.toThrow(/secret/);
	});
});

describe('splitPemCertificates', () => {
	const cert = (body: string) =>
		`-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`;

	it('splits a bundle into individual certificates', () => {
		const bundle = `${cert('AAAA')}\n${cert('BBBB')}\n`;
		expect(splitPemCertificates(bundle)).toEqual([cert('AAAA'), cert('BBBB')]);
	});

	it('ignores surrounding commentary', () => {
		const bundle = `# sandbox PID issuer root\n${cert('AAAA')}\ntrailing notes\n`;
		expect(splitPemCertificates(bundle)).toEqual([cert('AAAA')]);
	});

	it('returns empty for a bundle with no certificates', () => {
		expect(splitPemCertificates('not a pem')).toEqual([]);
	});
});
