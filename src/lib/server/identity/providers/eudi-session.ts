/**
 * EUDI app-session token: the generic provider session token (see
 * `session-token.ts` for the design rationale) under the EUDI kind. Kept as a
 * named module so `eudi.ts` and its tests read substrate-first.
 */

import {
	signSessionToken,
	verifySessionToken,
	type SessionTokenClaims
} from './session-token.js';

/** What an EUDI app-session token attests. No PID attribute ever appears here. */
export type EudiSessionTokenClaims = SessionTokenClaims;

const TOKEN_KIND = 'dyad-eudi-session';

export function signEudiSessionToken(
	secret: string,
	claims: EudiSessionTokenClaims
): Promise<string> {
	return signSessionToken(TOKEN_KIND, secret, claims);
}

export function verifyEudiSessionToken(
	secret: string,
	token: string,
	nowSeconds: number
): Promise<EudiSessionTokenClaims | null> {
	return verifySessionToken(TOKEN_KIND, secret, token, nowSeconds);
}
