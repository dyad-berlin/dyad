/**
 * Substrate-agnostic identity contracts for dyad.
 *
 * dyad core speaks only these types. It never imports a substrate package and
 * never names a substrate. A specific substrate (atproto, OIDC, Supabase, ...)
 * appears only as an `IdentityProvider` implementation registered once in
 * `registry.ts`; everything downstream (sessions, corner routes, the claim
 * seam, the data layer) is identical regardless of which provider produced the
 * session.
 */

import type { Cookies } from '@sveltejs/kit';

/**
 * An active, time-bounded scope membership obtained by presenting a credential
 * to a provider. Re-verified every request, so it lapses on its own schedule.
 */
export interface ScopeSession {
	/** Registry id of the provider that issued it, e.g. 'atproto'. */
	provider: string;
	/** `identities.substrate` tag, for attribution when the member acts. */
	substrate: string;
	/** dyad scope slug this session grants. */
	scope: string;
	/** Opaque, portable Upactor id (for attribution; not a contact identifier). */
	memberId: string;
	/** Seconds (UNIX epoch). The session lapses at this instant. */
	expiresAt: number;
	/** Optional display name (already PII-sanitised by the provider). */
	displayHint?: string;
}

export type EstablishResult =
	| { ok: true; session: ScopeSession }
	| { ok: false; status: number; code: string; message: string };

/**
 * A configured identity provider: an upact substrate plus the dyad-side policy
 * of which scope it grants and how its credential is collected per request.
 * The credential-collection edge is the only part that is legitimately
 * substrate-shaped (challenge/proof vs redirect vs password); everything it
 * returns is generic.
 */
export interface IdentityProvider {
	/** Stable registry id, used in the session endpoint path. */
	id: string;
	/** The dyad scope slug a session from this provider grants. */
	scope: string;
	/** Issue a challenge for the establish step. Returns a public JSON payload. */
	challenge(cookies: Cookies): Promise<Record<string, unknown>>;
	/** Verify presented evidence; on success, set the provider's session cookie. */
	establish(cookies: Cookies, evidence: unknown): Promise<EstablishResult>;
	/** Re-verify the provider's cookie into a live session, or null if absent/lapsed. */
	resolveSession(cookies: Cookies, nowSeconds: number): Promise<ScopeSession | null>;
	/** Forget the provider's session on this device. */
	clear(cookies: Cookies): void;
}
