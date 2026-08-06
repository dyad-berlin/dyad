import { error } from '@sveltejs/kit';
import { ModuleContentService } from '$lib/services/content';
import type { PageServerLoad } from './$types';

// A server load (not universal): the content service may perform server-only
// reads once a runtime source sits behind the port.
export const load: PageServerLoad = async ({ params }) => {
	const content = new ModuleContentService();
	const entry = await content.getEntry(params.slug);
	if (!entry) error(404, 'Essay not found');
	return { entry };
};
