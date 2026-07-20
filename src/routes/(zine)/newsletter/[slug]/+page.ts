import { error } from '@sveltejs/kit';
import { getUnfoldingEntry } from '$lib/content/unfolding';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const entry = getUnfoldingEntry(params.slug);
	if (!entry) error(404, 'Essay not found');
	return { entry };
};
