import { error } from '@sveltejs/kit';
import { getContentService } from '$lib/services/content';
import type { PageServerLoad } from './$types';

// A server load (not universal): the content service may perform server-only
// reads once a runtime source sits behind the port.
export const load: PageServerLoad = async ({ params, platform }) => {
	const entry = await getContentService(platform).getEntry(params.slug);
	if (!entry) error(404, 'Essay not found');
	return { entry };
};
