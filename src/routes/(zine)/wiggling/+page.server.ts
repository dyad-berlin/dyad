import { ContentUnavailableError } from '$lib/server/content-cache';
import { getContentService } from '$lib/services/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	try {
		return { voices: await getContentService(platform).listVoices() };
	} catch (err) {
		// Source down with nothing cached: the page renders without reels
		// rather than a 500 (plan U8's fail direction).
		if (err instanceof ContentUnavailableError) return { voices: [] };
		throw err;
	}
};
