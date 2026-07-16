import { makeAdminClient } from '$lib/server/supabase-admin';
import type { SafetyConcern } from '$lib/domain/types';
import { buildConcernReview, type ConcernContext } from './concern-grouping';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Admin plane: service-role client, no user/session context. This is the
	// ONLY sanctioned read path for safety_concerns — the table has no SELECT
	// policy or grant, so an authenticated caller reads nothing; the service
	// role bypasses RLS (KTD3). Reached only behind the Cloudflare-Access admin
	// gate (see src/lib/server/admin-auth.ts).
	const supabase = makeAdminClient();

	// App feedback + confidential concerns are independent queries — run them in
	// parallel (CLAUDE.md: independent async ops use Promise.all).
	const [{ data: feedbackEntries }, { data: concernRows, error: concernError }] =
		await Promise.all([
			supabase
				.from('feedback')
				.select('id, user_id, type, description, status, created_at')
				.order('created_at', { ascending: false }),
			// Per-subject history newest-first (idx_safety_concerns_subject); the
			// grouping below re-orders for the steward view.
			supabase
				.from('safety_concerns')
				.select(
					'id, slot_id, gathering_id, reporter_id, subject_id, scope, kind, detail, created_at'
				)
				.order('created_at', { ascending: false })
		]);

	// ── App feedback (unchanged) ──────────────────────────────────────────────
	// Look up usernames for user_ids (no FK — parallel lookup pattern)
	const userIds = [...new Set((feedbackEntries ?? []).map((f) => f.user_id))];
	const { data: feedbackProfiles } =
		userIds.length > 0
			? await supabase.from('profiles').select('id, username').in('id', userIds)
			: { data: [] };

	const usernameMap = new Map((feedbackProfiles ?? []).map((p: any) => [p.id, p.username]));

	const entries = (feedbackEntries ?? []).map((f) => ({
		...f,
		username: usernameMap.get(f.user_id) ?? null
	}));

	// ── Confidential safety concerns (U7) ─────────────────────────────────────
	if (concernError) {
		// Never leak internal error detail to the client (CLAUDE.md).
		console.error('[admin/feedback] safety_concerns query failed:', concernError.message);
		return { entries, concernReview: { subjectGroups: [], meetingScoped: [], total: 0 } };
	}

	const concerns = (concernRows ?? []) as SafetyConcern[];

	// Enrich with member display names + gathering/slot context. Gather the ids
	// we need to resolve, then fetch context in parallel.
	const memberIds = [
		...new Set(
			concerns.flatMap((c) => [c.reporter_id, c.subject_id]).filter((id): id is string => !!id)
		)
	];
	const slotIds = [...new Set(concerns.map((c) => c.slot_id))];

	const [{ data: profiles }, { data: identities }, { data: slots }] = await Promise.all([
		memberIds.length > 0
			? supabase.from('profiles').select('id, username, display_name').in('id', memberIds)
			: Promise.resolve({ data: [] as ConcernContext['profiles'] }),
		// Provider identities (e.g. atproto) have no profiles row — carry the
		// identities rows so resolveDisplayName can fall back to the substrate
		// handle rather than crashing / rendering "unknown".
		memberIds.length > 0
			? supabase.from('identities').select('id, substrate, substrate_id').in('id', memberIds)
			: Promise.resolve({ data: [] as ConcernContext['identities'] }),
		slotIds.length > 0
			? supabase
					.from('time_slots')
					.select('id, prompt_id, start_time, general_area')
					.in('id', slotIds)
			: Promise.resolve({ data: [] as ConcernContext['slots'] })
	]);

	const promptIds = [...new Set((slots ?? []).map((s) => s.prompt_id))];
	const { data: prompts } =
		promptIds.length > 0
			? await supabase.from('prompts').select('id, title').in('id', promptIds)
			: { data: [] as ConcernContext['prompts'] };

	const concernReview = buildConcernReview(concerns, {
		profiles: (profiles ?? []) as ConcernContext['profiles'],
		identities: (identities ?? []) as ConcernContext['identities'],
		slots: (slots ?? []) as ConcernContext['slots'],
		prompts: (prompts ?? []) as ConcernContext['prompts']
	});

	return { entries, concernReview };
};
