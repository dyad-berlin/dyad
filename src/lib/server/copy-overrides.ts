/**
 * Server-side read path for copy overrides (see migration
 * 20260721100000_add_copy_overrides.sql and $lib/copy-meta).
 *
 * Runs on the user plane's hottest path — the root layout load, which covers
 * every route group including the anonymous landing page. Two rules follow:
 *
 * FAIL DIRECTION: to the typed defaults, always. Any failure here — missing
 * SUPABASE_SERVICE_ROLE_KEY (makeAdminClient THROWS synchronously), network
 * error, query error — must degrade to "no overrides", never to a 500. The
 * anon plane needs no DB today and must stay that way in effect.
 *
 * COST: one DB read per isolate per CACHE_TTL_MS, not per request. On error
 * after a successful fetch, the last-known-good map is served indefinitely
 * (stale copy beats flickering back to defaults mid-outage).
 *
 * The admin editor must NOT read through this cache — it needs true DB state
 * (an operator fixing a bad override must not see a ≤60s-stale value and
 * conclude it is already fixed). It uses getCopyOverridesUncached().
 */
import { makeAdminClient } from '$lib/server/supabase-admin';

const CACHE_TTL_MS = 60_000;

export type CopyOverridesMap = Record<string, string>;

export interface CopyOverrideRow {
	key: string;
	value: string;
	default_at_save: string | null;
	updated_at: string;
	updated_by: string | null;
}

let cached: CopyOverridesMap | null = null;
let fetchedAt = 0;

async function fetchMap(): Promise<CopyOverridesMap> {
	const admin = makeAdminClient();
	const { data, error } = await admin.from('copy_overrides').select('key, value');
	if (error) throw error;
	const map: CopyOverridesMap = {};
	for (const row of data ?? []) {
		if (typeof row.key === 'string' && typeof row.value === 'string') {
			map[row.key] = row.value;
		}
	}
	return map;
}

/** Cached overrides map for the user plane. Never throws. */
export async function getCopyOverrides(now = Date.now()): Promise<CopyOverridesMap> {
	if (cached && now - fetchedAt < CACHE_TTL_MS) {
		return cached;
	}
	try {
		cached = await fetchMap();
		fetchedAt = now;
	} catch (err) {
		console.error('[copy-overrides] fetch failed, serving fallback:', err);
		// Keep last-known-good if we have it; first-ever failure → no overrides.
		if (!cached) return {};
		// Push fetchedAt forward so an outage doesn't retry on every request.
		fetchedAt = now;
	}
	return cached;
}

/** True DB state for the admin plane. Throws on failure — the editor should
 *  surface errors, not mask them. */
export async function getCopyOverrideRowsUncached(): Promise<CopyOverrideRow[]> {
	const admin = makeAdminClient();
	const { data, error } = await admin
		.from('copy_overrides')
		.select('key, value, default_at_save, updated_at, updated_by')
		.order('key');
	if (error) throw error;
	return (data ?? []) as CopyOverrideRow[];
}

/**
 * Upsert one override (admin plane only). Optimistic concurrency: when
 * `expectedUpdatedAt` is provided and an existing row's updated_at differs,
 * returns { conflict: true } so the editor can tell the operator the value
 * changed since they opened it. Throws on DB failure.
 */
export async function upsertCopyOverride(params: {
	key: string;
	value: string;
	defaultAtSave: string;
	updatedBy: string | null;
	expectedUpdatedAt?: string | null;
}): Promise<{ conflict: boolean }> {
	const admin = makeAdminClient();
	if (params.expectedUpdatedAt !== undefined && params.expectedUpdatedAt !== null) {
		const { data: existing, error: readError } = await admin
			.from('copy_overrides')
			.select('updated_at')
			.eq('key', params.key)
			.maybeSingle();
		if (readError) throw readError;
		if (existing && existing.updated_at !== params.expectedUpdatedAt) {
			return { conflict: true };
		}
	}
	const { error } = await admin.from('copy_overrides').upsert(
		{
			key: params.key,
			value: params.value,
			default_at_save: params.defaultAtSave,
			updated_by: params.updatedBy,
			updated_at: new Date().toISOString()
		},
		{ onConflict: 'key' }
	);
	if (error) throw error;
	return { conflict: false };
}

/** Delete one override — reverts the key to its typed default. Returns
 *  whether a row was actually removed. Throws on DB failure. */
export async function deleteCopyOverride(key: string): Promise<{ existed: boolean }> {
	const admin = makeAdminClient();
	const { data, error } = await admin
		.from('copy_overrides')
		.delete()
		.eq('key', key)
		.select('key');
	if (error) throw error;
	return { existed: (data ?? []).length > 0 };
}

/** Test hook: reset module cache state between test cases. */
export function _resetCopyOverridesCache(): void {
	cached = null;
	fetchedAt = 0;
}
