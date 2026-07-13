/**
 * Pure signer/verifier for the EUDI app-session token. No `$env` import, so it
 * is unit-testable directly (pattern: claims-sign.ts); the env-reading provider
 * is in `eudi.ts`.
 *
 * Why a signed token instead of re-verifying a stored credential (the ember
 * cookie pattern): the EUDI Upactor is one-shot by design — the presentation
 * is redeemed exactly once and gives dyad no credential it could re-verify on
 * later requests. So the app session is dyad's own artifact: a short-lived
 * HS256 token minted at redemption, carrying only the opaque member id and the
 * granted scope. It lapses on its own `exp`; nothing in it can be replayed
 * into a new presentation.
 */

import { SignJWT, jwtVerify } from 'jose';

/** What an EUDI app-session token attests. No PID attribute ever appears here. */
export interface EudiSessionTokenClaims {
	/** Opaque, one-shot Upactor id from the redeemed presentation. */
	memberId: string;
	/** dyad scope slug this session grants. */
	scope: string;
	/** Seconds (UNIX epoch). The session lapses at this instant. */
	expiresAt: number;
}

const TOKEN_KIND = 'dyad-eudi-session';

export async function signEudiSessionToken(
	secret: string,
	claims: EudiSessionTokenClaims
): Promise<string> {
	if (!secret) throw new Error('a session secret is required to mint an EUDI session token');
	return new SignJWT({ kind: TOKEN_KIND, scope: claims.scope })
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setSubject(claims.memberId)
		.setIssuedAt()
		.setExpirationTime(claims.expiresAt)
		.sign(new TextEncoder().encode(secret));
}

/**
 * Verifies a session token and returns its claims, or null for anything not
 * verifiable: bad signature, expired (relative to `nowSeconds`), malformed,
 * or not an EUDI session token at all.
 */
export async function verifyEudiSessionToken(
	secret: string,
	token: string,
	nowSeconds: number
): Promise<EudiSessionTokenClaims | null> {
	if (!secret || !token) return null;
	try {
		const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
			currentDate: new Date(nowSeconds * 1000)
		});
		if (payload.kind !== TOKEN_KIND) return null;
		if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
		if (typeof payload.scope !== 'string' || payload.scope.length === 0) return null;
		if (typeof payload.exp !== 'number') return null;
		return { memberId: payload.sub, scope: payload.scope, expiresAt: payload.exp };
	} catch {
		return null;
	}
}
