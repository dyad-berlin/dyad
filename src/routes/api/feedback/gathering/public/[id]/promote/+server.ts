import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireIdentity } from '$lib/services/identity.js';
import { SupabaseFeedbackService } from '$lib/services/feedback.js';
import { handleServiceError } from '$lib/server/handle-service-error.js';

/** POST /api/feedback/gathering/public/[id]/promote — the SUBJECT of a public
 *  feedback row promotes it (sets made_public_at). Only the subject may promote;
 *  anyone else gets 403. */
export const POST: RequestHandler = async ({ params, locals }) => {
	requireIdentity(locals);

	const service = new SupabaseFeedbackService(locals.supabase);
	try {
		const promoted = await service.promotePublicFeedback(params.id);
		if (!promoted) {
			return json({ error: 'Not found or not authorized' }, { status: 403 });
		}
		return json({ ok: true });
	} catch (err) {
		return handleServiceError(err, '[feedback/gathering/public/promote]');
	}
};
