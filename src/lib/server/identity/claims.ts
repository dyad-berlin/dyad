/**
 * Env-bound wrappers around the pure signer: mint a claim JWT from the Supabase
 * JWT secret, and build a Supabase client that presents it as its bearer so
 * PostgREST/RLS authorize on the injected identity + scope claims.
 *
 * Requires SUPABASE_JWT_SECRET (Supabase dashboard -> Project Settings -> API ->
 * JWT secret). Server-only. Substrate-agnostic: it signs an identity id and
 * scopes, regardless of which provider produced them.
 */

import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { signIdentityJwt, type IdentityClaims } from './claims-sign.js';

export function mintIdentityJwt(claims: IdentityClaims): Promise<string> {
	const secret = env.SUPABASE_JWT_SECRET;
	if (!secret) throw new Error('SUPABASE_JWT_SECRET is not configured');
	return signIdentityJwt(secret, claims);
}

/**
 * A Supabase client whose requests carry the minted JWT. RLS sees its claims
 * via `request.jwt.claims`; the `role: authenticated` claim selects the
 * authenticated Postgres role even with no Supabase account behind it.
 */
export function createClaimClient(jwt: string): SupabaseClient {
	return createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		global: { headers: { Authorization: `Bearer ${jwt}` } },
		auth: { autoRefreshToken: false, persistSession: false }
	});
}
