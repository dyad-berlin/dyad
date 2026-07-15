import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isRedirect } from '@sveltejs/kit';

// The create gate is the unit under test: on the virtual `new` path the load
// must send a gated (non-eligible) actor to the paywall before the editor
// renders, and let an eligible actor through. Mock the gate helper + the
// identity/scope deps so the test isolates the branch, not the DB.
const { requireMembershipForAction } = vi.hoisted(() => ({
	requireMembershipForAction: vi.fn()
}));
vi.mock('$lib/server/require-membership.js', () => ({ requireMembershipForAction }));
vi.mock('$lib/services/identity.js', () => ({ requireIdentity: () => ({ id: 'u1' }) }));
vi.mock('$lib/services/scope.js', () => ({
	SupabaseScopeService: class {
		listMyScopes = () => Promise.resolve([]);
	}
}));

const { load } = await import('./+page.server.js');

function runNew(): Promise<unknown> {
	const locals = { supabase: {}, homeScope: null, homeRegion: null };
	return load({ params: { id: 'new' }, locals } as unknown as Parameters<typeof load>[0]).catch(
		(e) => e
	);
}

describe('editor load — create_conversation gate on the new path', () => {
	beforeEach(() => requireMembershipForAction.mockReset());

	it('redirects a gated (non-member) actor to the paywall with a return path', async () => {
		requireMembershipForAction.mockResolvedValue(new Response(null, { status: 403 }));
		const result = await runNew();
		expect(isRedirect(result)).toBe(true);
		expect((result as { location: string }).location).toBe('/membership?return=/conversations/new');
	});

	it('lets an eligible actor into the editor (blank prompt) on the new path', async () => {
		requireMembershipForAction.mockResolvedValue(null);
		const result = await runNew();
		expect((result as { prompt: { id: string } }).prompt.id).toBe('new');
	});

	it('consults the create gate for the new path', async () => {
		requireMembershipForAction.mockResolvedValue(null);
		await runNew();
		expect(requireMembershipForAction).toHaveBeenCalledWith('create_conversation', expect.anything());
	});
});
