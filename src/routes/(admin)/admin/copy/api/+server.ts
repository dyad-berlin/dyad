import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { copyLeaf, validateOverride } from '$lib/copy-meta';
import {
	getCopyOverrideRowsUncached,
	upsertCopyOverride,
	deleteCopyOverride
} from '$lib/server/copy-overrides';
import { getAuthorizedAdminOperator } from '$lib/server/admin-auth';

/**
 * Admin-plane copy-overrides endpoint. Gated by the Cloudflare Access hook
 * in src/hooks.server.ts (requests only reach here as a verified operator);
 * the operator email for attribution is re-derived from the same verified
 * request — never from the client body.
 *
 * Validation happens HERE, not just in the editor UI: the UI mirrors
 * validateOverride for inline feedback, but the API is the trust boundary.
 */

export const GET: RequestHandler = async () => {
	try {
		const rows = await getCopyOverrideRowsUncached();
		return json({ overrides: rows });
	} catch (err) {
		console.error('[admin/copy] list failed:', err);
		return json({ error: 'Failed to load overrides' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const key = body.key;
	if (typeof key !== 'string' || key.length === 0 || key.length > 200) {
		return json({ error: 'key is required' }, { status: 400 });
	}

	const errors = validateOverride(key, body.value);
	if (errors.length > 0) {
		return json({ error: errors[0].message, validation: errors }, { status: 400 });
	}

	const expectedUpdatedAt =
		typeof body.expectedUpdatedAt === 'string' ? body.expectedUpdatedAt : null;

	const operator = await getAuthorizedAdminOperator(request);
	const leaf = copyLeaf(key);

	try {
		const { conflict } = await upsertCopyOverride({
			key,
			value: body.value as string,
			defaultAtSave: leaf?.defaultValue ?? '',
			updatedBy: operator?.email ?? null,
			expectedUpdatedAt
		});
		if (conflict) {
			return json(
				{ error: 'This copy changed since you opened it — reload and re-apply your edit.' },
				{ status: 409 }
			);
		}
		return json({ ok: true, key });
	} catch (err) {
		console.error('[admin/copy] save failed:', err);
		return json({ error: 'Failed to save override' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const key = body.key;
	if (typeof key !== 'string' || key.length === 0) {
		return json({ error: 'key is required' }, { status: 400 });
	}

	try {
		const { existed } = await deleteCopyOverride(key);
		if (!existed) {
			return json({ error: 'No override exists for this key' }, { status: 404 });
		}
		return json({ ok: true, key });
	} catch (err) {
		console.error('[admin/copy] revert failed:', err);
		return json({ error: 'Failed to revert override' }, { status: 500 });
	}
};
