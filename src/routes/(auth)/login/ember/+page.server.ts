import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProvider } from '$lib/server/identity/index.js';

/** Published only when the deployment has configured the ember provider. */
export const load: PageServerLoad = async () => {
	if (!getProvider('ember')) error(404, 'Not found');
	return {};
};
