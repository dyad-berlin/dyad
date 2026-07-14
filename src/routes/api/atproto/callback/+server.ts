import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProvider } from '$lib/server/identity/index.js';

/**
 * The OAuth redirect URI. The authorization server sends the browser here
 * with code/state/iss; `establish()` exchanges them, revokes the OAuth
 * session, and mints dyad's own scope-session cookie. A full navigation
 * follows so hooks re-run with the new cookie.
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
	const provider = getProvider('atproto');
	if (!provider) return json({ error: 'not found' }, { status: 404 });

	const result = await provider.establish(cookies, Object.fromEntries(url.searchParams));
	if (!result.ok) {
		redirect(303, `/login/atproto?error=${encodeURIComponent(result.code)}`);
	}
	redirect(303, '/discover');
};
