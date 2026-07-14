import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getEudiPort } from '$lib/server/identity/providers/eudi.js';

/**
 * Wallet-facing: the EUDI wallet dereferences the signed request object here
 * (the `request_uri` inside the deeplink issued by GET /api/session/eudi).
 * This is the adapter's HTTP surface, not the generic session endpoint's —
 * the wallet speaks `application/oauth-authz-req+jwt`, not dyad JSON — so it
 * delegates whole-request/whole-response to the port's `handleRequestUri`.
 * Single-use: forged, expired, and replayed references are uniformly 404.
 *
 * A POSTing wallet may supply `wallet_nonce` (OpenID4VP 1.0), hence both verbs.
 */
const dereference: RequestHandler = async ({ request }) => {
	const port = getEudiPort();
	if (!port) return json({ error: 'not found' }, { status: 404 });
	return port.handleRequestUri(request);
};

export const GET = dereference;
export const POST = dereference;
