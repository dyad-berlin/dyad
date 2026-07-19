import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireIdentity } from '$lib/services/identity.js';
import { parseJsonBody } from '$lib/server/parse-body.js';
import { SupabaseFeedbackService } from '$lib/services/feedback.js';
import { handleServiceError } from '$lib/server/handle-service-error.js';

/** PATCH /api/reputation-signals/[id] — feature/unfeature a reputation
 *  signal on the caller's own profile. Body: { visible: boolean }. The
 *  set_reputation_signal_visibility RPC re-checks ownership server-side
 *  (SECURITY DEFINER, bypasses RLS) — this endpoint's own auth check is
 *  the primary guard, the RPC is the second layer. */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	requireIdentity(locals);

	const [body, errorResponse] = await parseJsonBody<{ visible?: boolean }>(request);
	if (errorResponse) return errorResponse;

	if (typeof body.visible !== 'boolean') {
		return json({ error: 'visible is required' }, { status: 400 });
	}

	const service = new SupabaseFeedbackService(locals.supabase);
	try {
		const updated = await service.setReputationSignalVisibility(params.id, body.visible);
		if (!updated) return json({ error: 'Signal not found' }, { status: 404 });
		return json({ ok: true, visible: body.visible });
	} catch (err) {
		return handleServiceError(err, '[reputation-signals/patch]');
	}
};
