import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getProvider } from '$lib/server/identity/index.js';

/**
 * Published only when the deployment has configured the eudi provider. No
 * deployment does yet: the EUDI machinery is kept in readiness (and shared
 * with atproto), but the login surface stays unpublished until then.
 */
export const load: PageServerLoad = async () => {
	if (!getProvider('eudi')) error(404, 'Not found');
	return {};
};
