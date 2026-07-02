import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolve a conversation's size (`prompts.capacity`) for size-scoped membership
 * gating. Used by the meeting-flow endpoints to pick the `_1on1` vs `_group`
 * gated action before calling the gate.
 *
 * On ANY read error (or a missing row) it returns `null`, which
 * `gatingActionForCapacity` maps to the GROUP action — the conservative default
 * that matches how the DB treats a NULL capacity (legacy unlimited = group). The
 * RLS FOR INSERT policy and the accept_invitation RPC are the authoritative
 * size-scoped gates at the data layer; this app-side resolution is the primary,
 * user-facing 403 and never fails closed on a transient read blip.
 */
export async function resolvePromptCapacity(
	supabase: SupabaseClient,
	promptId: string
): Promise<number | null> {
	const { data, error } = await supabase
		.from('prompts')
		.select('capacity')
		.eq('id', promptId)
		.maybeSingle();
	if (error || !data) return null;
	return (data.capacity as number | null) ?? null;
}
