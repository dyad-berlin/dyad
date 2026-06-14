/**
 * The ember substrate edge. This is the ONLY file in dyad that imports
 * `@prefig/upact-ember` or knows ember's credential shape. It is registered
 * once in `../registry.ts`; dyad core sees only the generic `IdentityProvider`.
 *
 * ember's credential collection is challenge-nonce then presence-proof, with
 * the credential carried in a cookie for cheap per-request re-verification.
 * That shape is ember-specific and lives here; what the provider returns
 * (a `ScopeSession`) is generic.
 */

import type { Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createEmberAdapter, createEmberVerifierClient } from '@prefig/upact-ember';
import { b64uDecode, b64uEncode, parseProof } from '@prefig/ember';
import type { EstablishResult, IdentityProvider, ScopeSession } from '../types.js';

const CRED_COOKIE = 'ember_cred';
const NONCE_COOKIE = 'ember_nonce';
const NONCE_TTL_S = 120;
const CRED_COOKIE_CAP_S = 30 * 24 * 60 * 60;

interface EmberConfig {
	trustedGenesis: Uint8Array;
	scope: string;
	/**
	 * This deployment's audience identifier (its origin). When set, a presence
	 * proof is accepted only if it was addressed to this audience, so a proof
	 * captured by another relying party cannot be relayed here. Unset leaves
	 * verification open (the in-person QR case, where co-presence is the bind).
	 */
	audience?: string;
}

function readConfig(): EmberConfig | null {
	const genesis = env.EMBER_SCOPE_GENESIS;
	const scope = env.EMBER_SCOPE_SLUG;
	if (!genesis || !scope) return null;
	try {
		return { trustedGenesis: b64uDecode(genesis), scope, audience: env.EMBER_AUD || undefined };
	} catch {
		return null;
	}
}

function expirySeconds(expires_at: Date | undefined): number {
	return expires_at ? Math.floor(expires_at.getTime() / 1000) : 0;
}

/** Construct the ember provider, or null if this deployment has not configured it. */
export function emberProvider(): IdentityProvider | null {
	const config = readConfig();
	if (!config) return null;

	// Each call gets a fresh adapter so the active-membership closure does not
	// leak across requests.
	const newPort = () =>
		createEmberAdapter(
			createEmberVerifierClient({ trustedGenesis: config.trustedGenesis, audience: config.audience })
		);

	return {
		id: 'ember',
		scope: config.scope,

		async challenge(cookies: Cookies): Promise<Record<string, unknown>> {
			const nonce = crypto.getRandomValues(new Uint8Array(8));
			const nonceB64 = b64uEncode(nonce);
			cookies.set(NONCE_COOKIE, nonceB64, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: NONCE_TTL_S });
			// The keyring echoes `aud` and `iat` into the proof it builds, so the
			// proof is bound to this verifier and to a freshness window.
			const challenge: Record<string, unknown> = { nonce: nonceB64, iat: Math.floor(Date.now() / 1000) };
			if (config.audience) challenge.aud = config.audience;
			return challenge;
		},

		async establish(cookies: Cookies, evidence: unknown): Promise<EstablishResult> {
			const nonceB64 = cookies.get(NONCE_COOKIE);
			if (!nonceB64) return { ok: false, status: 400, code: 'no_challenge', message: 'request a challenge first' };
			const proofB64 = (evidence as { proof?: unknown })?.proof;
			if (typeof proofB64 !== 'string') return { ok: false, status: 400, code: 'credential_invalid', message: 'missing proof' };

			let proof: Uint8Array;
			let nonce: Uint8Array;
			try {
				proof = b64uDecode(proofB64);
				nonce = b64uDecode(nonceB64);
			} catch {
				return { ok: false, status: 400, code: 'credential_invalid', message: 'malformed proof or nonce' };
			}

			const port = newPort();
			const authed = await port.authenticate({ kind: 'presence', proof, nonce });
			cookies.delete(NONCE_COOKIE, { path: '/' });
			if ('code' in authed) return { ok: false, status: 403, code: authed.code, message: authed.message };

			const actor = await port.currentUpactor(new Request('http://internal'));
			if (!actor) return { ok: false, status: 403, code: 'identity_unavailable', message: 'membership lapsed during establishment' };

			let credBytes: Uint8Array;
			try {
				credBytes = parseProof(proof).credBytes;
			} catch {
				return { ok: false, status: 400, code: 'credential_invalid', message: 'proof carried no credential' };
			}

			const expiresAt = expirySeconds(actor.lifecycle?.expires_at);
			const remaining = expiresAt - Math.floor(Date.now() / 1000);
			if (remaining <= 0) return { ok: false, status: 403, code: 'credential_rejected', message: 'credential already expired' };

			cookies.set(CRED_COOKIE, b64uEncode(credBytes), {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: Math.min(remaining, CRED_COOKIE_CAP_S)
			});

			return {
				ok: true,
				session: {
					provider: 'ember',
					substrate: 'ember',
					scope: config.scope,
					memberId: actor.id,
					expiresAt,
					...(actor.display_hint !== undefined ? { displayHint: actor.display_hint } : {})
				}
			};
		},

		async resolveSession(cookies: Cookies): Promise<ScopeSession | null> {
			const credB64 = cookies.get(CRED_COOKIE);
			if (!credB64) return null;
			let credential: Uint8Array;
			try {
				credential = b64uDecode(credB64);
			} catch {
				return null;
			}
			const client = createEmberVerifierClient({ trustedGenesis: config.trustedGenesis });
			const port = createEmberAdapter(client);
			await client.adoptCredential(credential);
			const actor = await port.currentUpactor(new Request('http://internal'));
			if (!actor) {
				cookies.delete(CRED_COOKIE, { path: '/' });
				return null;
			}
			return {
				provider: 'ember',
				substrate: 'ember',
				scope: config.scope,
				memberId: actor.id,
				expiresAt: expirySeconds(actor.lifecycle?.expires_at),
				...(actor.display_hint !== undefined ? { displayHint: actor.display_hint } : {})
			};
		},

		clear(cookies: Cookies): void {
			cookies.delete(CRED_COOKIE, { path: '/' });
		}
	};
}
