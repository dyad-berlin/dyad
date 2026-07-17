import { describe, it, expect } from 'vitest';
import {
	buildConcernReview,
	resolveDisplayName,
	type ConcernContext,
	type ProfileRow,
	type IdentityRow
} from './concern-grouping';
import type { SafetyConcern } from '$lib/domain/types';

function concern(overrides: Partial<SafetyConcern>): SafetyConcern {
	return {
		id: 'c-' + Math.random().toString(36).slice(2),
		slot_id: 'slot-1',
		gathering_id: null,
		reporter_id: 'reporter-1',
		subject_id: 'subject-1',
		scope: 'person',
		kind: 'no_show',
		detail: null,
		created_at: '2026-07-15T10:00:00Z',
		...overrides
	};
}

const emptyContext: ConcernContext = { profiles: [], identities: [], slots: [], prompts: [] };

describe('resolveDisplayName', () => {
	const profiles = new Map<string, ProfileRow>([
		['p-display', { id: 'p-display', username: 'alice', display_name: 'Alice A.' }],
		['p-username', { id: 'p-username', username: 'bob', display_name: null }],
		['p-blank', { id: 'p-blank', username: '  ', display_name: '  ' }]
	]);
	const identities = new Map<string, IdentityRow>([
		['prov-1', { id: 'prov-1', substrate: 'atproto', substrate_id: 'did:plc:xyz' }]
	]);

	it('prefers display_name', () => {
		expect(resolveDisplayName('p-display', profiles, identities)).toBe('Alice A.');
	});

	it('falls back to @username when no display_name', () => {
		expect(resolveDisplayName('p-username', profiles, identities)).toBe('@bob');
	});

	it('falls back to substrate handle for a provider identity with no profile', () => {
		// Provider-identity fallback: atproto has an identities row but no profiles row.
		expect(resolveDisplayName('prov-1', profiles, identities)).toBe('atproto:did:plc:xyz');
	});

	it('falls back to the bare id when nothing resolves', () => {
		expect(resolveDisplayName('ghost', profiles, identities)).toBe('ghost');
	});

	it('skips blank profile fields and falls back', () => {
		expect(resolveDisplayName('p-blank', profiles, identities)).toBe('p-blank');
	});
});

describe('buildConcernReview — per-subject grouping (R2/R4)', () => {
	it('groups a subject’s concerns from different gatherings as one history', () => {
		// AE2: concerns about the same subject from two different slots (1-on-1 + group)
		// read as a single steward history.
		const concerns = [
			concern({ id: 'a', subject_id: 'subj', slot_id: 'slot-1o1', created_at: '2026-07-10T09:00:00Z' }),
			concern({ id: 'b', subject_id: 'subj', slot_id: 'slot-grp', created_at: '2026-07-14T09:00:00Z' })
		];
		const review = buildConcernReview(concerns, emptyContext);
		expect(review.subjectGroups).toHaveLength(1);
		expect(review.subjectGroups[0].subject_id).toBe('subj');
		expect(review.subjectGroups[0].count).toBe(2);
		// Most-recent-first within the group.
		expect(review.subjectGroups[0].concerns.map((c) => c.id)).toEqual(['b', 'a']);
		expect(review.subjectGroups[0].latest_at).toBe('2026-07-14T09:00:00Z');
	});

	it('orders groups most-recently-active first', () => {
		const concerns = [
			concern({ id: 'old', subject_id: 'stale', created_at: '2026-07-01T09:00:00Z' }),
			concern({ id: 'new', subject_id: 'active', created_at: '2026-07-15T09:00:00Z' })
		];
		const review = buildConcernReview(concerns, emptyContext);
		expect(review.subjectGroups.map((g) => g.subject_id)).toEqual(['active', 'stale']);
	});

	it('breaks recency ties by larger concern count (surfaces the pattern)', () => {
		const ts = '2026-07-15T09:00:00Z';
		const concerns = [
			concern({ id: 'x1', subject_id: 'many', created_at: ts }),
			concern({ id: 'x2', subject_id: 'many', created_at: '2026-07-10T09:00:00Z' }),
			concern({ id: 'y1', subject_id: 'few', created_at: ts })
		];
		const review = buildConcernReview(concerns, emptyContext);
		expect(review.subjectGroups.map((g) => g.subject_id)).toEqual(['many', 'few']);
		expect(review.subjectGroups[0].count).toBe(2);
	});

	it('separates gathering-scoped concerns (no subject) into a flat list', () => {
		const concerns = [
			concern({ id: 'g1', subject_id: null, scope: 'gathering', created_at: '2026-07-11T09:00:00Z' }),
			concern({ id: 'g2', subject_id: null, scope: 'gathering', created_at: '2026-07-13T09:00:00Z' }),
			concern({ id: 'p1', subject_id: 'subj', created_at: '2026-07-12T09:00:00Z' })
		];
		const review = buildConcernReview(concerns, emptyContext);
		expect(review.subjectGroups).toHaveLength(1);
		// Meeting-scoped, most-recent-first.
		expect(review.meetingScoped.map((c) => c.id)).toEqual(['g2', 'g1']);
		expect(review.total).toBe(3);
	});

	it('enriches concerns with display names + gathering/slot context', () => {
		const context: ConcernContext = {
			profiles: [
				{ id: 'reporter-1', username: 'rep', display_name: 'Reporter R.' },
				{ id: 'subject-1', username: 'subj', display_name: null }
			],
			identities: [],
			slots: [{ id: 'slot-1', prompt_id: 'prompt-1', start_time: '2026-07-20T18:00:00Z', general_area: 'Kreuzberg' }],
			prompts: [{ id: 'prompt-1', title: 'A walk and a talk' }]
		};
		const review = buildConcernReview([concern({ id: 'e1', detail: 'did not show' })], context);
		const c = review.subjectGroups[0].concerns[0];
		expect(c.reporter_name).toBe('Reporter R.');
		expect(c.subject_name).toBe('@subj');
		expect(c.prompt_title).toBe('A walk and a talk');
		expect(c.slot_start_time).toBe('2026-07-20T18:00:00Z');
		expect(c.neighbourhood).toBe('Kreuzberg');
		expect(c.detail).toBe('did not show');
	});

	it('does not crash on a provider subject with no profile row', () => {
		const context: ConcernContext = {
			profiles: [],
			identities: [{ id: 'subject-1', substrate: 'atproto', substrate_id: 'did:plc:abc' }],
			slots: [],
			prompts: []
		};
		const review = buildConcernReview([concern({})], context);
		expect(review.subjectGroups[0].subject_name).toBe('atproto:did:plc:abc');
	});

	it('returns an empty review for no concerns', () => {
		const review = buildConcernReview([], emptyContext);
		expect(review).toEqual({ subjectGroups: [], meetingScoped: [], total: 0 });
	});
});
