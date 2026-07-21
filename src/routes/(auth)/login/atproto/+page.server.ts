import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProvider } from '$lib/server/identity/index.js';

/** Published only when the deployment has configured the atproto provider. */
export const load: PageServerLoad = async ({ url }) => {
	if (!(await getProvider('atproto'))) error(404, 'Not found');
	return { errorCode: url.searchParams.get('error') };
};
