import { describe, it, expect, beforeEach, vi } from 'vitest';

// loadLayoutData wraps the upact port only to derive `identity`; stub it so the
// test exercises the loader logic, not the substrate.
vi.mock('@prefig/upact-supabase', () => ({
	userToUpactor: (u: { id: string }) => ({ id: u.id })
}));

// getGatheringFeedbackGateEnabled reads app_settings via a service-role admin
// client ($env); stub it so the unit test doesn't pull in that chain. Its value
// doesn't affect these cases (gatherings/participation are empty => counts 0).
vi.mock('$lib/server/app-settings.js', () => ({
	getGatheringFeedbackGateEnabled: () => Promise.resolve(true)
}));

const { loadLayoutData } = await import('./load-layout-data.js');

// A chainable thenable that resolves to a Supabase-style result object
// (`{ data, error }` or `{ count, error }`), mirroring the helper in
// notification-expiry-guard.test.ts.
function chain(result: unknown) {
	const builder: Record<string, unknown> = {};
	for (const m of ['select', 'eq', 'is', 'single', 'maybeSingle']) builder[m] = () => builder;
	builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
	return builder;
}

// supabase.from() is called in array order: profiles, prompt_invitations,
// feedback_forms, group_feedback, gatherings, participation, notification_settings,
// memberships. (getGatheringFeedbackGateEnabled and loadPendingFeedback issue no
// `from` calls — the former is mocked, the latter is skipped without a pending id.)
function makeLocals(notifResult: unknown, membershipResult: unknown = { data: null, error: null }) {
	const from = vi.fn();
	from
		.mockReturnValueOnce(chain({ data: { username: 'mara' }, error: null })) // profiles
		.mockReturnValueOnce(chain({ count: 0, error: null })) // prompt_invitations
		.mockReturnValueOnce(chain({ count: 0, error: null })) // feedback_forms
		.mockReturnValueOnce(chain({ data: [], error: null })) // group_feedback (now data rows)
		.mockReturnValueOnce(chain({ data: [], error: null })) // gatherings
		.mockReturnValueOnce(chain({ data: [], error: null })) // participation (unconfirmed)
		.mockReturnValueOnce(chain(notifResult)) // notification_settings
		.mockReturnValueOnce(chain(membershipResult)); // memberships
	return { user: { id: 'u1' }, supabase: { from } } as unknown as App.Locals;
}

describe('loadLayoutData — hasNotificationEmail (U1)', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	it('is true when the member has a notification address', async () => {
		const data = await loadLayoutData(makeLocals({ data: { email: 'guest@example.org' }, error: null }));
		expect(data.hasNotificationEmail).toBe(true);
	});

	it('is false when the stored email is null', async () => {
		const data = await loadLayoutData(makeLocals({ data: { email: null }, error: null }));
		expect(data.hasNotificationEmail).toBe(false);
	});

	it('is false when there is no notification_settings row', async () => {
		const data = await loadLayoutData(makeLocals({ data: null, error: null }));
		expect(data.hasNotificationEmail).toBe(false);
	});

	it('is false for an empty-string email', async () => {
		const data = await loadLayoutData(makeLocals({ data: { email: '' }, error: null }));
		expect(data.hasNotificationEmail).toBe(false);
	});

	it('fails safe to true (and logs) when the read errors', async () => {
		const data = await loadLayoutData(makeLocals({ data: null, error: { message: 'boom' } }));
		expect(data.hasNotificationEmail).toBe(true);
		expect(console.error).toHaveBeenCalled();
	});

	it('leaves the existing layout fields intact', async () => {
		const data = await loadLayoutData(makeLocals({ data: { email: 'guest@example.org' }, error: null }));
		expect(data.username).toBe('mara');
		expect(data.attentionCount).toBe(0);
		expect(data.pendingFeedback).toBeNull();
		expect(data.identity).toEqual({ id: 'u1' });
	});
});

describe('loadLayoutData — membership', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	it('maps an active membership row to the membership field', async () => {
		const data = await loadLayoutData(
			makeLocals({ data: null, error: null }, { data: { active: true, cadence: 'annual', source: 'paid' }, error: null })
		);
		expect(data.membership).toEqual({ active: true, cadence: 'annual', source: 'paid' });
	});

	it('maps a lapsed membership row (active false) so the lapsed surfaces can render', async () => {
		const data = await loadLayoutData(
			makeLocals({ data: null, error: null }, { data: { active: false, cadence: 'annual', source: 'paid' }, error: null })
		);
		expect(data.membership).toEqual({ active: false, cadence: 'annual', source: 'paid' });
	});

	it('is null when there is no membership row', async () => {
		const data = await loadLayoutData(makeLocals({ data: null, error: null }, { data: null, error: null }));
		expect(data.membership).toBeNull();
	});

	it('treats a never-activated paid row (abandoned checkout) as a non-member', async () => {
		const data = await loadLayoutData(
			makeLocals({ data: null, error: null }, { data: { active: false, cadence: null, source: 'paid' }, error: null })
		);
		expect(data.membership).toBeNull();
	});

	it('fails safe to null (and logs) when the membership read errors', async () => {
		const data = await loadLayoutData(
			makeLocals({ data: null, error: null }, { data: null, error: { message: 'boom' } })
		);
		expect(data.membership).toBeNull();
		expect(console.error).toHaveBeenCalled();
	});
});
