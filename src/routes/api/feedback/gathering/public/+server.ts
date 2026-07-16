import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireIdentity } from '$lib/services/identity.js';
import { parseJsonBody } from '$lib/server/parse-body.js';
import { SupabaseFeedbackService } from '$lib/services/feedback.js';
import type { PublicFeedbackInput } from '$lib/domain/types.js';
import { handleServiceError } from '$lib/server/handle-service-error.js';

const MAX_TAGS = 10;
const MAX_FREE_TEXT = 2000;

/** POST /api/feedback/gathering/public — leave subject-visible public feedback
 *  (tags + free text) about a co-present participant. Tags are validated against
 *  the active vocabulary in the RPC; the turnout gate is enforced there too. */
export const POST: RequestHandler = async ({ request, locals }) => {
	requireIdentity(locals);

	const [body, errorResponse] = await parseJsonBody<PublicFeedbackInput>(request);
	if (errorResponse) return errorResponse;

	if (typeof body.gathering_id !== 'string' || body.gathering_id.length === 0) {
		return json({ error: 'gathering_id is required' }, { status: 400 });
	}
	if (typeof body.reviewee_id !== 'string' || body.reviewee_id.length === 0) {
		return json({ error: 'reviewee_id is required' }, { status: 400 });
	}
	if (body.tags !== undefined) {
		if (!Array.isArray(body.tags) || body.tags.some((t) => typeof t !== 'string')) {
			return json({ error: 'Invalid tags' }, { status: 400 });
		}
		if (body.tags.length > MAX_TAGS) {
			return json({ error: 'Too many tags' }, { status: 400 });
		}
	}
	if (
		body.free_text !== undefined &&
		(typeof body.free_text !== 'string' || body.free_text.length > MAX_FREE_TEXT)
	) {
		return json({ error: 'Invalid free text' }, { status: 400 });
	}

	const service = new SupabaseFeedbackService(locals.supabase);
	try {
		await service.submitPublicFeedback({
			gathering_id: body.gathering_id,
			reviewee_id: body.reviewee_id,
			tags: body.tags,
			free_text: body.free_text?.trim() || undefined
		});
		return json({ ok: true });
	} catch (err) {
		return handleServiceError(err, '[feedback/gathering/public]');
	}
};
