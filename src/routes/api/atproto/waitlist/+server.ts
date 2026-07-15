import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { makeAdminClient } from '$lib/server/supabase-admin';
import {
	readPendingIdentity,
	clearPendingIdentity
} from '$lib/server/identity/providers/atproto.js';

/**
 * Ask to join, after a sign-in that was verified but not admitted. The pending
 * token minted at that rejection is the evidence: the join request records an
 * identity the visitor demonstrably controlled minutes ago, not one they typed
 * in. Asking is the consent to store the (public) handle and the opaque
 * substrate id; nothing is stored for a rejected sign-in that never asks.
 */
export const POST: RequestHandler = async ({ cookies }) => {
	const pending = await readPendingIdentity(cookies, Math.floor(Date.now() / 1000));
	if (!pending) {
		return json({ error: 'no verified sign-in to attach a request to' }, { status: 400 });
	}

	const { error: dbError } = await makeAdminClient()
		.from('join_requests')
		.upsert(
			{
				substrate: 'atproto',
				substrate_id: pending.memberId,
				handle: pending.handle,
				scope: pending.scope
			},
			{ onConflict: 'substrate,substrate_id,scope', ignoreDuplicates: true }
		);
	if (dbError) {
		console.error('[atproto/waitlist] join request insert failed:', dbError.message);
		return json({ error: 'could not record the request' }, { status: 500 });
	}

	clearPendingIdentity(cookies);
	return json({ ok: true });
};
