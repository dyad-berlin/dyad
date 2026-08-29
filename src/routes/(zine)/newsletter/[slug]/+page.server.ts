import { error } from '@sveltejs/kit';
import { getContentService } from '$lib/services/content';
import { renderTiptapToHtml } from '$lib/utils/tiptap-html';
import type { PageServerLoad } from './$types';

// A server load (not universal): the content service may perform server-only
// reads once a runtime source sits behind the port.
export const load: PageServerLoad = async ({ params, platform }) => {
	const entry = await getContentService(platform).getEntry(params.slug);
	if (!entry) error(404, 'Essay not found');
	// The body variant (KTD2) is rendered server-side through the allowlist
	// renderer — the one permitted `{@html}` body use (R6). The shape guard
	// already validated the body (structure + no inline media) at the port.
	const bodyHtml = entry.body ? renderTiptapToHtml(entry.body) : null;
	return { entry, bodyHtml };
};
