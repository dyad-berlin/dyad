import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAtprotoClientMetadata } from '$lib/server/identity/providers/atproto.js';

/**
 * The ATProto OAuth client metadata document. Authorization servers fetch it
 * to learn who this client is; its URL is the client's identity, so the path
 * is load-bearing and public. 404 while the provider is unconfigured; never
 * served for the loopback (dev) client, whose metadata travels by value.
 */
export const GET: RequestHandler = async () => {
	const metadata = getAtprotoClientMetadata();
	if (!metadata || metadata.application_type === 'native') {
		return json({ error: 'not found' }, { status: 404 });
	}
	return json(metadata);
};
