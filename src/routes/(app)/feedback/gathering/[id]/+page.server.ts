import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireIdentity } from '$lib/services/identity.js';
import { SupabaseFeedbackService } from '$lib/services/feedback.js';
import { getSafetyReportingEnabled } from '$lib/server/app-settings.js';

export const load: PageServerLoad = async ({ params, locals }) => {
	const upactor = requireIdentity(locals);
	const userId = upactor.id;
	const service = new SupabaseFeedbackService(locals.supabase);

	// The gathering — readable under RLS only if the caller participates (U1).
	const { data: gathering } = await locals.supabase
		.from('gatherings')
		.select('id, slot_id')
		.eq('id', params.id)
		.maybeSingle();

	if (!gathering) {
		// Not a participant (or no such gathering) — no existence leak, just go home.
		redirect(302, '/discover');
	}

	// The caller's own participation row (own-row RLS). Its self_report carries the
	// obligation state: NULL = due, non-NULL = already confirmed.
	const { data: participation } = await locals.supabase
		.from('participation')
		.select('is_host, self_report')
		.eq('gathering_id', gathering.id)
		.eq('member_id', userId)
		.maybeSingle();

	if (!participation) {
		redirect(302, '/discover');
	}

	// Already confirmed attendance (bookmarked URL / back button) — nothing due.
	// Mirrors the group form's redirect-when-submitted.
	if (participation.self_report !== null) {
		redirect(302, '/discover');
	}

	// Roster (co-participants, caller excluded) + active tag vocabulary + the
	// safety-reporting kill-switch, in parallel — independent reads (CLAUDE.md).
	// The concern channel is a sensitive-data surface gated on R9 (retention /
	// Datenschutz): when the kill-switch is off the affordance is HIDDEN, not
	// shown-then-403'd — a "report unsafe" button that fails is the wrong UX for
	// a safeguarding feature. The submit endpoint enforces the same flag.
	const [roster, vocabulary, safetyReportingEnabled] = await Promise.all([
		service.getGatheringRoster(gathering.id).catch(() => []),
		service.getVocabulary().catch(() => []),
		getSafetyReportingEnabled().catch(() => false)
	]);

	return {
		gatheringId: gathering.id,
		slotId: gathering.slot_id,
		isHost: participation.is_host,
		roster,
		vocabulary,
		safetyReportingEnabled
	};
};
