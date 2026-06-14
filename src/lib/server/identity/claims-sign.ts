/**
 * Pure JWT signer for substrate-agnostic identity claims. No `$env` import, so
 * it is unit-testable directly. The env-reading wrapper is in `claims.ts`.
 *
 * The minted token carries the request's identity and active scopes as custom
 * claims that dyad's RLS reads via `current_setting('request.jwt.claims')`:
 *   role             'authenticated'  (selects the authenticated Postgres role)
 *   app_identity_id  identities.id to authorize as (omitted for read-only)
 *   app_scopes       JSON array of active scope slugs
 * Signed with the Supabase project's JWT secret (HS256) so PostgREST accepts it.
 */

import { SignJWT } from 'jose';

export interface IdentityClaims {
	/** identities.id to authorize as. Omit for a read-only, scope-only token. */
	identityId?: string;
	/** Active scope slugs for this request. */
	scopes: string[];
	/** Token lifetime in seconds (default 300). */
	ttlSeconds?: number;
}

export async function signIdentityJwt(secret: string, claims: IdentityClaims): Promise<string> {
	if (!secret) throw new Error('JWT secret is required to mint an identity claim');
	const payload: Record<string, unknown> = {
		role: 'authenticated',
		app_scopes: claims.scopes
	};
	if (claims.identityId) payload.app_identity_id = claims.identityId;

	return new SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setIssuedAt()
		.setExpirationTime(`${claims.ttlSeconds ?? 300}s`)
		.setAudience('authenticated')
		.setSubject(claims.identityId ?? 'anon')
		.sign(new TextEncoder().encode(secret));
}
