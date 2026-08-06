import { getContentService } from '$lib/services/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	return { voices: await getContentService(platform).listVoices() };
};
