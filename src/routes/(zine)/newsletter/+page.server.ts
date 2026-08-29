import { ContentUnavailableError } from '$lib/server/content-cache';
import { getContentService } from '$lib/services/content';
import type { PageServerLoad } from './$types';

// All content reads pass through the ContentService port; the archive needs
// only summaries (no essay bodies), so the payload stays flat as the
// catalogue grows.
export const load: PageServerLoad = async ({ platform }) => {
	try {
		return { entries: await getContentService(platform).listEntries() };
	} catch (err) {
		// Source down with nothing cached: render the explicit empty state
		// rather than a 500 (plan U8's fail direction).
		if (err instanceof ContentUnavailableError) return { entries: [] };
		throw err;
	}
};
