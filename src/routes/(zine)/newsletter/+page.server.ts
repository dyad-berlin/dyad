import { getContentService } from '$lib/services/content';
import type { PageServerLoad } from './$types';

// All content reads pass through the ContentService port; the archive needs
// only summaries (no essay bodies), so the payload stays flat as the
// catalogue grows.
export const load: PageServerLoad = async ({ platform }) => {
	return { entries: await getContentService(platform).listEntries() };
};
