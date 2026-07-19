import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { SupabasePromptQueryService } from '$lib/services/prompt-query.js';
import { SupabaseFeedbackService } from '$lib/services/feedback.js';
import type { FeedbackReceivedContent } from '$lib/domain/types.js';

export const load: PageServerLoad = async ({ params, locals }) => {
	const promptService = new SupabasePromptQueryService(locals.supabase);
	const profile = await promptService.getPublicProfile(params.username, locals.scopes, locals.homeScope);

	if (!profile) {
		error(404, 'User not found');
	}

	// RLS scopes this to visible=true rows for anyone but the profile owner —
	// featured feedback the person has chosen to showcase, anonymous (no
	// reviewer identity travels with the snapshot).
	const feedbackService = new SupabaseFeedbackService(locals.supabase);
	const signals = await feedbackService.getVisibleReputationSignals(profile.id);
	const featuredFeedback = signals.map((s) => {
		const content = s.content as unknown as FeedbackReceivedContent;
		return { quote: content.quote ?? null, tags: content.tags ?? [] };
	});

	return {
		profile: {
			username: profile.username,
			display_name: profile.display_name
		},
		prompts: profile.prompts,
		featuredFeedback
	};
};
