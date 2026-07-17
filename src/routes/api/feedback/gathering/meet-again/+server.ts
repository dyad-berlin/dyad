import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireIdentity } from '$lib/services/identity.js';
import { parseJsonBody } from '$lib/server/parse-body.js';
import { SupabaseFeedbackService } from '$lib/services/feedback.js';
import { handleServiceError } from '$lib/server/handle-service-error.js';

interface MeetAgainBody {
	gathering_id: string;
	meet_again: boolean;
}

/** POST /api/feedback/gathering/meet-again — record the caller's collect-only
 *  "would you meet again" answer for a gathering (R7). Owner-scoped in the RPC. */
export const POST: RequestHandler = async ({ request, locals }) => {
	requireIdentity(locals);

	const [body, errorResponse] = await parseJsonBody<MeetAgainBody>(request);
	if (errorResponse) return errorResponse;

	if (typeof body.gathering_id !== 'string' || body.gathering_id.length === 0) {
		return json({ error: 'gathering_id is required' }, { status: 400 });
	}
	if (typeof body.meet_again !== 'boolean') {
		return json({ error: 'meet_again is required' }, { status: 400 });
	}

	const service = new SupabaseFeedbackService(locals.supabase);
	try {
		await service.submitMeetAgain(body.gathering_id, body.meet_again);
		return json({ ok: true });
	} catch (err) {
		return handleServiceError(err, '[feedback/gathering/meet-again]');
	}
};
