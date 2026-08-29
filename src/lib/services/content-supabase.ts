import type { JSONContent } from '@tiptap/core';
import { env } from '$env/dynamic/public';
import { storageUrl } from '$lib/utils/storage-url';
import {
	isValidSlug,
	isValidUnfoldingEntry,
	toUnfoldingSummary,
	type ContentService,
	type UnfoldingEntry,
	type UnfoldingSummary,
	type WigglingVoice
} from '$lib/services/content';

/**
 * The content source chosen at the plan's U6 gate (Branch B, admin plane
 * over Postgres — docs/plans/2026-08-05-001-source-decision.md). Reads
 * published rows from unfolding_entries / wiggling_voices through the
 * service-role client: both tables are RLS-on-no-policies, invisible to anon
 * and authenticated roles, so this is the only read path — the
 * copy-overrides posture. The KV cache in front of the port (U3) keeps this
 * to one DB read per TTL, with last-known-good on failure.
 *
 * Every row passes the port's shape guard before it can reach a page; a
 * malformed row is skipped and logged, and the rest still renders.
 */

/** The column slice this adapter reads; snake_case as stored. */
export interface UnfoldingRow {
	slug: string;
	kicker: string;
	title: string;
	dek: string | null;
	quote: string;
	quote_attr: string | null;
	date: string;
	paragraphs: unknown;
	body: unknown;
	hero_image: string | null;
	hero_credit: string | null;
	hero_credit_url: string | null;
}

export interface WigglingVoiceRow {
	name: string;
	src: string;
	poster: string;
	episode: string;
}

/** Buckets the content surfaces read from and the admin editor writes to. */
export const NEWSLETTER_ASSETS_BUCKET = 'newsletter assets';

// Reel sources resolve against PUBLIC_VIDEO_BASE_URL (sovereign host) or the
// public videos bucket — same rule as the retiring content module. Rows
// store paths, never URLs (R4 structural); resolution happens here.
function videoBase(): string {
	return (
		env.PUBLIC_VIDEO_BASE_URL ??
		'https://iwdjpuyuznzukhowxjhk.supabase.co/storage/v1/object/public/videos'
	);
}

const ENTRY_COLUMNS =
	'slug, kicker, title, dek, quote, quote_attr, date, paragraphs, body, hero_image, hero_credit, hero_credit_url';
const VOICE_COLUMNS = 'name, src, poster, episode';

/**
 * The slice of a PostgREST client this adapter uses, typed structurally so
 * tests pass a stub and no supabase-js types leak into the port.
 */
export interface ContentDbClient {
	listPublishedEntries(): Promise<UnfoldingRow[]>;
	getPublishedEntry(slug: string): Promise<UnfoldingRow | null>;
	listPublishedVoices(): Promise<WigglingVoiceRow[]>;
}

/** Adapter from a supabase-js client to the slice above. */
export function supabaseContentDb(client: {
	from(table: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any
}): ContentDbClient {
	return {
		async listPublishedEntries() {
			const { data, error } = await client
				.from('unfolding_entries')
				.select(ENTRY_COLUMNS)
				.eq('state', 'published')
				.order('date', { ascending: false });
			if (error) throw new Error(`unfolding_entries read failed: ${error.message}`);
			return data ?? [];
		},
		async getPublishedEntry(slug: string) {
			const { data, error } = await client
				.from('unfolding_entries')
				.select(ENTRY_COLUMNS)
				.eq('state', 'published')
				.eq('slug', slug)
				.maybeSingle();
			if (error) throw new Error(`unfolding_entries read failed: ${error.message}`);
			return data ?? null;
		},
		async listPublishedVoices() {
			const { data, error } = await client
				.from('wiggling_voices')
				.select(VOICE_COLUMNS)
				.eq('state', 'published')
				.is('archived_at', null)
				.order('position', { ascending: true });
			if (error) throw new Error(`wiggling_voices read failed: ${error.message}`);
			return data ?? [];
		}
	};
}

/**
 * Row → contract entry. Optional columns map NULL → absent (the contract
 * uses optional fields, and the shape guard distinguishes undefined from
 * null); the guard itself decides validity.
 */
export function rowToEntry(row: UnfoldingRow): UnfoldingEntry | null {
	const candidate: Record<string, unknown> = {
		slug: row.slug,
		kicker: row.kicker,
		title: row.title,
		quote: row.quote,
		date: row.date,
		paragraphs: row.paragraphs ?? []
	};
	if (row.dek !== null) candidate.dek = row.dek;
	if (row.quote_attr !== null) candidate.quoteAttr = row.quote_attr;
	if (row.body !== null && row.body !== undefined) candidate.body = row.body as JSONContent;
	if (row.hero_image !== null) candidate.heroImage = row.hero_image;
	if (row.hero_credit !== null) candidate.heroCredit = row.hero_credit;
	if (row.hero_credit_url !== null) candidate.heroCreditUrl = row.hero_credit_url;

	if (!isValidUnfoldingEntry(candidate)) {
		console.error(
			`content-supabase: row ${String(row.slug)} failed the shape guard and was skipped`
		);
		return null;
	}
	return candidate;
}

export class SupabaseContentService implements ContentService {
	constructor(private db: ContentDbClient) {}

	async listEntries(): Promise<UnfoldingSummary[]> {
		const rows = await this.db.listPublishedEntries();
		const entries: UnfoldingEntry[] = [];
		for (const row of rows) {
			const entry = rowToEntry(row);
			if (entry) entries.push(entry);
		}
		return entries.map(toUnfoldingSummary);
	}

	async getEntry(slug: string): Promise<UnfoldingEntry | null> {
		if (!isValidSlug(slug)) return null;
		const row = await this.db.getPublishedEntry(slug);
		return row ? rowToEntry(row) : null;
	}

	async listVoices(): Promise<WigglingVoice[]> {
		const rows = await this.db.listPublishedVoices();
		const base = videoBase().replace(/\/+$/, '');
		return rows.map((r) => ({
			name: r.name,
			src: `${base}/${r.src}`,
			poster: storageUrl(NEWSLETTER_ASSETS_BUCKET, r.poster),
			episode: r.episode
		}));
	}
}
