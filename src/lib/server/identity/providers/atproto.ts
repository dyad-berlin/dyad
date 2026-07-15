/**
 * The dyad-side ATProto provider: a thin wrapper over `@prefig/upact-atproto`.
 *
 * The ATProto SUBSTRATE EDGE now lives in the package: handle->DID resolution,
 * the `@atproto/oauth-client-node` client (client metadata, PAR/PKCE/DPoP, the
 * module singleton spanning authorize->callback), the authorization start
 * (`beginAuthorization`), and the terminal callback exchange (`authenticate`,
 * which reads the DID and revokes the OAuth session). dyad imports those rather
 * than owning them.
 *
 * What stays HERE is the part that was always dyad's, never the substrate's:
 *   - admission (`hasScopeGrant`): authentication is not admission. An ATProto
 *     credential proves control of a DID — anyone on the network has one.
 *     Entering dyad still takes the invite/waitlist route, and only a durable
 *     identity_scopes grant admits.
 *   - the pending-token cookie dance: a rejected-but-verified sign-in leaves a
 *     short-lived proof-of-control token so the person can ask to join.
 *   - dyad's own HS256 ScopeSession cookie: sign-in keeps no ATProto tokens, so
 *     the app session is dyad's own artifact, minted and re-verified here.
 *
 * The seam: `establish()` calls the adapter's `authenticate()` with the callback
 * params, reads the resolved Upactor via `upactorForSession()`, then runs the
 * admission gate and session minting exactly as before. The opaque member id is
 * `Upactor.id` = SHA-256(did)[:32], stable across PDS migration (unchanged from
 * the pre-extraction derivation).
 */

import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import {
	createAtprotoAdapter,
	buildClientMetadata,
	resolveHandleToDid,
	deriveMemberId,
	type AtprotoConfig,
	type AuthError,
	type Session
} from '@prefig/upact-atproto';
import type { OAuthClientMetadataInput } from '@atproto/oauth-client-node';
import type { EstablishResult, IdentityProvider, ScopeSession } from '../types.js';
import { signSessionToken, verifySessionToken } from './session-token.js';
import { hasScopeGrant } from '../identities.js';
import { makeAdminClient } from '$lib/server/supabase-admin.js';

const SESSION_COOKIE = 'atproto_session';
const TOKEN_KIND = 'dyad-atproto-session';

// A rejected-but-verified sign-in leaves this short-lived token so the person
// can ask to join; the waitlist endpoint verifies it instead of trusting a
// caller-supplied handle. Its own kind: it can never pass as a session.
const PENDING_COOKIE = 'atproto_pending';
const PENDING_KIND = 'dyad-atproto-pending';
const PENDING_TTL_S = 15 * 60;

// Ceiling on the app session minted from one sign-in. A week: re-establishing
// is one redirect, so nothing argues for longer.
const SESSION_CAP_S = 7 * 24 * 60 * 60;

interface AtprotoEnvConfig {
	scope: string;
	baseUrl: string;
	sessionSecret: string;
}

/**
 * Reads the deployment's ATProto configuration, or null when the provider is
 * not configured (which unpublishes every atproto surface: the login page,
 * the authorize/callback routes, and the client metadata document).
 *
 *   ATPROTO_SCOPE_SLUG      dyad scope slug a session grants
 *   ATPROTO_BASE_URL        public base URL of this deployment. An
 *                           http://127.0.0.1:<port> value selects the OAuth
 *                           loopback client (dev only — the spec requires a
 *                           loopback IP literal, not `localhost`)
 *   ATPROTO_SESSION_SECRET  HS256 secret for dyad's own session cookie
 */
function readConfig(): AtprotoEnvConfig | null {
	const scope = env.ATPROTO_SCOPE_SLUG;
	const baseUrl = env.ATPROTO_BASE_URL;
	const sessionSecret = env.ATPROTO_SESSION_SECRET;
	if (!scope || !baseUrl || !sessionSecret) return null;
	return { scope, baseUrl: baseUrl.replace(/\/$/, ''), sessionSecret };
}

/**
 * The adapter config derived from the deployment env. dyad's client metadata is
 * byte-identical to the pre-extraction inline provider's: client_name 'dyad',
 * client_uri and redirect_uri under the base URL, scope 'atproto'.
 */
function adapterConfig(config: AtprotoEnvConfig): AtprotoConfig {
	return { baseUrl: config.baseUrl, clientName: 'dyad', clientUri: config.baseUrl };
}

/**
 * The client metadata this deployment presents to authorization servers, or
 * null when the provider is not configured. Served at /oauth/client-metadata.json.
 */
export function getAtprotoClientMetadata(): OAuthClientMetadataInput | null {
	const config = readConfig();
	if (!config) return null;
	return buildClientMetadata(adapterConfig(config));
}

/**
 * Resolves a member-entered handle (or DID) to their authorization server and
 * returns the URL to send the browser to, or null when the provider is not
 * configured. Called by /api/atproto/authorize.
 */
export async function beginAuthorization(handle: string): Promise<URL | null> {
	const config = readConfig();
	if (!config) return null;
	return createAtprotoAdapter(adapterConfig(config)).beginAuthorization(handle);
}

// Substrate-edge helper re-exports: the admin scope-granting route resolves a
// member-entered handle to an opaque member id through the same edge the
// provider uses, so the two derive ids identically.
export { resolveHandleToDid };

/** Opaque member id: SHA-256(did)[:32] (now in @prefig/upact-atproto). */
export async function memberIdFromDid(did: string): Promise<string> {
	return deriveMemberId(did);
}

function toScopeSession(scope: string, memberId: string, expiresAt: number): ScopeSession {
	return { provider: 'atproto', substrate: 'atproto', scope, memberId, expiresAt };
}

/**
 * The verified pending identity from a rejected sign-in, or null. Consumed by
 * the waitlist endpoint: the token proves the visitor controlled the DID
 * minutes ago, so the join request records identity that was demonstrated,
 * not asserted.
 */
export async function readPendingIdentity(
	cookies: Cookies,
	nowSeconds: number
): Promise<{ memberId: string; scope: string; handle: string | null } | null> {
	const config = readConfig();
	if (!config) return null;
	const token = cookies.get(PENDING_COOKIE);
	if (!token) return null;
	const claims = await verifySessionToken(PENDING_KIND, config.sessionSecret, token, nowSeconds);
	if (!claims) return null;
	return { memberId: claims.memberId, scope: claims.scope, handle: claims.hint ?? null };
}

export function clearPendingIdentity(cookies: Cookies): void {
	cookies.delete(PENDING_COOKIE, { path: '/' });
}

/** HTTP status for a port AuthErrorCode, preserving the pre-extraction responses. */
function statusForAuthError(error: AuthError): number {
	switch (error.code) {
		case 'credential_invalid':
			return 400;
		case 'substrate_unavailable':
			return 503;
		case 'rate_limited':
			return 429;
		default:
			// credential_rejected / auth_failed / identity_unavailable: the sign-in
			// was not accepted. The pre-extraction provider answered 403 here.
			return 403;
	}
}

function isAuthError(outcome: Session | AuthError): outcome is AuthError {
	return typeof (outcome as { code?: unknown }).code === 'string';
}

/** Construct the ATProto provider, or null if this deployment has not configured it. */
export function atprotoProvider(): IdentityProvider | null {
	const config = readConfig();
	if (!config) return null;

	return {
		id: 'atproto',
		scope: config.scope,

		// The challenge for this redirect-shaped substrate is where to start:
		// the authorize route, which needs the member's handle as input. No
		// cookie is needed — the exchange is bound server-side by OAuth state.
		async challenge(): Promise<Record<string, unknown>> {
			return { startPath: '/api/atproto/authorize' };
		},

		// The evidence is the authorization server's redirect parameters
		// (code, state, iss), delivered by /api/atproto/callback. The adapter
		// runs the exchange (DID read, OAuth session revoked) and hands back an
		// opaque Session; dyad reads the resolved Upactor and takes it from there.
		async establish(cookies: Cookies, evidence: unknown): Promise<EstablishResult> {
			const adapter = createAtprotoAdapter(adapterConfig(config));

			const params = new URLSearchParams();
			for (const key of ['code', 'state', 'iss', 'error', 'error_description'] as const) {
				const value = (evidence as Record<string, unknown>)?.[key];
				if (typeof value === 'string') params.set(key, value);
			}

			const outcome = await adapter.authenticate({ kind: 'atproto-callback', params });
			if (isAuthError(outcome)) {
				return {
					ok: false,
					status: statusForAuthError(outcome),
					code: outcome.code,
					message: outcome.message
				};
			}

			const upactor = adapter.upactorForSession(outcome);
			if (!upactor) {
				return { ok: false, status: 403, code: 'credential_rejected', message: 'authorization was not accepted' };
			}
			const memberId = upactor.id;
			// The handle the member entered rode along as the (now-validated) OAuth
			// state; it labels a rejected sign-in's join request, nothing more.
			const rawState = params.get('state');
			const enteredHandle = rawState && rawState.length <= 253 ? rawState : null;

			// Authentication is not admission. An ATProto credential proves the
			// person controls a DID — anyone on the network has one. Entering
			// dyad still takes the invite/waitlist route; what that route leaves
			// behind is a durable identity_scopes grant, and only its holder gets
			// a session. No identity row is provisioned here (no roster of
			// visitors who merely tried). What a rejected sign-in DOES leave is a
			// short-lived pending token, so the person can ask to join: the token
			// is the proof-of-control their join request is verified by.
			const admitted = await hasScopeGrant(makeAdminClient(), 'atproto', memberId, config.scope);
			if (!admitted) {
				const pendingExpiry = Math.floor(Date.now() / 1000) + PENDING_TTL_S;
				const pending = await signSessionToken(PENDING_KIND, config.sessionSecret, {
					memberId,
					scope: config.scope,
					expiresAt: pendingExpiry,
					...(enteredHandle ? { hint: enteredHandle } : {})
				});
				cookies.set(PENDING_COOKIE, pending, {
					path: '/',
					httpOnly: true,
					sameSite: 'lax',
					secure: !dev,
					maxAge: PENDING_TTL_S
				});
				return { ok: false, status: 403, code: 'not_admitted', message: 'no dyad membership is linked to this identity' };
			}

			const now = Math.floor(Date.now() / 1000);
			const expiresAt = now + SESSION_CAP_S;
			const token = await signSessionToken(TOKEN_KIND, config.sessionSecret, {
				memberId,
				scope: config.scope,
				expiresAt
			});
			cookies.set(SESSION_COOKIE, token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: !dev,
				maxAge: SESSION_CAP_S
			});

			return { ok: true, session: toScopeSession(config.scope, memberId, expiresAt) };
		},

		// There is no substrate credential to re-verify (the OAuth session was
		// revoked at establishment); re-verification is the signature and expiry
		// of dyad's own session token.
		async resolveSession(cookies: Cookies, nowSeconds: number): Promise<ScopeSession | null> {
			const token = cookies.get(SESSION_COOKIE);
			if (!token) return null;
			const claims = await verifySessionToken(TOKEN_KIND, config.sessionSecret, token, nowSeconds);
			// A token whose scope no longer matches the configured scope grants
			// nothing (the deployment's configuration changed under it).
			if (!claims || claims.scope !== config.scope) {
				cookies.delete(SESSION_COOKIE, { path: '/' });
				return null;
			}
			return toScopeSession(claims.scope, claims.memberId, claims.expiresAt);
		},

		clear(cookies: Cookies): void {
			cookies.delete(SESSION_COOKIE, { path: '/' });
		}
	};
}
