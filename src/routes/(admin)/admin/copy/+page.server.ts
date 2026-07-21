import type { PageServerLoad } from './$types';
import { copySections, copyLeaf } from '$lib/copy-meta';
import { getCopyOverrideRowsUncached } from '$lib/server/copy-overrides';
import { ADOPTED_COPY_KEYS } from '$lib/copy-runtime.svelte';

/**
 * /admin/copy — the copy editor's full state. Reads the DB directly (never
 * through the user-plane cache): the editor must always show true state.
 *
 * Orphans: override rows whose key no longer matches a copy.ts leaf (a
 * deploy renamed or removed the key). Surfaced prominently — they override
 * nothing and linger silently otherwise. Deletion is manual: a rollback
 * deploy would want them back.
 */
export const load: PageServerLoad = async () => {
	const rows = await getCopyOverrideRowsUncached();
	const overrideByKey = new Map(rows.map((r) => [r.key, r]));
	const adopted = new Set<string>(ADOPTED_COPY_KEYS);

	const sections = copySections().map((section) => ({
		path: section.path,
		description: section.description,
		routes: section.routes,
		leaves: section.leaves.map((leaf) => {
			const row = overrideByKey.get(leaf.key);
			return {
				key: leaf.key,
				defaultValue: leaf.defaultValue,
				editable: leaf.editable,
				adopted: adopted.has(leaf.key),
				override: row
					? { value: row.value, updatedAt: row.updated_at, updatedBy: row.updated_by }
					: null
			};
		})
	}));

	const orphans = rows
		.filter((r) => copyLeaf(r.key) === null)
		.map((r) => ({
			key: r.key,
			value: r.value,
			updatedAt: r.updated_at,
			updatedBy: r.updated_by
		}));

	return { sections, orphans };
};
