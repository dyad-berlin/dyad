import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireIdentity } from '$lib/services/identity.js';
import { parseJsonBody } from '$lib/server/parse-body.js';
import { getSafetyReportingEnabled } from '$lib/server/app-settings.js';

const KINDS = ['no_show', 'felt_unsafe', 'other'];
const MAX_DETAIL = 2000;

interface ConcernBody {
	slotId?: string;
	reportedId?: string;
	kind?: string;
	detail?: string;
}

/**
 * POST /api/feedback/concern — file a confidential safety concern about a
 * co-participant of a gathering. Gated behind the safety_reporting_enabled flag
 * (off until the U5 privacy/legal go-live gate clears). The confidentiality and
 * co-participant constraints are enforced in RLS on safety_concerns; this handler
 * validates shape and reports a generic outcome (never who/why on failure).
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const actor = requireIdentity(locals);

	if (!(await getSafetyReportingEnabled())) {
		return json({ error: 'not_available' }, { status: 403 });
	}

	const [body, errorResponse] = await parseJsonBody<ConcernBody>(request);
	if (errorResponse) return errorResponse;

	if (typeof body.slotId !== 'string' || typeof body.reportedId !== 'string') {
		return json({ error: 'Invalid target' }, { status: 400 });
	}
	if (!KINDS.includes(body.kind ?? '')) {
		return json({ error: 'Invalid kind' }, { status: 400 });
	}
	if (body.detail !== undefined && (typeof body.detail !== 'string' || body.detail.length > MAX_DETAIL)) {
		return json({ error: 'Invalid detail' }, { status: 400 });
	}
	if (body.reportedId === actor.id) {
		return json({ error: 'cannot_report_self' }, { status: 400 });
	}

	// Insert through the request's authed client so RLS enforces reporter = self
	// and co-participant-of-slot. A policy denial (42501) means the actor/target
	// weren't co-participants — surface it as a generic 403.
	const { error } = await locals.supabase.from('safety_concerns').insert({
		slot_id: body.slotId,
		reported_id: body.reportedId,
		reporter_id: actor.id,
		kind: body.kind,
		detail: body.detail?.trim() || null
	});

	if (error) {
		console.error('[feedback/concern] insert failed:', error.message);
		return json(
			{ error: error.code === '42501' ? 'not_a_participant' : 'could_not_file' },
			{ status: error.code === '42501' ? 403 : 500 }
		);
	}

	return json({ ok: true }, { status: 201 });
};
