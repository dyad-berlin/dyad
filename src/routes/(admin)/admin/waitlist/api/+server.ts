import { json } from '@sveltejs/kit';
import { makeAdminClient } from '$lib/server/supabase-admin';
import { parseJsonBody } from '$lib/server/parse-body.js';
import { resolveIdentityId, upsertScopeGrant } from '$lib/server/identity/identities.js';
import type { RequestHandler } from './$types';

/**
 * Decide a provider join request. Approving provisions the identities row and
 * grants the request's scope: the same admission artifact the invite-by-handle
 * path creates, so the person's next sign-in is admitted. Declining records
 * the decision and provisions nothing.
 *
 * Lives under /admin/* and is gated by the admin hook in src/hooks.server.ts.
 */
export const POST: RequestHandler = async ({ request }) => {
	const supabase = makeAdminClient();
	const [body, errorResponse] = await parseJsonBody(request);
	if (errorResponse) return errorResponse;

	const { id, action } = body;
	if (typeof id !== 'string' || (action !== 'approve' && action !== 'decline')) {
		return json({ error: 'id and action (approve|decline) are required' }, { status: 400 });
	}

	const { data: req } = await supabase
		.from('join_requests')
		.select('id, substrate, substrate_id, scope, approved')
		.eq('id', id)
		.maybeSingle();
	if (!req) {
		return json({ error: 'No such request' }, { status: 404 });
	}

	if (action === 'approve') {
		let identityId: string;
		try {
			identityId = await resolveIdentityId(supabase, req.substrate, req.substrate_id);
		} catch (e) {
			console.error('[admin/waitlist/api] identity provisioning failed:', e);
			return json({ error: 'Failed to approve' }, { status: 500 });
		}
		const grant = await upsertScopeGrant(supabase, identityId, req.scope);
		if (!grant.ok) {
			return json({ error: 'Failed to approve' }, { status: 500 });
		}
	}

	const { error: dbError } = await supabase
		.from('join_requests')
		.update({ decided_at: new Date().toISOString(), approved: action === 'approve' })
		.eq('id', id);
	if (dbError) {
		console.error('[admin/waitlist/api] decision update failed:', dbError.message);
		return json({ error: 'Failed to record the decision' }, { status: 500 });
	}

	return json({ ok: true });
};
