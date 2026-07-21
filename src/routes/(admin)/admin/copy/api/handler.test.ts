import { describe, it, expect, vi, beforeEach } from 'vitest';

const { upsertMock, deleteMock, rowsMock, operatorMock } = vi.hoisted(() => ({
	upsertMock: vi.fn(),
	deleteMock: vi.fn(),
	rowsMock: vi.fn(),
	operatorMock: vi.fn()
}));

vi.mock('$lib/server/copy-overrides', () => ({
	upsertCopyOverride: upsertMock,
	deleteCopyOverride: deleteMock,
	getCopyOverrideRowsUncached: rowsMock
}));

vi.mock('$lib/server/admin-auth', () => ({
	getAuthorizedAdminOperator: operatorMock
}));

import { GET, PATCH, DELETE } from './+server';

function req(method: string, body?: unknown): Request {
	return new Request('http://admin.local/admin/copy/api', {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
}

// Handlers only use `request` from the event.
const call = (handler: CallableFunction, request: Request) => handler({ request } as never);

beforeEach(() => {
	upsertMock.mockReset().mockResolvedValue({ conflict: false });
	deleteMock.mockReset().mockResolvedValue({ existed: true });
	rowsMock.mockReset().mockResolvedValue([]);
	operatorMock.mockReset().mockResolvedValue({ email: 'op@dyad.berlin' });
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('PATCH /admin/copy/api', () => {
	it('saves a valid override with default snapshot and operator attribution', async () => {
		const res = await call(PATCH, req('PATCH', { key: 'membership.guestIntro', value: 'New intro' }));
		expect(res.status).toBe(200);
		expect(upsertMock).toHaveBeenCalledWith(
			expect.objectContaining({
				key: 'membership.guestIntro',
				value: 'New intro',
				updatedBy: 'op@dyad.berlin',
				defaultAtSave: expect.stringContaining('member funded')
			})
		);
	});

	it('rejects malformed JSON with 400', async () => {
		const res = await call(
			PATCH,
			new Request('http://admin.local/x', { method: 'PATCH', body: 'not json' })
		);
		expect(res.status).toBe(400);
	});

	it('rejects unknown keys, function leaves, and non-strings with 400', async () => {
		expect((await call(PATCH, req('PATCH', { key: 'nope.nothing', value: 'x' }))).status).toBe(400);
		expect((await call(PATCH, req('PATCH', { key: 'common.nOthers', value: 'x' }))).status).toBe(400);
		expect((await call(PATCH, req('PATCH', { key: 'common.untitled', value: 7 }))).status).toBe(400);
		expect(upsertMock).not.toHaveBeenCalled();
	});

	it('rejects token violations with a message naming the token', async () => {
		const res = await call(
			PATCH,
			req('PATCH', { key: 'discover.audienceTag', value: 'no token here' })
		);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toContain('{name}');
	});

	it('rejects over-length values with 400', async () => {
		const res = await call(
			PATCH,
			req('PATCH', { key: 'common.untitled', value: 'x'.repeat(2001) })
		);
		expect(res.status).toBe(400);
	});

	it('returns 409 on optimistic-concurrency conflict', async () => {
		upsertMock.mockResolvedValue({ conflict: true });
		const res = await call(
			PATCH,
			req('PATCH', {
				key: 'common.untitled',
				value: 'x',
				expectedUpdatedAt: '2026-07-21T00:00:00Z'
			})
		);
		expect(res.status).toBe(409);
	});

	it('returns generic 500 on DB failure without internal details', async () => {
		upsertMock.mockRejectedValue(new Error('relation copy_overrides does not exist'));
		const res = await call(PATCH, req('PATCH', { key: 'common.untitled', value: 'x' }));
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(JSON.stringify(body)).not.toContain('relation');
	});
});

describe('DELETE /admin/copy/api', () => {
	it('reverts an existing override', async () => {
		const res = await call(DELETE, req('DELETE', { key: 'common.untitled' }));
		expect(res.status).toBe(200);
		expect(deleteMock).toHaveBeenCalledWith('common.untitled');
	});

	it('404s when no override exists', async () => {
		deleteMock.mockResolvedValue({ existed: false });
		const res = await call(DELETE, req('DELETE', { key: 'common.untitled' }));
		expect(res.status).toBe(404);
	});

	it('rejects malformed JSON with 400', async () => {
		const res = await call(
			DELETE,
			new Request('http://admin.local/x', { method: 'DELETE', body: '{' })
		);
		expect(res.status).toBe(400);
	});
});

describe('GET /admin/copy/api', () => {
	it('returns override rows', async () => {
		rowsMock.mockResolvedValue([{ key: 'a.b', value: 'v', default_at_save: 'd', updated_at: 't', updated_by: null }]);
		const res = await call(GET, req('GET'));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.overrides).toHaveLength(1);
	});

	it('returns generic 500 on failure', async () => {
		rowsMock.mockRejectedValue(new Error('boom'));
		const res = await call(GET, req('GET'));
		expect(res.status).toBe(500);
	});
});
