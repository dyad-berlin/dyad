/**
 * KV read-through data cache for the content port (origin data caching, not
 * edge response caching — the Worker still runs on every request and
 * cf-cache-status stays DYNAMIC by design).
 *
 * FAIL DIRECTION: to last-known-good, mirroring $lib/server/copy-overrides.
 * Freshness is a stored timestamp compared at read time, never a KV
 * expirationTtl — expiration would delete the value and take the stale-on-
 * error fallback with it. Values therefore persist indefinitely, and explicit
 * invalidation (deleting the key) is the production mechanism for retracting
 * content: an operator can pull an entry faster than any TTL.
 */
import type {
	ContentService,
	UnfoldingEntry,
	UnfoldingSummary,
	WigglingVoice
} from '$lib/services/content';

/**
 * The slice of a Cloudflare KVNamespace this cache uses, typed structurally
 * so no @cloudflare/workers-types dependency is needed and tests can pass an
 * in-memory map.
 */
export interface ContentKV {
	get(key: string): Promise<string | null>;
	put(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
}

/**
 * Upstream source failed and nothing is cached: there is no content to serve.
 * Distinguishable from an unknown slug (a null return), so callers can render
 * an explicit empty state or return 503 rather than 404.
 */
export class ContentUnavailableError extends Error {
	constructor(key: string, cause: unknown) {
		super(`content unavailable: upstream failed with nothing cached for ${key}`);
		this.name = 'ContentUnavailableError';
		this.cause = cause;
	}
}

/** Starting point per the plan's open question; tune with real content volume. */
export const CONTENT_CACHE_TTL_MS = 60_000;

const ENTRIES_KEY = 'content:entries';
const VOICES_KEY = 'content:voices';
const entryKey = (slug: string) => `content:entry:${slug}`;

interface Envelope<T> {
	fetchedAt: number;
	value: T;
}

export class CachedContentService implements ContentService {
	constructor(
		private inner: ContentService,
		private kv: ContentKV,
		private ttlMs: number = CONTENT_CACHE_TTL_MS
	) {}

	async listEntries(): Promise<UnfoldingSummary[]> {
		return this.readThrough(ENTRIES_KEY, () => this.inner.listEntries());
	}

	async getEntry(slug: string): Promise<UnfoldingEntry | null> {
		return this.readThrough(entryKey(slug), () => this.inner.getEntry(slug));
	}

	async listVoices(): Promise<WigglingVoice[]> {
		return this.readThrough(VOICES_KEY, () => this.inner.listVoices());
	}

	/**
	 * The production retraction path (KTD4): deletes the entry's key and the
	 * listing keys so the next read misses and refetches. With no slug, only
	 * the listing keys are dropped.
	 */
	async invalidate(slug?: string): Promise<void> {
		const deletes = [this.kv.delete(ENTRIES_KEY), this.kv.delete(VOICES_KEY)];
		if (slug) deletes.push(this.kv.delete(entryKey(slug)));
		await Promise.all(deletes);
	}

	private async readThrough<T>(key: string, fetchFresh: () => Promise<T>): Promise<T> {
		let envelope: Envelope<T> | null = null;
		try {
			const raw = await this.kv.get(key);
			if (raw !== null) envelope = JSON.parse(raw) as Envelope<T>;
		} catch (err) {
			// A broken KV read or a corrupt value is a miss, never a page error.
			console.error(`[content-cache] read failed for ${key}, treating as miss:`, err);
		}

		const now = Date.now();
		if (envelope !== null && now - envelope.fetchedAt < this.ttlMs) {
			return envelope.value;
		}

		try {
			const value = await fetchFresh();
			// Never persist a negative result: null values are cheap to recompute,
			// and a stored null would otherwise be a permanent KV key minted per
			// unknown slug — an unbounded, attacker-controllable namespace.
			if (value !== null) {
				try {
					await this.kv.put(key, JSON.stringify({ fetchedAt: now, value } satisfies Envelope<T>));
				} catch (err) {
					console.error(`[content-cache] write failed for ${key}:`, err);
				}
			}
			return value;
		} catch (err) {
			// Cloudflare Pages retains no function logs; an unlogged failure here
			// is invisible.
			console.error(`[content-cache] upstream fetch failed for ${key}:`, err);
			if (envelope !== null) return envelope.value; // last-known-good, regardless of age
			throw new ContentUnavailableError(key, err);
		}
	}
}
