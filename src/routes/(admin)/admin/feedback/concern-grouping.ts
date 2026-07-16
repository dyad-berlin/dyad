// Steward review surface — enrichment + per-subject grouping for confidential
// safety concerns (feat: unified gathering feedback, U7).
//
// Pure, side-effect-free logic so it is unit-testable without a SvelteKit/DB
// harness. The loader (+page.server.ts) fetches raw rows via the SERVICE-ROLE
// client (the only sanctioned read path for safety_concerns — RLS bypass) and
// hands them here for display-name resolution, context enrichment, and the
// per-subject grouping that surfaces PATTERNS (R4): one coherent picture per
// reported person, most-recent-first, with a prior-concern count.
//
// Nothing here writes back to safety_concerns — that would need a SELECT/UPDATE
// policy and puncture the structural no-read guarantee (KTD3).

import type { SafetyConcern } from '$lib/domain/types';

// Minimal shapes of the lookup rows the loader fetches (service-role reads).
export interface ProfileRow {
	id: string;
	username: string | null;
	display_name: string | null;
}

export interface IdentityRow {
	id: string;
	substrate: string;
	substrate_id: string;
}

export interface SlotContextRow {
	id: string; // time_slots.id
	prompt_id: string;
	start_time: string | null;
	general_area: string | null;
}

export interface PromptRow {
	id: string;
	title: string | null;
}

export interface ConcernContext {
	profiles: ProfileRow[];
	identities: IdentityRow[];
	slots: SlotContextRow[];
	prompts: PromptRow[];
}

// A concern with reporter/subject display names and gathering/slot context
// resolved onto it, ready to render.
export interface EnrichedConcern {
	id: string;
	slot_id: string;
	gathering_id: string | null;
	scope: SafetyConcern['scope'];
	kind: SafetyConcern['kind'];
	detail: string | null;
	created_at: string;
	reporter_id: string;
	reporter_name: string;
	subject_id: string | null;
	subject_name: string | null;
	prompt_title: string | null;
	slot_start_time: string | null;
	neighbourhood: string | null;
}

// A reported person's full concern history — the coherent per-user picture a
// steward reviews (R2/R4).
export interface SubjectGroup {
	subject_id: string;
	subject_name: string;
	count: number;
	// Concerns about this subject, most-recent-first.
	concerns: EnrichedConcern[];
	// Timestamp of the most recent concern — used to order groups.
	latest_at: string;
}

export interface ConcernReview {
	// Per-subject histories, ordered so the most recently active subject leads
	// and (tie-broken) the subject with the most concerns surfaces (R4).
	subjectGroups: SubjectGroup[];
	// Gathering-scoped concerns name no person (scope='gathering'); reviewed as
	// a flat list, most-recent-first.
	meetingScoped: EnrichedConcern[];
	total: number;
}

/**
 * Resolve a member id to a human-shown name.
 *
 * Mirrors the admin plane's existing resolution (profiles.id === identity id
 * for Supabase-substrate members; see admin_member_activity + the identities
 * backfill), preferring display_name, then @username.
 *
 * PROVIDER-IDENTITY FALLBACK: a provider identity (e.g. atproto) has an
 * identities row but NO profiles row (profiles.id FKs auth.users, which a
 * provider identity never populates). Rather than crash or render "unknown",
 * fall back to the identity's substrate handle ("atproto:did:plc:…"), then the
 * bare id — so a steward always sees *something* stable to key on.
 */
export function resolveDisplayName(
	id: string,
	profilesById: Map<string, ProfileRow>,
	identitiesById: Map<string, IdentityRow>
): string {
	const profile = profilesById.get(id);
	if (profile) {
		if (profile.display_name && profile.display_name.trim()) return profile.display_name;
		if (profile.username && profile.username.trim()) return `@${profile.username}`;
	}
	const identity = identitiesById.get(id);
	if (identity) return `${identity.substrate}:${identity.substrate_id}`;
	return id;
}

/**
 * Enrich raw concern rows with display names + gathering/slot context, then
 * group person-scoped concerns per subject (most-recent-first within a subject;
 * groups ordered most-recently-active first, ties broken by concern count) so a
 * steward reads one coherent per-user history (R2/R4). Gathering-scoped concerns
 * (no subject) are returned as a separate flat, most-recent-first list.
 */
export function buildConcernReview(
	concerns: SafetyConcern[],
	context: ConcernContext
): ConcernReview {
	const profilesById = new Map(context.profiles.map((p) => [p.id, p]));
	const identitiesById = new Map(context.identities.map((i) => [i.id, i]));
	const slotsById = new Map(context.slots.map((s) => [s.id, s]));
	const promptsById = new Map(context.prompts.map((p) => [p.id, p]));

	const enriched: EnrichedConcern[] = concerns.map((c) => {
		const slot = slotsById.get(c.slot_id) ?? null;
		const prompt = slot ? (promptsById.get(slot.prompt_id) ?? null) : null;
		return {
			id: c.id,
			slot_id: c.slot_id,
			gathering_id: c.gathering_id,
			scope: c.scope,
			kind: c.kind,
			detail: c.detail,
			created_at: c.created_at,
			reporter_id: c.reporter_id,
			reporter_name: resolveDisplayName(c.reporter_id, profilesById, identitiesById),
			subject_id: c.subject_id,
			subject_name: c.subject_id
				? resolveDisplayName(c.subject_id, profilesById, identitiesById)
				: null,
			prompt_title: prompt?.title ?? null,
			slot_start_time: slot?.start_time ?? null,
			neighbourhood: slot?.general_area ?? null
		};
	});

	// Partition: person-scoped (grouped by subject) vs gathering-scoped (flat).
	const groupsBySubject = new Map<string, EnrichedConcern[]>();
	const meetingScoped: EnrichedConcern[] = [];
	for (const c of enriched) {
		if (c.subject_id) {
			const bucket = groupsBySubject.get(c.subject_id);
			if (bucket) bucket.push(c);
			else groupsBySubject.set(c.subject_id, [c]);
		} else {
			meetingScoped.push(c);
		}
	}

	const subjectGroups: SubjectGroup[] = [...groupsBySubject.entries()].map(
		([subject_id, rows]) => {
			const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
			return {
				subject_id,
				subject_name: sorted[0].subject_name ?? subject_id,
				count: sorted.length,
				concerns: sorted,
				latest_at: sorted[0].created_at
			};
		}
	);

	// Order groups so the most recently active subject leads; break ties by the
	// larger history (a subject with more concerns surfaces above an equally
	// recent one), then by name for determinism.
	subjectGroups.sort((a, b) => {
		const byRecency = b.latest_at.localeCompare(a.latest_at);
		if (byRecency !== 0) return byRecency;
		if (b.count !== a.count) return b.count - a.count;
		return a.subject_name.localeCompare(b.subject_name);
	});

	meetingScoped.sort((a, b) => b.created_at.localeCompare(a.created_at));

	return { subjectGroups, meetingScoped, total: enriched.length };
}
