import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The landing page is static markup for anonymous visitors; the only server
// work left is sending a signed-in member straight to the feed.
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		redirect(302, '/discover');
	}

	return {};
};
