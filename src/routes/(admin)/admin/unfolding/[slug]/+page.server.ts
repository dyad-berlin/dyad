import { error, fail } from '@sveltejs/kit';
import type { JSONContent } from '@tiptap/core';
import { nanoid } from 'nanoid';
import { getAuthorizedAdminOperator } from '$lib/server/admin-auth';
import { invalidateEntryKeys } from '$lib/server/content-cache';
import { ALLOWED_IMAGE_TYPES, BlobRejectedError, mirrorBlob } from '$lib/server/atproto/blob-mirror';
import { SupabaseStorageService } from '$lib/services/storage';
import { makeAdminClient } from '$lib/server/supabase-admin';
import { NEWSLETTER_ASSETS_BUCKET } from '$lib/services/content-supabase';
import { renderTiptapToHtml } from '$lib/utils/tiptap-html';
import { storageUrl } from '$lib/utils/storage-url';
import { normalizeEssayBody } from '$lib/server/validate-essay-body';
import {
	getEntryRow,
	publishBlockers,
	saveEntry,
	setEntryHeroImage,
	setEntryState,
	type EntryInput
} from '$lib/server/content-admin';
import type { Actions, PageServerLoad } from './$types';

/**
 * /admin/unfolding/[slug] — edit one essay. The on-page preview renders the
 * draft body through the same allowlist renderer the public page uses, so
 * what the operator approves is what visitors get. Gated by Cloudflare
 * Access via the hook, like the whole admin plane.
 */

// Hero images: the image subset of KTD5's media allowlist (SVG is not on it —
// stored SVG is a same-origin XSS vector).
const HERO_MAX_BYTES = 8 * 1024 * 1024;
const HERO_EXT: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/avif': 'avif'
};

export const load: PageServerLoad = async ({ params }) => {
	const row = await getEntryRow(params.slug);
	if (!row) error(404, 'Unknown essay');
	return {
		entry: row,
		blockers: publishBlockers(row),
		bodyHtml: row.body ? renderTiptapToHtml(row.body as JSONContent) : null,
		heroUrl: row.hero_image ? storageUrl(NEWSLETTER_ASSETS_BUCKET, row.hero_image) : null
	};
};

async function invalidate(platform: App.Platform | undefined, slug: string) {
	const kv = platform?.env?.CONTENT_KV;
	// Entry-scoped: an essay mutation leaves the voices last-known-good alone.
	if (kv) await invalidateEntryKeys(kv, slug);
}

export const actions: Actions = {
	save: async ({ request, params, platform }) => {
		const [form, operator] = await Promise.all([
			request.formData(),
			getAuthorizedAdminOperator(request)
		]);

		let body: JSONContent | null = null;
		const bodyRaw = String(form.get('body') ?? '');
		if (bodyRaw) {
			try {
				body = JSON.parse(bodyRaw);
			} catch {
				return fail(400, { error: 'The essay body could not be read — reload and try again.' });
			}
			// A focused-but-untouched editor emits a text-empty doc; that is
			// "no body", not a body that displaces legacy paragraphs.
			body = normalizeEssayBody(body);
		}

		const input: EntryInput = {
			slug: params.slug,
			kicker: String(form.get('kicker') ?? '').trim(),
			title: String(form.get('title') ?? '').trim(),
			dek: String(form.get('dek') ?? '').trim(),
			quote: String(form.get('quote') ?? '').trim(),
			quoteAttr: String(form.get('quoteAttr') ?? '').trim(),
			date: String(form.get('date') ?? '').trim(),
			body,
			heroImage: String(form.get('heroImage') ?? '').trim(),
			heroCredit: String(form.get('heroCredit') ?? '').trim(),
			heroCreditUrl: String(form.get('heroCreditUrl') ?? '').trim()
		};

		const expectedUpdatedAt = String(form.get('expectedUpdatedAt') ?? '') || undefined;
		const saveError = await saveEntry(input, operator?.email ?? null, expectedUpdatedAt);
		if (saveError) return fail(400, { error: saveError });
		await invalidate(platform, params.slug);
		return { saved: true };
	},

	uploadHero: async ({ request, params, platform }) => {
		const [form, operator] = await Promise.all([
			request.formData(),
			getAuthorizedAdminOperator(request)
		]);
		const file = form.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'Choose an image file first.' });
		}
		if (file.size > HERO_MAX_BYTES) {
			return fail(400, { error: 'The image is larger than 8MB.' });
		}
		if (!ALLOWED_IMAGE_TYPES.includes(file.type as never)) {
			return fail(400, { error: 'Hero images are png, jpeg, webp, or avif.' });
		}
		// The row check precedes the Storage write: a bad slug must not mint a
		// public orphan blob (getEntryRow also validates the slug shape).
		if (!(await getEntryRow(params.slug))) {
			return fail(404, { error: 'Unknown essay.' });
		}
		// mirrorBlob owns KTD5's guard sequence — allowlist, magic bytes, then
		// the Storage write — so the check lives in one place.
		const bytes = new Uint8Array(await file.arrayBuffer());
		const path = `heroes/${params.slug}-${nanoid(8)}.${HERO_EXT[file.type]}`;
		try {
			await mirrorBlob({
				bytes,
				claimedType: file.type,
				storage: new SupabaseStorageService(makeAdminClient()),
				bucket: NEWSLETTER_ASSETS_BUCKET,
				path
			});
		} catch (err) {
			if (err instanceof BlobRejectedError) {
				return fail(400, { error: 'The file content does not match its image type.' });
			}
			console.error('[admin/unfolding] hero upload failed:', err);
			return fail(500, { error: 'The upload failed.' });
		}

		const setError = await setEntryHeroImage(params.slug, path, operator?.email ?? null);
		if (setError) return fail(400, { error: setError });
		await invalidate(platform, params.slug);
		return { saved: true };
	},

	setState: async ({ request, params, platform }) => {
		const [form, operator] = await Promise.all([
			request.formData(),
			getAuthorizedAdminOperator(request)
		]);
		const state = form.get('state') === 'published' ? 'published' : 'draft';
		const stateError = await setEntryState(params.slug, state, operator?.email ?? null);
		if (stateError) return fail(400, { error: stateError });
		await invalidate(platform, params.slug);
		return { saved: true };
	}
};
