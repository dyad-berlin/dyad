import { describe, it, expect, beforeEach, vi } from 'vitest';

// The guest home-corner guard in this handler is the only server-side
// barrier against a corner-exclusive member publishing into the commons via
// a direct API call (plan R8) — the UI merely hides the option.

const listMyScopesMock = vi.fn();
vi.mock('$lib/services/scope.js', () => ({
	SupabaseScopeService: class {
		listMyScopes = listMyScopesMock;
	}
}));

const publishMock = vi.fn();
vi.mock('$lib/services/prompt-command.js', () => ({
	SupabasePromptCommandService: class {
		publish = publishMock;
	}
}));

// Membership gate — resolves null (allowed) by default; individual tests make
// it return the gated 403 to assert it is evaluated FIRST (before the cover
// check and every other validation).
const requireMembershipMock = vi.fn();
vi.mock('$lib/server/require-membership.js', () => ({
	requireMembershipForAction: requireMembershipMock
}));

vi.mock('$lib/services/identity.js', () => ({
	requireIdentity: () => ({ id: 'guest-1' })
}));

const { POST } = await import('./+server.js');

// Build a chainable thenable that resolves to `{ data, error }`.
function chain(data: unknown) {
	const result = { data, error: null };
	const builder: Record<string, unknown> = {};
	for (const m of ['select', 'eq', 'single']) builder[m] = () => builder;
	builder.then = (resolve: (v: typeof result) => unknown) => resolve(result);
	return builder;
}

const SLOT = {
	start_time: new Date(Date.now() + 48 * 3600_000).toISOString(),
	duration_minutes: 60,
	location: { place_id: 'p1', name: 'Venue', address: 'Somewhere 1', lat: 52.37, lng: 4.9 }
};

function makeEvent(
	body: Record<string, unknown>,
	homeScope: string | null,
	cover: string | null = 'https://x/storage/img.jpg'
) {
	const supabaseFromMock = vi.fn(() => chain(cover ? { cover_image_url: cover } : null));
	return {
		params: { id: 'prompt-1' },
		request: new Request('http://localhost/api/prompts/prompt-1/publish', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: { supabase: { from: supabaseFromMock }, homeScope, homeRegion: null, user: null }
	};
}

describe('POST /api/prompts/[id]/publish — guest home-corner guard', () => {
	beforeEach(() => {
		listMyScopesMock.mockReset();
		publishMock.mockReset();
		requireMembershipMock.mockReset();
		publishMock.mockResolvedValue(undefined);
		requireMembershipMock.mockResolvedValue(null);
		listMyScopesMock.mockResolvedValue([{ scope: 'conf-corner', name: 'Conference corner' }]);
	});

	it('rejects a guest publishing to the commons (audience_scope null)', async () => {
		const event = makeEvent({ slots: [SLOT], audience_scope: null }, 'conf-corner');
		const res = await POST(event as unknown as Parameters<typeof POST>[0]);
		expect(res.status).toBe(403);
		expect(publishMock).not.toHaveBeenCalled();
	});

	it('rejects a guest publishing to another corner they hold', async () => {
		listMyScopesMock.mockResolvedValue([
			{ scope: 'conf-corner', name: 'Conference corner' },
			{ scope: 'other-corner', name: 'Other corner' }
		]);
		const event = makeEvent({ slots: [SLOT], audience_scope: 'other-corner' }, 'conf-corner');
		const res = await POST(event as unknown as Parameters<typeof POST>[0]);
		expect(res.status).toBe(403);
		expect(publishMock).not.toHaveBeenCalled();
	});

	it('allows a guest publishing into their home corner', async () => {
		const event = makeEvent({ slots: [SLOT], audience_scope: 'conf-corner' }, 'conf-corner');
		const res = await POST(event as unknown as Parameters<typeof POST>[0]);
		expect(res.status).toBe(200);
		expect(publishMock).toHaveBeenCalledWith('prompt-1', 'guest-1', [SLOT], 'conf-corner', null);
	});

	it('leaves commons members unaffected (no home corner)', async () => {
		const event = makeEvent({ slots: [SLOT] }, null);
		const res = await POST(event as unknown as Parameters<typeof POST>[0]);
		expect(res.status).toBe(200);
		expect(publishMock).toHaveBeenCalledWith('prompt-1', 'guest-1', [SLOT], null, null);
	});
});

describe('POST /api/prompts/[id]/publish — membership gate ordering', () => {
	const GATE_403 = () =>
		new Response(
			JSON.stringify({
				error: 'membership_required',
				action: 'create_conversation',
				had_membership: false,
				reason: 'join'
			}),
			{ status: 403, headers: { 'content-type': 'application/json' } }
		);

	beforeEach(() => {
		listMyScopesMock.mockReset();
		publishMock.mockReset();
		requireMembershipMock.mockReset();
		publishMock.mockResolvedValue(undefined);
		requireMembershipMock.mockResolvedValue(null);
		listMyScopesMock.mockResolvedValue([]);
	});

	it('returns the gate 403 BEFORE the cover-image check (no cover, gated)', async () => {
		requireMembershipMock.mockResolvedValue(GATE_403());
		const event = makeEvent({ slots: [SLOT] }, null, null);
		const res = await POST(event as unknown as Parameters<typeof POST>[0]);
		expect(res.status).toBe(403);
		const body = await res.json();
		// The shape gateModeFrom / the editor paywall rely on — not the cover message.
		expect(body.error).toBe('membership_required');
		expect(body.reason).toBe('join');
		expect(publishMock).not.toHaveBeenCalled();
	});

	it('returns the gate 403 even before slot validation', async () => {
		requireMembershipMock.mockResolvedValue(GATE_403());
		const event = makeEvent({ slots: [] }, null);
		const res = await POST(event as unknown as Parameters<typeof POST>[0]);
		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body.error).toBe('membership_required');
	});

	it('still returns the cover error when the gate allows and the cover is missing', async () => {
		const event = makeEvent({ slots: [SLOT] }, null, null);
		const res = await POST(event as unknown as Parameters<typeof POST>[0]);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe('Cover image is required to publish');
		expect(requireMembershipMock).toHaveBeenCalledWith('create_conversation', event.locals);
	});
});
