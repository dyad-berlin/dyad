import {
	isValidSlug,
	isValidUnfoldingEntry,
	toUnfoldingSummary,
	type ContentService,
	type UnfoldingEntry,
	type UnfoldingSummary,
	type WigglingVoice
} from '$lib/services/content';
import { wigglingVoices } from '$lib/content/wiggling';
import { resolveRepo, listRecords, getRecord, type AtprotoRecord } from '$lib/server/atproto/xrpc';

/**
 * Spike adapter (plan U5): reads Unfolding entries from an atproto repo,
 * PDS-direct, unauthenticated. Custom NSID — no public AppView indexes it,
 * and the same codebase writes and reads the shape (scripts/spike-atproto-publish.mjs).
 *
 * The rkey IS the slug: the publish script writes each entry under its slug,
 * so getEntry is a single getRecord instead of a listing scan.
 *
 * Wiggling voices stay module-backed here — the spike publishes essays only;
 * the voices record shape is a U6 decision.
 */

export const UNFOLDING_COLLECTION = 'social.dyad.unfolding.entry';
export const DEFAULT_ENTRY_HOST = 'https://bsky.social';

// A repo cannot hold more pages of essays than this without something being
// wrong; caps the cursor loop against a runaway or malicious listing.
const MAX_LIST_PAGES = 10;

export interface AtprotoContentConfig {
	/** Handle (dyad-unfolding.bsky.social) or DID of the first-party repo. */
	repo: string;
	collection?: string;
	/** Host queried for handle resolution. */
	entryHost?: string;
}

const ENTRY_FIELDS = [
	'slug',
	'kicker',
	'title',
	'dek',
	'quote',
	'quoteAttr',
	'date',
	'paragraphs',
	'heroImage',
	'heroCredit',
	'heroCreditUrl'
] as const;

/**
 * Record value → contract entry: pick exactly the contract fields (dropping
 * $type and anything unknown), then pass the port's shape guard. The rkey in
 * the record URI must agree with the value's slug — two names for the same
 * thing that disagree is a malformed record, skipped and logged.
 */
export function recordToEntry(record: AtprotoRecord): UnfoldingEntry | null {
	const picked: Record<string, unknown> = {};
	for (const field of ENTRY_FIELDS) {
		if (record.value[field] !== undefined) picked[field] = record.value[field];
	}

	const rkey = record.uri.split('/').pop() ?? '';
	if (!isValidSlug(rkey) || rkey !== picked.slug || !isValidUnfoldingEntry(picked)) {
		console.error(`content-atproto: record ${record.uri} failed the shape guard and was skipped`);
		return null;
	}
	return picked;
}

export class AtprotoContentService implements ContentService {
	private repo: string;
	private collection: string;
	private entryHost: string;
	// Resolution is per-isolate; a failed resolution is not memoized so the
	// next request retries rather than pinning the failure.
	private resolved: Promise<{ did: string; pds: string }> | null = null;

	constructor(config: AtprotoContentConfig) {
		this.repo = config.repo;
		this.collection = config.collection ?? UNFOLDING_COLLECTION;
		this.entryHost = config.entryHost ?? DEFAULT_ENTRY_HOST;
	}

	private resolve(): Promise<{ did: string; pds: string }> {
		if (!this.resolved) {
			this.resolved = resolveRepo(this.repo, this.entryHost).catch((err) => {
				this.resolved = null;
				throw err;
			});
		}
		return this.resolved;
	}

	async listEntries(): Promise<UnfoldingSummary[]> {
		const { did, pds } = await this.resolve();
		const entries: UnfoldingEntry[] = [];
		let cursor: string | undefined;
		for (let page = 0; page < MAX_LIST_PAGES; page++) {
			const result = await listRecords(pds, did, this.collection, { cursor });
			for (const record of result.records) {
				const entry = recordToEntry(record);
				if (entry) entries.push(entry);
			}
			cursor = result.cursor;
			if (!cursor || result.records.length === 0) break;
		}
		// Display order is newest first. The module encoded it as array order;
		// records have no order, so the published date carries it (ISO strings
		// compare lexically).
		entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
		return entries.map(toUnfoldingSummary);
	}

	async getEntry(slug: string): Promise<UnfoldingEntry | null> {
		if (!isValidSlug(slug)) return null;
		const { did, pds } = await this.resolve();
		const record = await getRecord(pds, did, this.collection, slug);
		return record ? recordToEntry(record) : null;
	}

	async listVoices(): Promise<WigglingVoice[]> {
		return wigglingVoices;
	}
}
