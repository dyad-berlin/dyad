import { describe, it, expect } from 'vitest';
import { jwtVerify } from 'jose';
import { signIdentityJwt } from './claims-sign.js';

const SECRET = 'local-fixture-jwt-key-not-real-min-32-bytes-xx';

describe('signIdentityJwt (generic)', () => {
	it('mints a verifiable JWT carrying identity + scope claims', async () => {
		const jwt = await signIdentityJwt(SECRET, { identityId: 'id-123', scopes: ['some-corner'] });
		const { payload } = await jwtVerify(jwt, new TextEncoder().encode(SECRET));
		expect(payload.role).toBe('authenticated');
		expect(payload.aud).toBe('authenticated');
		expect(payload.app_identity_id).toBe('id-123');
		expect(payload.app_scopes).toEqual(['some-corner']);
		expect(payload.sub).toBe('id-123');
		expect(typeof payload.exp).toBe('number');
	});

	it('omits app_identity_id for a read-only scope token', async () => {
		const jwt = await signIdentityJwt(SECRET, { scopes: ['some-corner'] });
		const { payload } = await jwtVerify(jwt, new TextEncoder().encode(SECRET));
		expect(payload.app_identity_id).toBeUndefined();
		expect(payload.app_scopes).toEqual(['some-corner']);
		expect(payload.sub).toBe('anon');
	});

	it('fails verification under a different secret', async () => {
		const jwt = await signIdentityJwt(SECRET, { scopes: [] });
		await expect(jwtVerify(jwt, new TextEncoder().encode('a-different-secret-key-also-32-bytes!'))).rejects.toThrow();
	});

	it('requires a secret', async () => {
		await expect(signIdentityJwt('', { scopes: [] })).rejects.toThrow(/secret/);
	});
});
