import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	CachedContentService,
	ContentUnavailableError,
	CONTENT_CACHE_TTL_MS,
	type ContentKV
} from './content-cache';
import {
	getContentService,
	ModuleContentService,
	_resetContentCache,
	type ContentService,
	type UnfoldingEntry
} from '$lib/services/content';

function makeKv(): ContentKV & { store: Map<string, string> } {
	const store = new Map<string, string>();
	return {
		store,
		async get(key) {
			return store.get(key) ?? null;
		},
		async put(key, value) {
			store.set(key, value);
		},
		async delete(key) {
			store.delete(key);
		}
	};
}

const entry: UnfoldingEntry = {
	slug: 'an-essay',
	kicker: 'Kicker',
	title: 'Title',
	quote: 'Quote.',
	date: '2026-08-01',
	paragraphs: ['One.']
};

function makeAdapter() {
	return {
		listEntries: vi.fn(async () => [summaryOf(entry)]),
		getEntry: vi.fn(async (slug: string) => (slug === entry.slug ? entry : null))
	} satisfies ContentService;
}

function summaryOf(e: UnfoldingEntry) {
	const { paragraphs: _paragraphs, ...summary } = e;
	return summary;
}

describe('CachedContentService', () => {
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-06T10:00:00Z'));
		errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		errorSpy.mockRestore();
	});

	it('cold read calls the adapter once and writes the result to KV with a timestamp', async () => {
		const kv = makeKv();
		const adapter = makeAdapter();
		const service = new CachedContentService(adapter, kv);

		const got = await service.getEntry(entry.slug);

		expect(got).toEqual(entry);
		expect(adapter.getEntry).toHaveBeenCalledTimes(1);
		const raw = kv.store.get(`content:entry:${entry.slug}`);
		expect(raw).toBeDefined();
		const envelope = JSON.parse(raw!);
		expect(envelope.fetchedAt).toBe(Date.now());
		expect(envelope.value).toEqual(entry);
	});

	it('warm read within TTL returns the cached value with zero adapter calls', async () => {
		const kv = makeKv();
		const adapter = makeAdapter();
		const service = new CachedContentService(adapter, kv);

		await service.listEntries();
		adapter.listEntries.mockClear();

		vi.advanceTimersByTime(CONTENT_CACHE_TTL_MS - 1000);
		const got = await service.listEntries();

		expect(got).toEqual([summaryOf(entry)]);
		expect(adapter.listEntries).not.toHaveBeenCalled();
	});

	it('read after TTL expiry refreshes from the adapter and updates KV', async () => {
		const kv = makeKv();
		const adapter = makeAdapter();
		const service = new CachedContentService(adapter, kv);

		await service.listEntries();
		const firstWrite = kv.store.get('content:entries');

		vi.advanceTimersByTime(CONTENT_CACHE_TTL_MS + 1000);
		await service.listEntries();

		expect(adapter.listEntries).toHaveBeenCalledTimes(2);
		const secondWrite = kv.store.get('content:entries');
		expect(JSON.parse(secondWrite!).fetchedAt).toBeGreaterThan(JSON.parse(firstWrite!).fetchedAt);
	});

	it('adapter throwing with a cached value present returns the stale value, regardless of age', async () => {
		const kv = makeKv();
		const adapter = makeAdapter();
		const service = new CachedContentService(adapter, kv);

		await service.getEntry(entry.slug);
		adapter.getEntry.mockRejectedValue(new Error('upstream down'));

		// Far past any TTL: last-known-good is age-independent.
		vi.advanceTimersByTime(CONTENT_CACHE_TTL_MS * 1000);
		await expect(service.getEntry(entry.slug)).resolves.toEqual(entry);
	});

	it('adapter throwing with no cached value surfaces ContentUnavailableError, distinguishable from an unknown slug', async () => {
		const kv = makeKv();
		const adapter = makeAdapter();
		adapter.getEntry.mockRejectedValue(new Error('upstream down'));
		const service = new CachedContentService(adapter, kv);

		await expect(service.getEntry(entry.slug)).rejects.toBeInstanceOf(ContentUnavailableError);

		// An unknown slug with a healthy adapter stays a null return.
		adapter.getEntry.mockResolvedValue(null);
		await expect(service.getEntry('unknown-slug')).resolves.toBeNull();
	});

	it('logs a failing adapter through console.error', async () => {
		const kv = makeKv();
		const adapter = makeAdapter();
		adapter.listEntries.mockRejectedValue(new Error('upstream down'));
		const service = new CachedContentService(adapter, kv);

		await expect(service.listEntries()).rejects.toBeInstanceOf(ContentUnavailableError);
		expect(errorSpy).toHaveBeenCalled();
	});

	it('explicit invalidation removes the key so the next read is a miss — the operator retraction path', async () => {
		const kv = makeKv();
		const adapter = makeAdapter();
		const service = new CachedContentService(adapter, kv);

		await service.getEntry(entry.slug);
		await service.listEntries();
		expect(adapter.getEntry).toHaveBeenCalledTimes(1);

		await service.invalidate(entry.slug);
		expect(kv.store.has(`content:entry:${entry.slug}`)).toBe(false);
		expect(kv.store.has('content:entries')).toBe(false);

		await service.getEntry(entry.slug);
		expect(adapter.getEntry).toHaveBeenCalledTimes(2);
	});

	it('treats a corrupt KV value as a miss rather than an error', async () => {
		const kv = makeKv();
		kv.store.set('content:entries', 'not json {');
		const adapter = makeAdapter();
		const service = new CachedContentService(adapter, kv);

		await expect(service.listEntries()).resolves.toEqual([summaryOf(entry)]);
		expect(adapter.listEntries).toHaveBeenCalledTimes(1);
		expect(errorSpy).toHaveBeenCalled();
	});
});

describe('getContentService', () => {
	beforeEach(() => _resetContentCache());
	afterEach(() => _resetContentCache());

	it('returns the bare module adapter without a platform', () => {
		expect(getContentService()).toBeInstanceOf(ModuleContentService);
	});

	it('returns the bare module adapter when the platform has no binding', () => {
		expect(getContentService({ env: undefined } as App.Platform)).toBeInstanceOf(
			ModuleContentService
		);
	});

	it('returns the cached service when the binding is present, and memoises it', () => {
		const kv = makeKv();
		const platform = { env: { CONTENT_KV: kv } } as unknown as App.Platform;
		const first = getContentService(platform);
		expect(first).toBeInstanceOf(CachedContentService);
		expect(getContentService(platform)).toBe(first);
	});

	it('_resetContentCache clears the memoised instance', () => {
		const first = getContentService();
		_resetContentCache();
		expect(getContentService()).not.toBe(first);
	});
});
