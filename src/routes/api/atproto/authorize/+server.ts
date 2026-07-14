import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { beginAuthorization } from '$lib/server/identity/providers/atproto.js';

/**
 * Starts an ATProto sign-in: resolves the entered handle to its authorization
 * server and sends the browser there. Redirect-shaped like the EUDI wallet
 * routes — this is the substrate's HTTP surface, not the generic session
 * endpoint's; the browser arrives here by form navigation, not fetch.
 */
export const GET: RequestHandler = async ({ url }) => {
	const handle = url.searchParams.get('handle')?.trim().replace(/^@/, '') ?? '';
	if (!handle || handle.length > 253 || /\s/.test(handle)) {
		redirect(303, '/login/atproto?error=handle');
	}

	let authorizeUrl: URL | null;
	try {
		authorizeUrl = await beginAuthorization(handle);
	} catch (e) {
		console.error('[identity/atproto] authorize failed:', e);
		redirect(303, '/login/atproto?error=resolve');
	}
	if (!authorizeUrl) return json({ error: 'not found' }, { status: 404 });

	redirect(302, authorizeUrl.toString());
};
