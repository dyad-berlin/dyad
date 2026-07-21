import { describe, it, expect, vi, beforeEach } from 'vitest';

const { makeAdminClientMock } = vi.hoisted(() => ({
	makeAdminClientMock: vi.fn()
}));

vi.mock('$lib/server/supabase-admin', () => ({
	makeAdminClient: makeAdminClientMock
}));

import { getCopyOverrides, _resetCopyOverridesCache } from './copy-overrides';

function clientReturningRows(rows: unknown, error: unknown = null) {
	return {
		from: vi.fn(() => ({
			select: vi.fn(async () => ({ data: rows, error }))
		}))
	};
}

beforeEach(() => {
	_resetCopyOverridesCache();
	makeAdminClientMock.mockReset();
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getCopyOverrides', () => {
	it('maps rows to a key→value map, including empty-string values', async () => {
		makeAdminClientMock.mockReturnValue(
			clientReturningRows([
				{ key: 'membership.guestIntro', value: 'Custom intro' },
				{ key: 'common.untitled', value: '' }
			])
		);
		const map = await getCopyOverrides();
		expect(map).toEqual({ 'membership.guestIntro': 'Custom intro', 'common.untitled': '' });
	});

	it('returns {} and never throws when the client constructor throws (missing env)', async () => {
		makeAdminClientMock.mockImplementation(() => {
			throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
		});
		await expect(getCopyOverrides()).resolves.toEqual({});
		expect(console.error).toHaveBeenCalled();
	});

	it('serves the last-known-good map when a later fetch fails', async () => {
		makeAdminClientMock.mockReturnValue(
			clientReturningRows([{ key: 'a.b', value: 'first' }])
		);
		const t0 = 1_000_000;
		expect(await getCopyOverrides(t0)).toEqual({ 'a.b': 'first' });

		makeAdminClientMock.mockReturnValue(clientReturningRows(null, new Error('db down')));
		// Past TTL → re-fetch attempted → fails → stale served.
		expect(await getCopyOverrides(t0 + 61_000)).toEqual({ 'a.b': 'first' });
	});

	it('caches within the TTL (one query) and re-fetches after expiry', async () => {
		const client = clientReturningRows([{ key: 'a.b', value: 'v' }]);
		makeAdminClientMock.mockReturnValue(client);
		const t0 = 5_000_000;
		await getCopyOverrides(t0);
		await getCopyOverrides(t0 + 30_000);
		expect(makeAdminClientMock).toHaveBeenCalledTimes(1);
		await getCopyOverrides(t0 + 61_000);
		expect(makeAdminClientMock).toHaveBeenCalledTimes(2);
	});

	it('does not hammer the DB during an outage (error also advances the clock)', async () => {
		makeAdminClientMock.mockReturnValue(
			clientReturningRows([{ key: 'a.b', value: 'v' }])
		);
		const t0 = 9_000_000;
		await getCopyOverrides(t0);

		makeAdminClientMock.mockClear();
		makeAdminClientMock.mockReturnValue(clientReturningRows(null, new Error('down')));
		await getCopyOverrides(t0 + 61_000); // fails, marks fetchedAt
		await getCopyOverrides(t0 + 62_000); // within TTL of the failure → cache hit
		expect(makeAdminClientMock).toHaveBeenCalledTimes(1);
	});
});
