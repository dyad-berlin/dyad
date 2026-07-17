/**
 * Authorize the whole app as an account-less member.
 *
 * Given the scope sessions resolved for a request (from any provider), build a
 * claim-injected Supabase client that authorizes as the member's identity with
 * their scopes, plus a minimal synthetic `locals.user` (id only) so the
 * existing app — which reads `locals.user.id` and runs every query through RLS
 * — renders for them unchanged, scoped by the claim. This is what makes a
 * provider login (any substrate) a way *into the app*, not a special page.
 *
 * Requires the claim seam: IDENTITY_RLS_NATIVE=1, the 20260614120000 migration,
 * and SUPABASE_JWT_SECRET. Returns null when not applicable, so the request
 * simply stays anonymous.
 */

import type { User, SupabaseClient } from '@supabase/supabase-js';
import type { Upactor } from '@prefig/upact';
import { makeAdminClient } from '$lib/server/supabase-admin.js';
import { mintIdentityJwt, createClaimClient } from './claims.js';
import { claimInjectionEnabled } from './data-access.js';
import type { ScopeSession } from './types.js';

export interface AppIdentity {
	client: SupabaseClient;
	user: User;
	upactor: Upactor;
}

export async function buildAppIdentity(sessions: ScopeSession[]): Promise<AppIdentity | null> {
	if (!claimInjectionEnabled() || sessions.length === 0) return null;

	// Fail safe: any misconfiguration (missing JWT secret, migration not applied,
	// RPC error) leaves the visitor anonymous rather than 500-ing the request.
	try {
		// All sessions here belong to the same visitor (one provider session in
		// practice).
		const primary = sessions[0];
		const admin = makeAdminClient();

		// Provisioning an identity row is privileged; do it with the service role,
		// never the public anon key. The claim client minted below is what then
		// authorizes the request under RLS.
		const { data, error } = await admin.rpc('ensure_identity', {
			p_substrate: primary.substrate,
			p_substrate_id: primary.memberId
		});
		if (error || typeof data !== 'string') return null;
		const identityId = data;

		// Mint the claim's scopes from the identity's LIVE grants, not from the
		// session cookie's asserted scope. The cookie proves the credential; the
		// identity_scopes row proves current admission. Reading the durable grant
		// (revoked_at IS NULL) each request is what makes revocation take effect
		// immediately: the claim-scoped RLS policies trust app_scopes and have no
		// revocation awareness of their own, and a provider session cookie lives
		// for days, so a stale cookie scope would otherwise outlast a revoked
		// grant. Intersect with the session's scope so the claim never exceeds
		// what this credential was for.
		const sessionScopes = new Set(sessions.map((s) => s.scope));
		const { data: grantRows } = await admin
			.from('identity_scopes')
			.select('scope')
			.eq('identity_id', identityId)
			.is('revoked_at', null);
		const scopes = (grantRows ?? [])
			.map((r) => r.scope as string)
			.filter((s) => sessionScopes.has(s));

		// Every scope this session asserted has been revoked: the visitor is no
		// longer admitted. Return null so the request falls back to anonymous.
		if (scopes.length === 0) return null;

		const jwt = await mintIdentityJwt({ identityId, scopes });
		const client = createClaimClient(jwt);

		// Synthetic user: the app reads only `.id` for authorization and ownership,
		// and that id is the member's identities.id — the same value RLS authorizes
		// on via the claim. No email/profile; the app must not depend on those for
		// an account-less identity (it does not, for reading and responding).
		const user = { id: identityId } as unknown as User;
		const upactor: Upactor = {
			id: identityId,
			capabilities: new Set(),
			...(primary.displayHint ? { display_hint: primary.displayHint } : {})
		};
		return { client, user, upactor };
	} catch {
		return null;
	}
}
