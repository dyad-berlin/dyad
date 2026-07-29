import type { PageServerLoad } from './$types';
import { SupabasePromptQueryService } from '$lib/services/prompt-query.js';
import { regionMapCenter, resolveViewRegion } from '$lib/services/location.js';

// Feed page size — see the comment at the call site.
const DISCOVER_FEED_LIMIT = 60;

export const load: PageServerLoad = async ({ locals }) => {
	// Auth guard handled by (app)/+layout.server.ts
	const service = new SupabasePromptQueryService(locals.supabase);

	// Guests are pinned to their corner's region; other members follow the
	// host they arrived on (dyad.amsterdam → Amsterdam), so a multi-region
	// member sees the region matching the domain. See migration 20260605100200.
	const region = resolveViewRegion({
		homeScope: locals.homeScope,
		homeRegion: locals.homeRegion,
		hostRegion: locals.hostRegion
	});

	const [prompts, corpus] = await Promise.all([
		service.getPublishedPrompts({
			region,
			userId: locals.user!.id,
			scopes: locals.scopes,
			homeScope: locals.homeScope,
			// Sized to the scheduling horizon, not the old default of 20: the
			// When filter reaches 28 days ahead, and a page holding only the 20
			// soonest conversations could answer a far-date filter with "no
			// matches" while matching conversations exist beyond the page.
			// Server-side date filtering is the scale path when volume makes
			// this too heavy (review 20260729-110546 finding #8).
			limit: DISCOVER_FEED_LIMIT
		}),
		service.getSearchCorpus(region, locals.scopes, locals.homeScope)
	]);

	// Enrich search corpus with username + soonest_slot from the already-fetched prompts
	const promptMeta = new Map(prompts.map(p => [p.id, { username: p.author_username, soonest_slot: p.soonest_slot ?? null }]));
	const searchCorpus = corpus.map(c => ({
		...c,
		username: promptMeta.get(c.id)?.username ?? '',
		soonest_slot: promptMeta.get(c.id)?.soonest_slot ?? null
	}));

	return {
		prompts,
		searchCorpus,
		mapCenter: regionMapCenter(region),
		isGuest: locals.homeScope !== null
	};
};
