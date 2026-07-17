/**
 * Resolve the request's principal: the one identity the rest of the request
 * runs as, whatever the substrate. Substrates are consulted in order and the
 * first match wins; everything downstream (locals.user, the access and
 * feedback gates, services) keys on the result and never asks which substrate
 * produced it.
 *
 * Supabase Auth is substrate zero. It lives here rather than in registry.ts
 * because its session is bound to the request's cookies via the ssr client
 * built in hooks, not to a cookie the provider owns; this function is the
 * composition point where that per-request substrate joins the cookie-shaped
 * registry providers. A Supabase principal keeps its native client and its
 * own Supabase-issued JWT: resolution decides WHO the request is, never which
 * client queries the database.
 *
 * `deferredAccount` marks substrates that separate admission from account
 * creation: their identities exist before any profiles row (created later at
 * /welcome). Supabase creates identities+profiles atomically at signup via
 * the handle_new_user trigger, so the profile-existence gate never needs to
 * run for it.
 */

import type { RequestEvent } from '@sveltejs/kit';
import type { Session, User, SupabaseClient } from '@supabase/supabase-js';
import type { Upactor } from '@prefig/upact';
import { buildAppIdentity } from './app-identity.js';
import type { ScopeSession } from './types.js';

export interface Principal {
	user: User;
	client: SupabaseClient;
	upactor: Upactor | null;
	substrate: string;
	deferredAccount: boolean;
}

export interface ResolvedPrincipal {
	principal: Principal;
	/** The Supabase session when substrate is 'supabase'; null otherwise. */
	session: Session | null;
}

export async function resolvePrincipal(
	event: RequestEvent,
	scopeSessions: ScopeSession[]
): Promise<ResolvedPrincipal | null> {
	// Substrate zero: Supabase Auth via the request-bound ssr client.
	const { session, user } = await event.locals.safeGetSession();
	if (user) {
		return {
			principal: {
				user,
				client: event.locals.supabase,
				upactor: null,
				substrate: 'supabase',
				deferredAccount: false
			},
			session
		};
	}

	// Registry providers: a verified scope session becomes an app identity via
	// the claim seam (a claim-injected client RLS authorizes as the identity).
	// No-op when the claim seam is not configured; the visitor stays anonymous.
	if (scopeSessions.length > 0) {
		const appIdentity = await buildAppIdentity(scopeSessions);
		if (appIdentity) {
			return {
				principal: {
					user: appIdentity.user,
					client: appIdentity.client,
					upactor: appIdentity.upactor,
					substrate: scopeSessions[0].substrate,
					deferredAccount: true
				},
				session: null
			};
		}
	}

	return null;
}
