import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSafetyReportingEnabled, insertMock, insertResult } = vi.hoisted(() => {
	const insertResult = { error: null as { code?: string; message?: string } | null };
	const insertMock = vi.fn(() => insertResult);
	return {
		getSafetyReportingEnabled: vi.fn(async () => true),
		insertMock,
		insertResult
	};
});

vi.mock('$lib/server/app-settings', () => ({ getSafetyReportingEnabled }));

const { POST } = await import('./+server.js');

function call(bodyObj: unknown, user: { id: string } | null = { id: 'reporter-1' }) {
	const request = new Request('http://localhost/api/feedback/concern', {
		method: 'POST',
		body: typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj),
		headers: { 'content-type': 'application/json' }
	});
	const locals = {
		user,
		supabase: { from: () => ({ insert: insertMock }) }
	};
	return POST({ request, locals } as unknown as Parameters<typeof POST>[0]);
}

const valid = { slotId: 'slot-1', reportedId: 'reported-1', kind: 'no_show' };

describe('POST /api/feedback/concern', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		getSafetyReportingEnabled.mockReset().mockResolvedValue(true);
		insertMock.mockClear();
		insertResult.error = null;
	});

	it('401 when unauthenticated', async () => {
		await expect(call(valid, null)).rejects.toMatchObject({ status: 401 });
	});

	it('403 not_available when the feature flag is off', async () => {
		getSafetyReportingEnabled.mockResolvedValue(false);
		const res = await call(valid);
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ error: 'not_available' });
		expect(insertMock).not.toHaveBeenCalled();
	});

	it('201 and inserts with reporter = actor on a valid concern', async () => {
		const res = await call(valid);
		expect(res.status).toBe(201);
		expect(insertMock).toHaveBeenCalledWith(
			expect.objectContaining({ slot_id: 'slot-1', reported_id: 'reported-1', reporter_id: 'reporter-1', kind: 'no_show' })
		);
	});

	it('400 on an invalid kind', async () => {
		const res = await call({ ...valid, kind: 'gossip' });
		expect(res.status).toBe(400);
		expect(insertMock).not.toHaveBeenCalled();
	});

	it('400 on a missing target', async () => {
		expect((await call({ kind: 'no_show', reportedId: 'x' })).status).toBe(400);
		expect((await call({ kind: 'no_show', slotId: 'x' })).status).toBe(400);
	});

	it('400 on a self-report', async () => {
		const res = await call({ ...valid, reportedId: 'reporter-1' });
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ error: 'cannot_report_self' });
	});

	it('400 on over-long detail', async () => {
		const res = await call({ ...valid, detail: 'x'.repeat(2001) });
		expect(res.status).toBe(400);
	});

	it('400 on malformed JSON', async () => {
		const res = await call('{not json');
		expect(res.status).toBe(400);
	});

	it('403 not_a_participant when RLS rejects the insert (42501)', async () => {
		insertResult.error = { code: '42501', message: 'new row violates row-level security policy' };
		const res = await call(valid);
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ error: 'not_a_participant' });
	});

	it('500 generic on an unexpected DB error, without leaking detail', async () => {
		insertResult.error = { code: '23505', message: 'duplicate key value violates unique constraint "x"' };
		const res = await call(valid);
		expect(res.status).toBe(500);
		const bodyText = JSON.stringify(await res.json());
		expect(bodyText).not.toContain('constraint');
	});
});
