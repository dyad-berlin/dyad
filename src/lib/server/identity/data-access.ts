/**
 * Chooses how an account-less corner request reaches the database. Generic over
 * substrate: it takes the substrate tag + member id from the ScopeSession.
 *
 * Two modes, switched by IDENTITY_RLS_NATIVE (the flag name is historical; it
 * governs the claim-injection path for every provider):
 *  - default (off): the service-role client; the server enforces scoping in
 *    code. Works without the claim-seam migration applied.
 *  - native (on): a claim-injected client (a short-lived JWT carrying the
 *    identity + scope). RLS does the enforcement, the same path a logged-in
 *    Supabase user takes. Requires the 20260614120000 migration and a
 *    SUPABASE_JWT_SECRET. This is the target architecture.
 *
 * Identity provisioning is the only privileged step: service-role insert (off)
 * or the SECURITY DEFINER `ensure_identity` RPC (on).
 */

import { env } from '$env/dynamic/private';
import { type SupabaseClient } from '@supabase/supabase-js';
import { makeAdminClient } from '$lib/server/supabase-admin.js';
import { mintIdentityJwt, createClaimClient } from './claims.js';
import { resolveIdentityId } from './identities.js';

export function claimInjectionEnabled(): boolean {
	return env.IDENTITY_RLS_NATIVE === '1';
}

/** Read-only client scoped to one corner. */
export async function scopedReadClient(scope: string): Promise<SupabaseClient> {
	if (!claimInjectionEnabled()) return makeAdminClient();
	const jwt = await mintIdentityJwt({ scopes: [scope] });
	return createClaimClient(jwt);
}

/** Write context: the identity to attribute to, and a client to write with. */
export async function scopedWriteContext(
	scope: string,
	substrate: string,
	memberId: string
): Promise<{ client: SupabaseClient; authorId: string }> {
	if (!claimInjectionEnabled()) {
		const admin = makeAdminClient();
		const authorId = await resolveIdentityId(admin, substrate, memberId);
		return { client: admin, authorId };
	}
	// Provisioning is privileged: call ensure_identity with the service role,
	// not the public anon key. The minted claim client below is what does the
	// actual scoped write under RLS.
	const { data, error } = await makeAdminClient().rpc('ensure_identity', {
		p_substrate: substrate,
		p_substrate_id: memberId
	});
	if (error || typeof data !== 'string') {
		throw new Error(`ensure_identity failed: ${error?.message ?? 'no identity returned'}`);
	}
	const jwt = await mintIdentityJwt({ identityId: data, scopes: [scope] });
	return { client: createClaimClient(jwt), authorId: data };
}
