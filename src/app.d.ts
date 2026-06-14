// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { IdentityPort } from '@prefig/upact';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			user: User | null;
			session: Session | null;
			identityPort: IdentityPort;
			/**
			 * Active (non-revoked, non-retired) scope memberships for the current
			 * user. Empty array for anonymous visitors. Populated once per request
			 * in hooks.server.ts via get_my_access_context() and read by
			 * prompt-query.ts listing methods to gate scoped prompts. Carries both
			 * permanent grants and any ephemeral provider scope sessions (see
			 * `scopeSessions`). See migrations 20260508180000 and 20260605100400.
			 */
			scopes: string[];
			/**
			 * Corner-exclusive context (guest members): the home corner slug, or
			 * null for commons members. When set, listing surfaces show only this
			 * corner. See migration 20260605100200.
			 */
			homeScope: string | null;
			/** Region key of the home corner (e.g. 'amsterdam'), or null. */
			homeRegion: string | null;
			/**
			 * Region implied by the request hostname (e.g. dyad.amsterdam →
			 * 'amsterdam'), or null for the default host. Lets a signed-in
			 * member's discover context follow the domain they arrived on.
			 */
			hostRegion: string | null;
			/**
			 * Guest access window end (ISO timestamp), or null for permanent
			 * members. The access gate in hooks.server.ts blocks expired guests.
			 */
			accessExpiresAt: string | null;
			/**
			 * Ephemeral scope sessions for this request (any identity substrate).
			 * Each is established by presenting a credential to a registered
			 * provider and lapses when that credential expires; stored in no DB row,
			 * re-verified each request. Their scopes are merged into `scopes` above.
			 * See src/lib/server/identity.
			 */
			scopeSessions: import('$lib/server/identity/types').ScopeSession[];
			/**
			 * Substrate-agnostic identity for this request (Phase E). Populated for
			 * a Supabase user or an account-less provider session alike. For an
			 * account-less visitor, `user` is a synthetic id-only stand-in and this
			 * is the canonical identity. Null for anonymous requests.
			 */
			upactor: import('@prefig/upact').Upactor | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env?: {
				PUBLIC_SUPABASE_URL: string;
				PUBLIC_SUPABASE_ANON_KEY: string;
			};
			context?: {
				waitUntil(promise: Promise<unknown>): void;
			};
		}
	}
}

export {};
