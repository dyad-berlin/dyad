import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEudiPort } from '$lib/server/identity/providers/eudi.js';

/**
 * Wallet-facing: the EUDI wallet POSTs its encrypted presentation here
 * (`direct_post.jwt`, the `response_uri` of the signed request object).
 * `authenticate` verifies it against the frozen declared-attribute policy;
 * `respondToWallet` shapes the answer the wallet expects — on success a
 * wallet-follow `redirect_uri` carrying a single-use `response_code`, which
 * the browser then presents at /login/eudi to establish the app session.
 */
export const POST: RequestHandler = async ({ request }) => {
	const port = getEudiPort();
	if (!port) error(404, 'not found');
	const outcome = await port.authenticate({ kind: 'eudi-response', request });
	return port.respondToWallet(outcome);
};
