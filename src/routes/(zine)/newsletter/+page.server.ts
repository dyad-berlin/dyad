import { ModuleContentService } from '$lib/services/content';
import type { PageServerLoad } from './$types';

// All content reads pass through the ContentService port; the archive needs
// only summaries (no essay bodies), so the payload stays flat as the
// catalogue grows.
export const load: PageServerLoad = async () => {
	const content = new ModuleContentService();
	return { entries: await content.listEntries() };
};
