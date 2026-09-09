import { describe, it, expect, vi } from 'vitest';
import { load } from './+page.server.js';

function makeEvent(user: { id: string } | null) {
	return {
		locals: { user, supabase: {} },
		setHeaders: vi.fn()
	} as unknown as Parameters<typeof load>[0];
}

describe('/ (landing) load', () => {
	it('redirects an authenticated visitor to /discover', async () => {
		await expect(load(makeEvent({ id: 'u1' }))).rejects.toMatchObject({
			status: 302,
			location: '/discover'
		});
	});

	it('returns no data for an anonymous visitor', async () => {
		await expect(load(makeEvent(null))).resolves.toEqual({});
	});
});
