import type { LayoutServerLoad } from './$types';
import { getCopyOverrides } from '$lib/server/copy-overrides';

/**
 * Root layout load — runs for EVERY route group, including the anonymous
 * landing/zine/auth pages that otherwise have no server load. Keep it to
 * exactly one concern: the copy-overrides map (admin-edited copy, resolved
 * against the typed defaults by $lib/copy-runtime).
 *
 * Cost: in-isolate cache with a 60s TTL — one DB read per isolate per
 * minute, cache hits otherwise. Failure: getCopyOverrides never throws; the
 * worst case is an empty map and the typed defaults render. Do not add
 * per-user work here; that belongs in the route-group layouts.
 */
export const load: LayoutServerLoad = async () => {
	return {
		copyOverrides: await getCopyOverrides()
	};
};
