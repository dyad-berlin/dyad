/**
 * Pure signer/verifier for provider-minted app-session tokens. No `$env`
 * import, so it is unit-testable directly (pattern: claims-sign.ts); the
 * env-reading provider is in `atproto.ts`.
 *
 * Why a signed token instead of re-verifying a stored credential cookie:
 * some substrates leave dyad nothing to re-verify — the ATProto OAuth session is
 * revoked at establishment because sign-in needs no standing tokens. For those,
 * the app session is dyad's own artifact: a short-lived HS256 token carrying
 * only the opaque member id and the granted scope. It lapses on its own `exp`;
 * nothing in it can be replayed against the substrate.
 *
 * `kind` namespaces tokens per provider so one provider's token can never be
 * presented as another's, even if a deployment reuses a secret.
 */

import { SignJWT, jwtVerify } from 'jose';

/** What a provider app-session token attests. Never a substrate attribute. */
export interface SessionTokenClaims {
	/** Opaque member id (substrate-shaped derivation, PII-free). */
	memberId: string;
	/** dyad scope slug this session grants. */
	scope: string;
	/** Seconds (UNIX epoch). The session lapses at this instant. */
	expiresAt: number;
	/**
	 * Optional public label carried alongside the id (e.g. the atproto handle
	 * on a pending-identity token, so a join request can show it). Public
	 * identifiers only; never a contact attribute.
	 */
	hint?: string;
}

export async function signSessionToken(
	kind: string,
	secret: string,
	claims: SessionTokenClaims
): Promise<string> {
	if (!secret) throw new Error('a session secret is required to mint a session token');
	return new SignJWT({ kind, scope: claims.scope, ...(claims.hint ? { hint: claims.hint } : {}) })
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setSubject(claims.memberId)
		.setIssuedAt()
		.setExpirationTime(claims.expiresAt)
		.sign(new TextEncoder().encode(secret));
}

/**
 * Verifies a session token and returns its claims, or null for anything not
 * verifiable: bad signature, expired (relative to `nowSeconds`), malformed,
 * or a token of a different kind.
 */
export async function verifySessionToken(
	kind: string,
	secret: string,
	token: string,
	nowSeconds: number
): Promise<SessionTokenClaims | null> {
	if (!secret || !token) return null;
	try {
		const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
			currentDate: new Date(nowSeconds * 1000)
		});
		if (payload.kind !== kind) return null;
		if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
		if (typeof payload.scope !== 'string' || payload.scope.length === 0) return null;
		if (typeof payload.exp !== 'number') return null;
		return {
			memberId: payload.sub,
			scope: payload.scope,
			expiresAt: payload.exp,
			...(typeof payload.hint === 'string' && payload.hint.length > 0
				? { hint: payload.hint }
				: {})
		};
	} catch {
		return null;
	}
}
