/**
 * The EUDI substrate edge. This is the ONLY file in dyad that imports
 * `@prefig/upact-eudi` or knows the OpenID4VP flow shape. It is registered
 * once in `../registry.ts`; dyad core sees only the generic `IdentityProvider`.
 *
 * EUDI's credential collection is redirect-shaped, not challenge/proof-shaped:
 *   1. GET  /api/session/eudi        -> `challenge()` begins a presentation
 *      transaction and returns the `openid4vp://` wallet deeplink.
 *   2. The wallet dereferences the signed request object at
 *      /api/eudi/request (routes/api/eudi/request, delegating to the port's
 *      `handleRequestUri`) and POSTs its encrypted presentation to
 *      /api/eudi/response (`authenticate` + `respondToWallet`).
 *   3. The wallet sends the browser to /login/eudi?response_code=..., whose
 *      page POSTs the code to /api/session/eudi -> `establish()` redeems it
 *      (single-use) and mints dyad's own session cookie.
 *
 * The Upactor is one-shot by design (@prefig/upact-eudi README, "Identity is
 * one-shot"): the id never repeats, so an EUDI presentation can only ever be
 * admission evidence — one gate crossing. Continuing membership is dyad's own
 * concern; see the TODO(community-policy) seam in `establish()`.
 *
 * Deployment shape: the port holds its transaction store and response codes in
 * closure memory, and those must span the whole deeplink -> dereference ->
 * direct_post -> finish exchange, so the port is a module-level singleton.
 * That suits a single-instance node deployment (dev/sandbox — the adapter is
 * sandbox software); a multi-instance or Workers deployment would need the
 * adapter to grow a shared transaction store first.
 */

import { readFileSync } from 'node:fs';
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import {
	createEudiAdapter,
	type EudiAdapterExtensions,
	type AttributeDeclaration
} from '@prefig/upact-eudi';
import type { IdentityPort, Upactor } from '@prefig/upact';
import type { EstablishResult, IdentityProvider, ScopeSession } from '../types.js';
import { signEudiSessionToken, verifyEudiSessionToken } from './eudi-session.js';

const SESSION_COOKIE = 'eudi_session';

// Ceiling on the app session minted from one presentation. Deliberately short:
// the presentation is admission evidence, not a membership, and the session it
// opens should lapse on the order of a visit, not of the PID's validity.
const SESSION_CAP_S = 24 * 60 * 60;

// The registrable declaration this deployment requests by default:
// possession-only German PID — the wallet proves it holds a valid PID and
// discloses nothing. Override via EUDI_DECLARED_ATTRIBUTES (JSON) for e.g. an
// age predicate; identifying attributes are rejected by the adapter at
// construction (the declared list is the registered list).
const DEFAULT_DECLARED_ATTRIBUTES: AttributeDeclaration[] = [
	{ format: 'dc+sd-jwt', vct: 'urn:eudi:pid:de:1', claims: [] }
];

interface EudiEnvConfig {
	scope: string;
	baseUrl: string;
	accessCertPath: string;
	accessKeyPath: string;
	registrationCertPath: string;
	trustAnchorsPath: string;
	sessionSecret: string;
	declaredAttributes: AttributeDeclaration[];
	allowInsecure: boolean;
	allowTestIssuerCerts: boolean;
}

/**
 * Reads the deployment's EUDI configuration, or null when the provider is not
 * configured. Certificate/key material is referenced by file path:
 *
 *   EUDI_SCOPE_SLUG              dyad scope slug a session grants
 *   EUDI_BASE_URL                public base URL the wallet reaches us under
 *   EUDI_ACCESS_CERT_PATH        access certificate, PEM
 *   EUDI_ACCESS_KEY_PATH         its ES256 private key, PKCS#8 PEM
 *   EUDI_REGISTRATION_CERT_PATH  registration certificate JWT (verifier_info)
 *   EUDI_TRUST_ANCHORS_PATH      PEM bundle of issuer trust anchors
 *   EUDI_SESSION_SECRET          HS256 secret for dyad's own session cookie
 *   EUDI_DECLARED_ATTRIBUTES     optional JSON declaration (see default above)
 *   EUDI_ALLOW_INSECURE          '1' allows an http:// base URL — DEV ONLY
 *   EUDI_TRUST_TEST_ISSUERS      '1' relaxes issuer CA:TRUE for test certs
 *                                (BMI Erica simulator) — DEV ONLY, independent
 *                                of EUDI_ALLOW_INSECURE
 *
 * Dev-mode note: in development these paths point at the BMI Erica simulator's
 * fake access certificate/key and the published mock trust lists (see
 * upact-eudi docs/erica-setup.md), with EUDI_ALLOW_INSECURE=1 for a local
 * http:// base URL. Production uses registrar-issued certificates and must
 * not set EUDI_ALLOW_INSECURE. Paths are read from disk at first use, so this
 * provider requires a node runtime with filesystem access.
 */
function readConfig(): EudiEnvConfig | null {
	const scope = env.EUDI_SCOPE_SLUG;
	const baseUrl = env.EUDI_BASE_URL;
	const accessCertPath = env.EUDI_ACCESS_CERT_PATH;
	const accessKeyPath = env.EUDI_ACCESS_KEY_PATH;
	const registrationCertPath = env.EUDI_REGISTRATION_CERT_PATH;
	const trustAnchorsPath = env.EUDI_TRUST_ANCHORS_PATH;
	const sessionSecret = env.EUDI_SESSION_SECRET;
	if (
		!scope ||
		!baseUrl ||
		!accessCertPath ||
		!accessKeyPath ||
		!registrationCertPath ||
		!trustAnchorsPath ||
		!sessionSecret
	) {
		return null;
	}

	let declaredAttributes = DEFAULT_DECLARED_ATTRIBUTES;
	if (env.EUDI_DECLARED_ATTRIBUTES) {
		try {
			declaredAttributes = JSON.parse(env.EUDI_DECLARED_ATTRIBUTES);
		} catch {
			// A present-but-unparseable declaration is a misconfiguration, not a
			// silent fallback to the default: fail closed by not configuring.
			console.error('[identity/eudi] EUDI_DECLARED_ATTRIBUTES is not valid JSON; provider disabled');
			return null;
		}
	}

	return {
		scope,
		baseUrl,
		accessCertPath,
		accessKeyPath,
		registrationCertPath,
		trustAnchorsPath,
		sessionSecret,
		declaredAttributes,
		allowInsecure: env.EUDI_ALLOW_INSECURE === '1',
		// Relaxes the issuer-chain CA:TRUE constraint for test issuer certs
		// (e.g. BMI Erica's simulator PID). Dev/test only; never in production.
		// Independent of EUDI_ALLOW_INSECURE, which is only about http:// URLs.
		allowTestIssuerCerts: env.EUDI_TRUST_TEST_ISSUERS === '1'
	};
}

/** Splits a PEM bundle into individual certificates. */
export function splitPemCertificates(bundle: string): string[] {
	const matches = bundle.match(
		/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g
	);
	return matches ? matches.map((m) => m.trim()) : [];
}

type EudiPort = IdentityPort & EudiAdapterExtensions;

// Module-level singleton: the port's transaction store and response codes are
// closure state that must survive across the requests of one presentation
// exchange (see file header). Unlike the ember provider — which builds a fresh
// adapter per call precisely so closure state does NOT leak across requests —
// the EUDI flow is multi-request by nature.
let cachedPort: EudiPort | null = null;

/**
 * The deployment's EUDI port, or null when the provider is not configured.
 * Construction validates the declared attribute surface and the certificate
 * material and throws with the adapter's own descriptive error on a
 * misconfiguration — loud at the EUDI surface, invisible elsewhere (the
 * registry only reaches this through routes that already 404 unconfigured).
 */
export function getEudiPort(): EudiPort | null {
	if (cachedPort) return cachedPort;
	const config = readConfig();
	if (!config) return null;

	cachedPort = createEudiAdapter({
		declaredAttributes: config.declaredAttributes,
		audience: config.baseUrl,
		accessCertificate: readFileSync(config.accessCertPath, 'utf8'),
		accessCertificateKey: readFileSync(config.accessKeyPath, 'utf8'),
		registrationCertificate: readFileSync(config.registrationCertPath, 'utf8').trim(),
		endpoints: {
			baseUrl: config.baseUrl,
			// The wallet-facing routes dyad mounts for this adapter
			// (src/routes/api/eudi/{request,response}) and the browser finish
			// page (src/routes/(auth)/login/eudi).
			requestPath: '/api/eudi/request',
			responsePath: '/api/eudi/response',
			finishPath: '/login/eudi'
		},
		trustAnchors: splitPemCertificates(readFileSync(config.trustAnchorsPath, 'utf8')).map(
			(certificate, i) => ({ certificate, name: `anchor ${i + 1} (${config.trustAnchorsPath})` })
		),
		...(config.allowInsecure ? { allowInsecureRequests: true } : {}),
		...(config.allowTestIssuerCerts ? { allowTestIssuerCertificates: true } : {})
	});
	return cachedPort;
}

function expirySeconds(expires_at: Date | undefined): number {
	return expires_at ? Math.floor(expires_at.getTime() / 1000) : 0;
}

function toScopeSession(scope: string, memberId: string, expiresAt: number): ScopeSession {
	return { provider: 'eudi', substrate: 'eudi', scope, memberId, expiresAt };
}

/** Construct the EUDI provider, or null if this deployment has not configured it. */
export function eudiProvider(): IdentityProvider | null {
	const config = readConfig();
	if (!config) return null;

	return {
		id: 'eudi',
		scope: config.scope,

		// The "challenge" for a redirect-shaped substrate is the wallet
		// deeplink: it begins a presentation transaction on the singleton port
		// and hands the browser something to render as a link or QR code. No
		// cookie is needed — the transaction is bound server-side, single-use
		// and short-lived.
		async challenge(): Promise<Record<string, unknown>> {
			const port = getEudiPort();
			if (!port) throw new Error('eudi provider not configured');
			const deeplink = await port.buildPresentationDeeplink();
			return { deeplink: deeplink.href };
		},

		// The evidence is the single-use response_code the wallet-followed
		// browser arrived with at /login/eudi. Redeeming it yields the one-shot
		// Upactor exactly once; from it we mint dyad's own session cookie.
		async establish(cookies: Cookies, evidence: unknown): Promise<EstablishResult> {
			const responseCode = (evidence as { response_code?: unknown })?.response_code;
			if (typeof responseCode !== 'string' || responseCode.length === 0) {
				return { ok: false, status: 400, code: 'credential_invalid', message: 'missing response_code' };
			}

			const port = getEudiPort();
			if (!port) return { ok: false, status: 404, code: 'provider_unconfigured', message: 'eudi provider not configured' };

			const actor: Upactor | null = await port.redeemResponseCode(responseCode);
			if (!actor) {
				return { ok: false, status: 403, code: 'credential_rejected', message: 'response code unknown, expired, or already redeemed' };
			}

			// TODO(community-policy) — the admission seam. The redeemed Upactor
			// is admission evidence for ONE gate crossing under a community's
			// own per-scope policy (upact-eudi README, "Where EUDI evidence
			// belongs in an application"). The policy check that decides what
			// this crossing admits the person to — and what durable thing the
			// community issues them (an invitation, a membership, an ember
			// scope credential) — would consume `actor` here. Its id is one-shot
			// by design: dyad can never recognise this holder again, so
			// continuing membership must be dyad's own artifact, not a repeat
			// presentation. Until that policy exists, the crossing opens only
			// the short-lived ephemeral scope session below.

			const now = Math.floor(Date.now() / 1000);
			const credentialExpiry = expirySeconds(actor.lifecycle?.expires_at);
			if (credentialExpiry <= now) {
				return { ok: false, status: 403, code: 'credential_rejected', message: 'credential already expired' };
			}
			const expiresAt = Math.min(credentialExpiry, now + SESSION_CAP_S);

			const token = await signEudiSessionToken(config.sessionSecret, {
				memberId: actor.id,
				scope: config.scope,
				expiresAt
			});
			cookies.set(SESSION_COOKIE, token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: !dev,
				maxAge: expiresAt - now
			});

			return { ok: true, session: toScopeSession(config.scope, actor.id, expiresAt) };
		},

		// Unlike ember there is no credential to re-verify (the presentation
		// was one-shot); re-verification here is the signature and expiry of
		// dyad's own session token.
		async resolveSession(cookies: Cookies, nowSeconds: number): Promise<ScopeSession | null> {
			const token = cookies.get(SESSION_COOKIE);
			if (!token) return null;
			const claims = await verifyEudiSessionToken(config.sessionSecret, token, nowSeconds);
			// A token whose scope no longer matches the configured scope grants
			// nothing (the deployment's declaration changed under it).
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
