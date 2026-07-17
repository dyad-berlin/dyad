/**
 * Resolve an upact identity into a dyad `identities` row, creating it lazily on
 * first participation. Substrate-agnostic: the substrate tag is passed in.
 *
 * dyad's `identities` table is substrate-tagged (`substrate`, `substrate_id`)
 * and does not reference `auth.users`, so any substrate's member participates
 * as a first-class identity without a Supabase account. A row is created only
 * when the member *acts* (authoring attributable content), never for mere
 * membership, so there is still no roster.
 *
 * Service-role path only (the privileged fallback when IDENTITY_RLS_NATIVE is off);
 * the RLS-native path provisions via the `ensure_identity` RPC instead.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Whether this substrate member holds a durable grant for `scope`
 * (an `identity_scopes` row). Read-only: never provisions. This is the
 * admission check for providers whose credential proves identity but not
 * membership (atproto: anyone on the network can authenticate; only invited
 * identities may enter). A substrate whose credential is itself issued by the
 * community can skip this check: there, possession is the admission.
 */
export async function hasScopeGrant(
	service: SupabaseClient,
	substrate: string,
	substrateId: string,
	scope: string
): Promise<boolean> {
	const identity = await service
		.from('identities')
		.select('id')
		.eq('substrate', substrate)
		.eq('substrate_id', substrateId)
		.maybeSingle();
	if (!identity.data?.id) return false;

	const grant = await service
		.from('identity_scopes')
		.select('identity_id')
		.eq('identity_id', identity.data.id)
		.eq('scope', scope)
		.is('revoked_at', null)
		.maybeSingle();
	return Boolean(grant.data);
}

export type GrantResult =
	| { ok: true; restored: boolean }
	| { ok: false; code: 'not_found' | 'error' };

/**
 * Insert an identity_scopes grant, or revive a revoked one. Restoring clears
 * revoked_at but preserves the original granted_at: the cohort timestamp
 * belongs to the first grant, not the re-grant. Shared by the admin grant
 * paths (by username, by handle, waitlist approval).
 */
export async function upsertScopeGrant(
	service: SupabaseClient,
	identityId: string,
	scope: string
): Promise<GrantResult> {
	const { data: existing } = await service
		.from('identity_scopes')
		.select('identity_id, revoked_at')
		.eq('identity_id', identityId)
		.eq('scope', scope)
		.maybeSingle();

	if (existing) {
		const { error } = await service
			.from('identity_scopes')
			.update({ revoked_at: null })
			.eq('identity_id', identityId)
			.eq('scope', scope);
		if (error) {
			console.error('[identity] restore grant failed:', error.message);
			return { ok: false, code: 'error' };
		}
		return { ok: true, restored: true };
	}

	const { error } = await service
		.from('identity_scopes')
		.insert({ identity_id: identityId, scope, granted_by: null });
	if (error) {
		if (error.code === '23503') return { ok: false, code: 'not_found' };
		console.error('[identity] grant insert failed:', error.message);
		return { ok: false, code: 'error' };
	}
	return { ok: true, restored: false };
}

export async function resolveIdentityId(
	service: SupabaseClient,
	substrate: string,
	substrateId: string
): Promise<string> {
	const existing = await service
		.from('identities')
		.select('id')
		.eq('substrate', substrate)
		.eq('substrate_id', substrateId)
		.maybeSingle();
	if (existing.data?.id) return existing.data.id as string;

	const created = await service
		.from('identities')
		.insert({ substrate, substrate_id: substrateId })
		.select('id')
		.single();
	if (created.data?.id) return created.data.id as string;

	const again = await service
		.from('identities')
		.select('id')
		.eq('substrate', substrate)
		.eq('substrate_id', substrateId)
		.maybeSingle();
	if (again.data?.id) return again.data.id as string;

	throw new Error(`could not resolve identity ${substrate}:${substrateId}: ${created.error?.message ?? 'unknown error'}`);
}
