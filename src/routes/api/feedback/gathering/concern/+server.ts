import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireIdentity } from '$lib/services/identity.js';
import { parseJsonBody } from '$lib/server/parse-body.js';
import { SupabaseFeedbackService } from '$lib/services/feedback.js';
import type { SafetyConcernInput } from '$lib/domain/types.js';
import { handleServiceError } from '$lib/server/handle-service-error.js';
import { getSafetyReportingEnabled } from '$lib/server/app-settings.js';

const SCOPES = ['person', 'gathering'] as const;
const KINDS = ['no_show', 'felt_unsafe', 'other'] as const;
const MAX_DETAIL = 2000;

/** POST /api/feedback/gathering/concern — file a confidential safeguarding
 *  concern about a co-participant or the meeting. Gated by the reporting
 *  kill-switch (dark until retention + Datenschutz are cleared, R9); the RPC
 *  enforces the scheduled-co-membership gate. Never returns concern content. */
export const POST: RequestHandler = async ({ request, locals }) => {
	requireIdentity(locals);

	// Kill-switch: the store is sensitive personal data and ships dark (R9).
	if (!(await getSafetyReportingEnabled())) {
		return json({ error: 'not_available' }, { status: 403 });
	}

	const [body, errorResponse] = await parseJsonBody<SafetyConcernInput>(request);
	if (errorResponse) return errorResponse;

	if (typeof body.slot_id !== 'string' || body.slot_id.length === 0) {
		return json({ error: 'slot_id is required' }, { status: 400 });
	}
	if (typeof body.scope !== 'string' || !SCOPES.includes(body.scope)) {
		return json({ error: 'scope is invalid' }, { status: 400 });
	}
	if (typeof body.kind !== 'string' || !KINDS.includes(body.kind)) {
		return json({ error: 'kind is invalid' }, { status: 400 });
	}
	if (body.scope === 'person' && (typeof body.subject_id !== 'string' || body.subject_id.length === 0)) {
		return json({ error: 'subject_id is required for a person-scoped concern' }, { status: 400 });
	}
	if (body.scope === 'gathering' && body.subject_id != null) {
		return json({ error: 'subject_id must be absent for a gathering-scoped concern' }, { status: 400 });
	}
	if (
		body.gathering_id != null &&
		(typeof body.gathering_id !== 'string' || body.gathering_id.length === 0)
	) {
		return json({ error: 'Invalid gathering_id' }, { status: 400 });
	}
	if (
		body.detail !== undefined &&
		body.detail !== null &&
		(typeof body.detail !== 'string' || body.detail.length > MAX_DETAIL)
	) {
		return json({ error: 'Invalid detail' }, { status: 400 });
	}

	const service = new SupabaseFeedbackService(locals.supabase);
	try {
		await service.submitConcern({
			slot_id: body.slot_id,
			scope: body.scope,
			kind: body.kind,
			subject_id: body.scope === 'person' ? body.subject_id : null,
			gathering_id: body.gathering_id ?? null,
			detail: body.detail?.trim() || null
		});
		return json({ ok: true });
	} catch (err) {
		return handleServiceError(err, '[feedback/gathering/concern]');
	}
};
