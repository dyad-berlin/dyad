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
 * Service-role path only (the privileged fallback when EMBER_RLS_NATIVE is off);
 * the RLS-native path provisions via the `ensure_identity` RPC instead.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

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
