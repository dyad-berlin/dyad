import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getEmail, setEmail, getGating, setGating, getQuota, setQuota } = vi.hoisted(() => ({
	getEmail: vi.fn(),
	setEmail: vi.fn(),
	getGating: vi.fn(),
	setGating: vi.fn(),
	getQuota: vi.fn(),
	setQuota: vi.fn()
}));

vi.mock('$lib/server/app-settings', () => ({
	getEmailNotificationsEnabled: getEmail,
	setEmailNotificationsEnabled: setEmail,
	getMembershipGating: getGating,
	setMembershipGating: setGating,
	getFreeInteractionQuota: getQuota,
	setFreeInteractionQuota: setQuota
}));

const { GET, PATCH } = await import('./+server.js');

function patch(body: unknown) {
	const request = new Request('http://localhost/admin/settings/api', {
		method: 'PATCH',
		body: JSON.stringify(body),
		headers: { 'content-type': 'application/json' }
	});
	return PATCH({ request } as unknown as Parameters<typeof PATCH>[0]);
}

describe('admin settings API — membership gating + quota', () => {
	beforeEach(() => {
		getEmail.mockReset().mockResolvedValue(false);
		setEmail.mockReset().mockResolvedValue(undefined);
		getGating.mockReset().mockResolvedValue({ respond_take_slot: true });
		setGating.mockReset().mockResolvedValue(undefined);
		getQuota.mockReset().mockResolvedValue(1);
		setQuota.mockReset().mockResolvedValue(undefined);
	});

	it('GET returns the kill switch, the gating config, and the quota', async () => {
		const res = await GET({} as unknown as Parameters<typeof GET>[0]);
		expect(await res.json()).toEqual({
			email_notifications_enabled: false,
			membership_gating: { respond_take_slot: true },
			free_interaction_quota: 1
		});
	});

	it('PATCH accepts a valid gating map and persists it', async () => {
		const res = await patch({ membership_gating: { create_conversation: true, invite_to_meet: false } });
		expect(res.status).toBe(200);
		expect(setGating).toHaveBeenCalledWith({ create_conversation: true, invite_to_meet: false });
	});

	it('PATCH rejects an unknown action key with 400', async () => {
		const res = await patch({ membership_gating: { read_feed: true } });
		expect(res.status).toBe(400);
		expect(setGating).not.toHaveBeenCalled();
	});

	it('PATCH rejects a non-boolean flag with 400', async () => {
		const res = await patch({ membership_gating: { create_conversation: 'yes' } });
		expect(res.status).toBe(400);
		expect(setGating).not.toHaveBeenCalled();
	});

	it('PATCH rejects a non-object membership_gating with 400', async () => {
		const res = await patch({ membership_gating: [1, 2] });
		expect(res.status).toBe(400);
		expect(setGating).not.toHaveBeenCalled();
	});

	// ── Free-interaction quota ──────────────────────────────────────────────────

	it('PATCH accepts a valid integer quota and persists it', async () => {
		const res = await patch({ free_interaction_quota: 5 });
		expect(res.status).toBe(200);
		expect(setQuota).toHaveBeenCalledWith(5);
	});

	it('PATCH accepts 0 (gating with no free actions)', async () => {
		const res = await patch({ free_interaction_quota: 0 });
		expect(res.status).toBe(200);
		expect(setQuota).toHaveBeenCalledWith(0);
	});

	it('PATCH rejects a non-integer quota with 400', async () => {
		const res = await patch({ free_interaction_quota: 2.5 });
		expect(res.status).toBe(400);
		expect(setQuota).not.toHaveBeenCalled();
	});

	it('PATCH rejects a negative quota with 400', async () => {
		const res = await patch({ free_interaction_quota: -1 });
		expect(res.status).toBe(400);
		expect(setQuota).not.toHaveBeenCalled();
	});

	it('PATCH rejects an out-of-range quota with 400', async () => {
		const res = await patch({ free_interaction_quota: 100 });
		expect(res.status).toBe(400);
		expect(setQuota).not.toHaveBeenCalled();
	});

	it('PATCH rejects a non-number quota with 400', async () => {
		const res = await patch({ free_interaction_quota: 'lots' });
		expect(res.status).toBe(400);
		expect(setQuota).not.toHaveBeenCalled();
	});

	it('PATCH still handles the email kill switch', async () => {
		const res = await patch({ email_notifications_enabled: true });
		expect(res.status).toBe(200);
		expect(setEmail).toHaveBeenCalledWith(true);
	});

	it('PATCH with no recognized setting is a 400', async () => {
		const res = await patch({ nonsense: 1 });
		expect(res.status).toBe(400);
	});
});
