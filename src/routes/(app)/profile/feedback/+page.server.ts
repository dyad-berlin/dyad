import type { PageServerLoad } from './$types';
import type { FeedbackReceivedContent } from '$lib/domain/types.js';
import { requireIdentity } from '$lib/services/identity.js';
import { SupabaseFeedbackService } from '$lib/services/feedback.js';

export const load: PageServerLoad = async ({ locals }) => {
	const upactor = requireIdentity(locals);

	const myReputationSignals = await new SupabaseFeedbackService(
		locals.supabase
	).getMyReputationSignals(upactor.id);

	return {
		receivedFeedback: myReputationSignals
			.map((s) => {
				const content = s.content as unknown as FeedbackReceivedContent;
				return {
					signalId: s.id,
					visible: s.visible,
					quote: content.quote ?? null,
					tags: content.tags ?? []
				};
			})
			// Same gate as the inline surfaces (/feedback/[id], /meetings/[id]):
			// a signal with neither quote nor tags (e.g. a no-show form) has
			// nothing to feature — listing it would render an unlabelled checkbox
			// that publishes an empty card.
			.filter((fb) => fb.quote || fb.tags.length > 0)
	};
};
