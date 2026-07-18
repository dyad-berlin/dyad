import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireIdentity } from '$lib/services/identity.js';
import { SupabaseFeedbackService } from '$lib/services/feedback.js';
import { getSafetyReportingEnabled } from '$lib/server/app-settings.js';
import { handleServiceError } from '$lib/server/handle-service-error.js';

/**
 * GET /api/feedback/gathering/[id] — read the gathering feedback form state
 * (agent-parity, #60). Mirrors the UI loader at
 * src/routes/(app)/feedback/gathering/[id]/+page.server.ts so a programmatic
 * caller that hits the gathering gate (403 { kind:'gathering', formId }) can READ
 * the form — roster, vocabulary, host flag, and whether the safeguarding channel
 * is open — without scraping the HTML page, then POST to attendance / public /
 * concern. Same auth + RLS posture as the loader; no existence leak, no internal
 * detail.
 *
 * Responses:
 *   401                              — unauthenticated (thrown by requireIdentity)
 *   404 { error: 'not_found' }       — no such gathering, or the caller is not a
 *                                      participant (RLS returns nothing — no leak)
 *   200 { status: 'done' }           — the caller already confirmed attendance;
 *                                      nothing is due (mirrors the loader redirect)
 *   200 { status: 'due', ... }       — the form is due; payload mirrors the loader
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const upactor = requireIdentity(locals);
	const userId = upactor.id;
	const service = new SupabaseFeedbackService(locals.supabase);

	try {
		// The gathering — readable under RLS only if the caller participates (U1).
		const { data: gathering } = await locals.supabase
			.from('gatherings')
			.select('id, slot_id')
			.eq('id', params.id)
			.maybeSingle();

		if (!gathering) {
			// Not a participant (or no such gathering) — no existence leak.
			return json({ error: 'not_found' }, { status: 404 });
		}

		// The caller's own participation row (own-row RLS). self_report carries the
		// obligation state: NULL = due, non-NULL = already confirmed.
		const { data: participation } = await locals.supabase
			.from('participation')
			.select('is_host, self_report')
			.eq('gathering_id', gathering.id)
			.eq('member_id', userId)
			.maybeSingle();

		if (!participation) {
			return json({ error: 'not_found' }, { status: 404 });
		}

		// Already confirmed (mirrors the loader's redirect-when-submitted) — the
		// obligation is cleared, so there is nothing for an agent to fill.
		if (participation.self_report !== null) {
			return json({ status: 'done' });
		}

		// Roster (co-participants, caller excluded) + active tag vocabulary + the
		// safety-reporting kill-switch, in parallel — independent reads (CLAUDE.md).
		// When the kill-switch is off the concern affordance is HIDDEN, not
		// shown-then-403'd — identical to the loader.
		const [roster, vocabulary, safetyReportingEnabled] = await Promise.all([
			service.getGatheringRoster(gathering.id).catch(() => []),
			service.getVocabulary().catch(() => []),
			getSafetyReportingEnabled().catch(() => false)
		]);

		return json({
			status: 'due',
			gatheringId: gathering.id,
			slotId: gathering.slot_id,
			isHost: participation.is_host,
			roster,
			vocabulary,
			safetyReportingEnabled
		});
	} catch (err) {
		return handleServiceError(err, '[feedback/gathering/get]');
	}
};
