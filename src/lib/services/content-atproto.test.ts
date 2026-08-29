import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AtprotoRecord } from '$lib/server/atproto/xrpc';

const xrpc = vi.hoisted(() => ({
	resolveRepo: vi.fn(),
	listRecords: vi.fn(),
	getRecord: vi.fn()
}));

vi.mock('$lib/server/atproto/xrpc', async (importOriginal) => {
	const original = await importOriginal<typeof import('$lib/server/atproto/xrpc')>();
	return { ...original, ...xrpc };
});

const { AtprotoContentService, recordToEntry, UNFOLDING_COLLECTION } = await import(
	'$lib/services/content-atproto'
);
const { wigglingVoices } = await import('$lib/content/wiggling');

const DID = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz';
const PDS = 'https://enoki.us-east.host.bsky.network';

function record(slug: string, overrides: Record<string, unknown> = {}): AtprotoRecord {
	return {
		uri: `at://${DID}/${UNFOLDING_COLLECTION}/${slug}`,
		cid: 'bafy-test',
		value: {
			$type: UNFOLDING_COLLECTION,
			slug,
			kicker: 'Kicker',
			title: `Title for ${slug}`,
			quote: 'A quote.',
			date: '2026-08-01',
			paragraphs: ['One paragraph.'],
			...overrides
		}
	};
}

describe('AtprotoContentService', () => {
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		xrpc.resolveRepo.mockReset().mockResolvedValue({ did: DID, pds: PDS });
		xrpc.listRecords.mockReset();
		xrpc.getRecord.mockReset();
		errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		errorSpy.mockRestore();
	});

	function makeService() {
		return new AtprotoContentService({ repo: 'unfolding.test' });
	}

	it('lists records parsed to the port contract, newest first, as summaries', async () => {
		xrpc.listRecords.mockResolvedValue({
			records: [record('older', { date: '2026-07-01' }), record('newer', { date: '2026-08-01' })]
		});
		const summaries = await makeService().listEntries();
		expect(summaries.map((s) => s.slug)).toEqual(['newer', 'older']);
		for (const summary of summaries) {
			expect('paragraphs' in summary).toBe(false);
		}
	});

	it('skips a malformed record rather than crashing the listing', async () => {
		xrpc.listRecords.mockResolvedValue({
			records: [record('good'), record('bad', { paragraphs: 'not an array' })]
		});
		const summaries = await makeService().listEntries();
		expect(summaries.map((s) => s.slug)).toEqual(['good']);
		expect(errorSpy).toHaveBeenCalled();
	});

	it('skips a record whose rkey disagrees with its slug', async () => {
		const mismatched = { ...record('the-rkey'), value: { ...record('x').value, slug: 'other-slug' } };
		expect(recordToEntry(mismatched)).toBeNull();
		expect(errorSpy).toHaveBeenCalled();
	});

	it('getEntry returns the full entry for an existing slug', async () => {
		xrpc.getRecord.mockResolvedValue(record('ownership'));
		const entry = await makeService().getEntry('ownership');
		expect(entry?.slug).toBe('ownership');
		expect(entry?.paragraphs).toEqual(['One paragraph.']);
		expect(xrpc.getRecord).toHaveBeenCalledWith(PDS, DID, UNFOLDING_COLLECTION, 'ownership');
	});

	it('getEntry surfaces a missing rkey as null', async () => {
		xrpc.getRecord.mockResolvedValue(null);
		await expect(makeService().getEntry('no-such-essay')).resolves.toBeNull();
	});

	it('rejects an invalid slug before any network call', async () => {
		await expect(makeService().getEntry('../etc/passwd')).resolves.toBeNull();
		expect(xrpc.resolveRepo).not.toHaveBeenCalled();
		expect(xrpc.getRecord).not.toHaveBeenCalled();
	});

	it('propagates upstream failure so the cache layer serves last-known-good', async () => {
		xrpc.listRecords.mockRejectedValue(new Error('upstream 502'));
		await expect(makeService().listEntries()).rejects.toThrow('upstream 502');
	});

	it('retries resolution after a failed attempt instead of pinning the failure', async () => {
		xrpc.resolveRepo.mockRejectedValueOnce(new Error('plc down'));
		const service = makeService();
		await expect(service.listEntries()).rejects.toThrow('plc down');

		xrpc.listRecords.mockResolvedValue({ records: [record('ownership')] });
		await expect(service.listEntries()).resolves.toHaveLength(1);
		expect(xrpc.resolveRepo).toHaveBeenCalledTimes(2);
	});

	it('paginates with the cursor and stops on the last page', async () => {
		xrpc.listRecords
			.mockResolvedValueOnce({ records: [record('page-one', { date: '2026-08-02' })], cursor: 'c1' })
			.mockResolvedValueOnce({ records: [record('page-two', { date: '2026-08-01' })] });
		const summaries = await makeService().listEntries();
		expect(summaries.map((s) => s.slug)).toEqual(['page-one', 'page-two']);
		expect(xrpc.listRecords).toHaveBeenCalledTimes(2);
	});

	it('serves Wiggling voices from the module — spike publishes essays only', async () => {
		await expect(makeService().listVoices()).resolves.toEqual(wigglingVoices);
	});
});
