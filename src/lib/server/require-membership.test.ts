import { describe, it, expect, vi, beforeEach } from 'vitest';

// The gate reads gating config + the free-interaction quota from app-settings and
// counts the actor's gated artifacts via the service-role admin client. Mock all
// three so each test can pit an actor's membership state against a quota/used pair.
const { getMembershipGating, getFreeInteractionQuota, makeAdminClient } = vi.hoisted(() => ({
	getMembershipGating: vi.fn(),
	getFreeInteractionQuota: vi.fn(),
	makeAdminClient: vi.fn()
}));
vi.mock('$lib/server/app-settings', () => ({ getMembershipGating, getFreeInteractionQuota }));
vi.mock('$lib/server/supabase-admin', () => ({ makeAdminClient }));

const { requireMembershipForAction } = await import('./require-membership.js');

interface LocalsOpts {
	user?: { id: string } | null;
	row?: { active: boolean; cadence?: string | null; source?: string } | null;
	readError?: { message: string } | null;
}

function makeLocals(opts: LocalsOpts) {
	return {
		user: opts.user === undefined ? { id: 'actor-1' } : opts.user,
		supabase: {
			from: () => ({
				select: () => ({
					eq: () => ({
						maybeSingle: async () => ({ data: opts.row ?? null, error: opts.readError ?? null })
					})
				})
			})
		}
	} as unknown as App.Locals;
}

/** Program the admin client's per-table COUNT results (head+exact). The gate sums
 *  prompts + prompt_comments + prompt_invitations; default every table to 0. Pass
 *  `error` to make a count fail (the gate should then fail open). */
function mockAdminCounts(
	counts: Partial<Record<'prompts' | 'prompt_comments' | 'prompt_invitations', number>> = {},
	error: { message: string } | null = null
) {
	makeAdminClient.mockReturnValue({
		from: (table: string) => ({
			select: () => ({
				eq: () =>
					Promise.resolve(
						error
							? { count: null, error }
							: { count: counts[table as keyof typeof counts] ?? 0, error: null }
					)
			})
		})
	});
}

describe('requireMembershipForAction', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		getMembershipGating.mockReset().mockResolvedValue({ create_conversation: true });
		getFreeInteractionQuota.mockReset().mockResolvedValue(1);
		mockAdminCounts(); // used = 0 by default
	});

	it('allows when the action is not gated', async () => {
		getMembershipGating.mockResolvedValue({ respond_take_slot: true }); // create off
		expect(await requireMembershipForAction('create_conversation', makeLocals({}))).toBeNull();
	});

	it('allows an active member', async () => {
		const res = await requireMembershipForAction('create_conversation', makeLocals({ row: { active: true } }));
		expect(res).toBeNull();
	});

	// ── Free-interaction quota: the first N gated actions are free ──────────────

	it('allows a never-member still under the free quota (used < N)', async () => {
		// used = 0, N = 1 → the one free action is allowed, no 403.
		const res = await requireMembershipForAction('create_conversation', makeLocals({ row: null }));
		expect(res).toBeNull();
	});

	it('allows an inactive member still under the free quota', async () => {
		mockAdminCounts({ prompts: 0 });
		const res = await requireMembershipForAction(
			'create_conversation',
			makeLocals({ row: { active: false, cadence: 'monthly', source: 'paid' } })
		);
		expect(res).toBeNull();
	});

	it('403s once the free quota is exhausted (used >= N)', async () => {
		mockAdminCounts({ prompts: 1 }); // used = 1, N = 1 → exhausted
		const res = await requireMembershipForAction('create_conversation', makeLocals({ row: null }));
		expect(res?.status).toBe(403);
	});

	it('counts gated artifacts across all three tables against the quota', async () => {
		getFreeInteractionQuota.mockResolvedValue(3);
		mockAdminCounts({ prompts: 1, prompt_comments: 1, prompt_invitations: 1 }); // used = 3, N = 3
		const res = await requireMembershipForAction('create_conversation', makeLocals({ row: null }));
		expect(res?.status).toBe(403);
	});

	// ── 403 shape + reason (quota exhausted so the condition path is exercised) ──

	it('403s a lapsed paid member with had_membership:true and reason renew', async () => {
		mockAdminCounts({ prompts: 1 });
		const res = await requireMembershipForAction(
			'create_conversation',
			makeLocals({ row: { active: false, cadence: 'monthly', source: 'paid' } })
		);
		expect(res?.status).toBe(403);
		expect(await res?.json()).toEqual({
			error: 'membership_required',
			action: 'create_conversation',
			had_membership: true,
			reason: 'renew'
		});
	});

	it('403s a never-member guest with had_membership:false and reason join', async () => {
		mockAdminCounts({ prompts: 1 });
		const res = await requireMembershipForAction('create_conversation', makeLocals({ row: null }));
		expect(res?.status).toBe(403);
		expect(await res?.json()).toMatchObject({
			error: 'membership_required',
			had_membership: false,
			reason: 'join'
		});
	});

	it('403s an abandoned-checkout row (never activated) with reason join', async () => {
		// Matches toMembershipDisplay/wasEverAMember: a paid row with a null cadence
		// never activated, so the gate says "join", not "renew".
		mockAdminCounts({ prompts: 1 });
		const res = await requireMembershipForAction(
			'create_conversation',
			makeLocals({ row: { active: false, cadence: null, source: 'paid' } })
		);
		expect(res?.status).toBe(403);
		expect(await res?.json()).toMatchObject({ had_membership: false, reason: 'join' });
	});

	it('403s an ended non-paid grant with reason ended', async () => {
		// Was a real membership (a grant), now inactive; nothing to self-renew.
		mockAdminCounts({ prompts: 1 });
		const res = await requireMembershipForAction(
			'create_conversation',
			makeLocals({ row: { active: false, cadence: null, source: 'grant' } })
		);
		expect(res?.status).toBe(403);
		expect(await res?.json()).toMatchObject({ had_membership: true, reason: 'ended' });
	});

	// ── Fail-open behaviour: a read blip never wrongly blocks ───────────────────

	it('fails open (allows) on a membership read error', async () => {
		const res = await requireMembershipForAction(
			'create_conversation',
			makeLocals({ readError: { message: 'pg down' } })
		);
		expect(res).toBeNull();
	});

	it('fails open (allows) when the gating config read throws', async () => {
		getMembershipGating.mockRejectedValue(new Error('settings down'));
		expect(await requireMembershipForAction('create_conversation', makeLocals({}))).toBeNull();
	});

	it('fails open (allows) when the free-quota count throws', async () => {
		mockAdminCounts({}, { message: 'count failed' });
		const res = await requireMembershipForAction('create_conversation', makeLocals({ row: null }));
		expect(res).toBeNull();
	});

	it('throws 401 when unauthenticated', async () => {
		await expect(
			requireMembershipForAction('create_conversation', makeLocals({ user: null }))
		).rejects.toMatchObject({ status: 401 });
	});
});
