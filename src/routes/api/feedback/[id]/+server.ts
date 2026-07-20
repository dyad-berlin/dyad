import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireIdentity } from '$lib/services/identity.js';
import { parseJsonBody } from '$lib/server/parse-body.js';
import { SupabaseFeedbackService } from '$lib/services/feedback.js';
import type { FeedbackInput } from '$lib/services/feedback.js';
import { handleServiceError } from '$lib/server/handle-service-error.js';

/** GET /api/feedback/[id] — get my feedback form by form ID */
export const GET: RequestHandler = async ({ params, locals }) => {
	const upactor = requireIdentity(locals);

	// Query the form directly — RLS ensures only the reviewer can read it
	const { data, error } = await locals.supabase
		.from('feedback_forms')
		.select('id, meeting_id, reviewer_id, reviewee_id, did_meet, no_show_reason, rating_tags, free_text, share_with_person, state, submitted_at, locked_at, created_at')
		.eq('id', params.id)
		.eq('reviewer_id', upactor.id)
		.maybeSingle();

	if (error) return handleServiceError(error, '[feedback/get]');
	if (!data) return json({ error: 'Form not found' }, { status: 404 });

	return json(data);
};

/** PATCH /api/feedback/[id] — submit/edit feedback */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const upactor = requireIdentity(locals);

	const [body, errorResponse] = await parseJsonBody<FeedbackInput>(request);
	if (errorResponse) return errorResponse;

	if (body.did_meet === undefined || body.did_meet === null) {
		return json({ error: 'did_meet is required' }, { status: 400 });
	}

	const service = new SupabaseFeedbackService(locals.supabase);
	try {
		const newState = await service.submit(params.id, body);

		// If both parties submitted (locked), return revealed feedback and the
		// caller's own reputation signal (feature-on-profile toggle source)
		// directly, to eliminate extra client round trips.
		if (newState === 'locked') {
			const form = await service.getFormById(params.id, upactor.id);
			if (form) {
				const [revealed, reputationSignal] = await Promise.all([
					service.getRevealedFeedback(form.meeting_id, upactor.id),
					service.getReputationSignalForMeeting(form.meeting_id, upactor.id)
				]);
				return json({ ok: true, state: newState, revealed, reputationSignal });
			}
		}

		return json({ ok: true, state: newState });
	} catch (err) {
		return handleServiceError(err, '[feedback/patch]');
	}
};
