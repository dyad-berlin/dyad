import type { PageServerLoad } from './$types';
import type { FeedbackReceivedContent } from '$lib/domain/types.js';
import { requireIdentity } from '$lib/services/identity.js';
import { EMAIL_NOTIFICATIONS_DEFAULT } from '$lib/domain/types.js';
import { SupabaseFeedbackService } from '$lib/services/feedback.js';

export const load: PageServerLoad = async ({ locals }) => {
	const upactor = requireIdentity(locals);

	// This page only loads notification settings. Membership management moved to
	// /profile/membership, which reads membership state from the (app) layout loader.
	const [{ data, error }, myReputationSignals] = await Promise.all([
		locals.supabase
			.from('notification_settings')
			.select('email, invitation_received, invitation_answered, meeting_cancelled')
			.eq('user_id', upactor.id)
			.maybeSingle(),
		new SupabaseFeedbackService(locals.supabase).getMyReputationSignals(upactor.id)
	]);

	// A failed read renders the opted-out defaults; log so it isn't silent.
	if (error) {
		console.error('[preferences loader] notification_settings fetch failed:', error);
	}

	return {
		settings: {
			email: data?.email ?? null,
			invitation_received: data?.invitation_received ?? EMAIL_NOTIFICATIONS_DEFAULT,
			invitation_answered: data?.invitation_answered ?? EMAIL_NOTIFICATIONS_DEFAULT,
			meeting_cancelled: data?.meeting_cancelled ?? EMAIL_NOTIFICATIONS_DEFAULT
		},
		receivedFeedback: myReputationSignals.map((s) => {
			const content = s.content as unknown as FeedbackReceivedContent;
			return {
				signalId: s.id,
				visible: s.visible,
				quote: content.quote ?? null,
				tags: content.tags ?? []
			};
		})
	};
};
