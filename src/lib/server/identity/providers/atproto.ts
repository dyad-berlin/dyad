/**
 * The ATProto substrate edge. This is the ONLY file in dyad that imports
 * `@atproto/oauth-client-node` or knows the ATProto OAuth flow shape. It is
 * registered once in `../registry.ts`; dyad core sees only the generic
 * `IdentityProvider`. Extraction into a `@prefig/upact-atproto` package
 * follows once the shape has settled (adapter-shapes.md already reserves it:
 * Mastodon-adapter camp, per-login instance resolution, Decision 7).
 *
 * ATProto's credential collection is redirect-shaped with a handle input:
 *   1. GET  /login/atproto           -> the member enters their handle.
 *   2. GET  /api/atproto/authorize   -> resolves handle -> DID -> DID document
 *      -> PDS -> authorization server, then redirects the browser there
 *      (PAR + PKCE + DPoP, all inside the client library).
 *   3. The authorization server sends the browser to /api/atproto/callback,
 *      which delegates to `establish()`: the code is exchanged, the DID is
 *      read, and the OAuth session is immediately REVOKED.
 *
 * Sign-in is all Phase 1 needs (research/2026-07-13-atproto-experiment-design.md),
 * so dyad keeps no ATProto tokens at all: the session it mints is its own
 * HS256 cookie carrying an opaque id derived from the DID. Publishing (Phase 2)
 * will ask for the write scope separately, per member, when it exists.
 *
 * The Upactor-shaped derivations follow adapter-shapes.md:
 *   - member id: SHA-256(did)[:32] — stable across PDS migrations, which is the
 *     `continuation` property DIDs add over Mastodon's per-instance actor URLs.
 *   - no display hint: sign-in grants a scope session, not a profile. dyad
 *     learns the DID and nothing else; even the handle is discarded.
 *
 * Deployment shape: the client's state/session stores are closure memory and
 * must span the authorize -> callback exchange, so the client is a module-level
 * singleton. Single-instance node deployments only (dev/sandbox), same stance
 * as the EUDI transaction store; a Workers deployment needs shared stores
 * first. Sessions are deleted at establishment, so the session store never
 * outlives one login.
 */

import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import {
	NodeOAuthClient,
	type NodeSavedSession,
	type NodeSavedState,
	type OAuthClientMetadataInput
} from '@atproto/oauth-client-node';
import type { EstablishResult, IdentityProvider, ScopeSession } from '../types.js';
import { signSessionToken, verifySessionToken } from './session-token.js';
import { hasScopeGrant } from '../identities.js';
import { makeAdminClient } from '$lib/server/supabase-admin.js';

const SESSION_COOKIE = 'atproto_session';
const TOKEN_KIND = 'dyad-atproto-session';

// Ceiling on the app session minted from one sign-in. A week, matching the
// ember credential-cookie cap: the scope session is guest-tier browsing and
// re-establishing it is one redirect, so nothing argues for longer.
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

function isLoopback(baseUrl: string): boolean {
	try {
		const host = new URL(baseUrl).hostname;
		return host === '127.0.0.1' || host === '[::1]' || host === 'localhost';
	} catch {
		return false;
	}
}

/**
 * The client metadata this deployment presents to authorization servers.
 * Public client (`token_endpoint_auth_method: 'none'`): no keys to manage, at
 * the cost of shorter-lived grants — the right trade while sign-in discards
 * the tokens anyway. Served at /oauth/client-metadata.json in production; the
 * loopback form (dev) is passed by value and never served.
 */
export function getAtprotoClientMetadata(): OAuthClientMetadataInput | null {
	const config = readConfig();
	if (!config) return null;

	const redirectUri = `${config.baseUrl}/api/atproto/callback`;
	const loopback = isLoopback(config.baseUrl);
	return {
		client_id: loopback
			? `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}&scope=atproto`
			: `${config.baseUrl}/oauth/client-metadata.json`,
		client_name: 'dyad',
		client_uri: config.baseUrl,
		redirect_uris: [redirectUri],
		scope: 'atproto',
		grant_types: ['authorization_code', 'refresh_token'],
		response_types: ['code'],
		application_type: loopback ? 'native' : 'web',
		token_endpoint_auth_method: 'none',
		dpop_bound_access_tokens: true
	};
}

/** In-memory store spanning one authorize -> callback exchange (see header). */
function memoryStore<V>() {
	const map = new Map<string, V>();
	return {
		async set(key: string, value: V) {
			map.set(key, value);
		},
		async get(key: string) {
			return map.get(key);
		},
		async del(key: string) {
			map.delete(key);
		}
	};
}

let cachedClient: NodeOAuthClient | null = null;

function getClient(): NodeOAuthClient | null {
	if (cachedClient) return cachedClient;
	const clientMetadata = getAtprotoClientMetadata();
	if (!clientMetadata) return null;
	cachedClient = new NodeOAuthClient({
		clientMetadata,
		stateStore: memoryStore<NodeSavedState>(),
		sessionStore: memoryStore<NodeSavedSession>()
	});
	return cachedClient;
}

/**
 * Resolves a member-entered handle (or DID) to their authorization server and
 * returns the URL to send the browser to. Called by /api/atproto/authorize.
 */
export async function beginAuthorization(handle: string): Promise<URL | null> {
	const client = getClient();
	if (!client) return null;
	return client.authorize(handle, { scope: 'atproto' });
}

/** Opaque member id: SHA-256(did), hex, truncated to 32 (adapter-shapes.md). */
async function memberIdFromDid(did: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(did));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0'))
		.join('')
		.slice(0, 32);
}

function toScopeSession(scope: string, memberId: string, expiresAt: number): ScopeSession {
	return { provider: 'atproto', substrate: 'atproto', scope, memberId, expiresAt };
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
		// (code, state, iss), delivered by /api/atproto/callback. The exchange
		// yields the DID; the OAuth session is then revoked — sign-in keeps no
		// standing capability against the member's repository.
		async establish(cookies: Cookies, evidence: unknown): Promise<EstablishResult> {
			const client = getClient();
			if (!client) {
				return { ok: false, status: 404, code: 'provider_unconfigured', message: 'atproto provider not configured' };
			}

			const params = new URLSearchParams();
			for (const key of ['code', 'state', 'iss', 'error', 'error_description'] as const) {
				const value = (evidence as Record<string, unknown>)?.[key];
				if (typeof value === 'string') params.set(key, value);
			}
			if (!params.get('code')) {
				return { ok: false, status: 400, code: 'credential_invalid', message: 'missing authorization code' };
			}

			let did: string;
			try {
				const { session } = await client.callback(params);
				did = session.did;
				// Best-effort revocation: the tokens have served their purpose.
				await session.signOut().catch(() => {});
			} catch (e) {
				console.error('[identity/atproto] callback exchange failed:', e);
				return { ok: false, status: 403, code: 'credential_rejected', message: 'authorization was not accepted' };
			}

			// Authentication is not admission. An ATProto credential proves the
			// person controls a DID — anyone on the network has one. Entering
			// dyad still takes the invite/waitlist route; what that route leaves
			// behind is a durable identity_scopes grant, and only its holder gets
			// a session. No identity row is provisioned here (no roster of
			// visitors who merely tried).
			const memberId = await memberIdFromDid(did);
			const admitted = await hasScopeGrant(makeAdminClient(), 'atproto', memberId, config.scope);
			if (!admitted) {
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
