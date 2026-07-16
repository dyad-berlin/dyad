import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireIdentity } from '$lib/services/identity.js';
import { parseJsonBody } from '$lib/server/parse-body.js';
import { SupabaseFeedbackService } from '$lib/services/feedback.js';
import type { AttendanceInput } from '$lib/domain/types.js';
import { handleServiceError } from '$lib/server/handle-service-error.js';

const SELF_REPORTS = ['attended', 'cancelled_before', 'absent'] as const;
const MAX_ABSENCE_REASON = 500;

/** POST /api/feedback/gathering/attendance — record the caller's attendance
 *  (self-report + derived turnout), and, for the host, attest others' turnout. */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Auth is the primary check; the RPC re-enforces participant/host gates.
	requireIdentity(locals);

	const [body, errorResponse] = await parseJsonBody<AttendanceInput>(request);
	if (errorResponse) return errorResponse;

	if (typeof body.gathering_id !== 'string' || body.gathering_id.length === 0) {
		return json({ error: 'gathering_id is required' }, { status: 400 });
	}
	if (typeof body.self_report !== 'string' || !SELF_REPORTS.includes(body.self_report)) {
		return json({ error: 'self_report is invalid' }, { status: 400 });
	}
	if (
		body.absence_reason !== undefined &&
		(typeof body.absence_reason !== 'string' || body.absence_reason.length > MAX_ABSENCE_REASON)
	) {
		return json({ error: 'Invalid absence reason' }, { status: 400 });
	}
	if (body.turnout !== undefined) {
		if (typeof body.turnout !== 'object' || body.turnout === null || Array.isArray(body.turnout)) {
			return json({ error: 'Invalid turnout' }, { status: 400 });
		}
		for (const value of Object.values(body.turnout)) {
			if (typeof value !== 'boolean') {
				return json({ error: 'Invalid turnout' }, { status: 400 });
			}
		}
	}

	const service = new SupabaseFeedbackService(locals.supabase);
	try {
		await service.submitAttendance({
			gathering_id: body.gathering_id,
			self_report: body.self_report,
			absence_reason: body.absence_reason?.trim() || undefined,
			turnout: body.turnout
		});
		return json({ ok: true });
	} catch (err) {
		return handleServiceError(err, '[feedback/gathering/attendance]');
	}
};
