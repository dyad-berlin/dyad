import { error } from '@sveltejs/kit';
import { ContentUnavailableError } from '$lib/server/content-cache';
import { getContentService } from '$lib/services/content';
import { renderTiptapToHtml } from '$lib/utils/tiptap-html';
import type { PageServerLoad } from './$types';

// A server load (not universal): the content service may perform server-only
// reads once a runtime source sits behind the port.
export const load: PageServerLoad = async ({ params, platform }) => {
	let entry;
	try {
		entry = await getContentService(platform).getEntry(params.slug);
	} catch (err) {
		// Source down with nothing cached: a temporary error, not a missing
		// page — 503 keeps crawlers from de-indexing the essay (plan U8).
		if (err instanceof ContentUnavailableError) error(503, 'Essays are briefly unavailable');
		throw err;
	}
	if (!entry) error(404, 'Essay not found');
	// The body variant (KTD2) is rendered server-side through the allowlist
	// renderer — the one permitted `{@html}` body use (R6). The shape guard
	// already validated the body (structure + no inline media) at the port.
	const bodyHtml = entry.body ? renderTiptapToHtml(entry.body) : null;
	return { entry, bodyHtml };
};
