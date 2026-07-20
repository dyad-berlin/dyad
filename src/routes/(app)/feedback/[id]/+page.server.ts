import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireIdentity } from '$lib/services/identity.js';
import { SupabaseFeedbackService } from '$lib/services/feedback.js';
import type { RevealedFeedback, ReputationSignal } from '$lib/domain/types.js';

export const load: PageServerLoad = async ({ params, locals }) => {
	const upactor = requireIdentity(locals);
	const userId = upactor.id;
	const service = new SupabaseFeedbackService(locals.supabase);

	const [form, vocabulary] = await Promise.all([
		service.getFormById(params.id, userId).catch(() => null),
		service.getVocabulary()
	]);

	if (!form) {
		redirect(302, '/discover');
	}

	// not_due → redirect to meeting detail (bookmarked URL guard)
	if (form.state === 'not_due') {
		redirect(302, `/meetings/${form.meeting_id}`);
	}

	// Load revealed feedback for locked/released forms — the current user is
	// the REVIEWEE for these rows (what the other person said about them),
	// even though this route is where they submit their own review of the
	// other person. Same reviewee identity owns any reputation signal for
	// this meeting, so the feature-on-profile toggle uses the same userId.
	let revealedFeedback: RevealedFeedback[] = [];
	let reputationSignal: ReputationSignal | null = null;
	if (form.state === 'locked' || form.state === 'released') {
		[revealedFeedback, reputationSignal] = await Promise.all([
			service.getRevealedFeedback(form.meeting_id, userId),
			service.getReputationSignalForMeeting(form.meeting_id, userId)
		]);
	}

	// Load meeting context (other participant + meeting date)
	let meetingContext: { otherUsername: string; meetingDate: string } | null = null;
	if (form.meeting_id) {
		const { data: meeting } = await locals.supabase
			.from('meetings')
			.select('scheduled_time, participant_a, participant_b, prompt_id')
			.eq('id', form.meeting_id)
			.single();

		if (meeting) {
			const otherId = meeting.participant_a === userId ? meeting.participant_b : meeting.participant_a;
			const { data: otherProfile } = await locals.supabase.from('profiles').select('username').eq('id', otherId).single();
			meetingContext = {
				otherUsername: otherProfile?.username ?? 'someone',
				meetingDate: new Date(meeting.scheduled_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
			};
		}
	}

	return { form, vocabulary, meetingContext, revealedFeedback, reputationSignal };
};
