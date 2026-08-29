import { env } from '$env/dynamic/private';
import type { JSONContent } from '@tiptap/core';
import { validateEssayBody } from '$lib/server/validate-essay-body';
import { unfoldingEntries } from '$lib/content/unfolding';
import { wigglingVoices } from '$lib/content/wiggling';
import { CachedContentService, type ContentKV } from '$lib/server/content-cache';
import { AtprotoContentService } from '$lib/services/content-atproto';
import { SupabaseContentService, supabaseContentDb } from '$lib/services/content-supabase';
import { makeAdminClient } from '$lib/server/supabase-admin';

/**
 * Content boundary for the zine surfaces (newsletter, Wiggling). Wraps the
 * concrete source (the in-repo content modules today) so routes don't import
 * content modules directly. One swap point here when content moves to a
 * runtime source — the source decision is made behind this interface, not
 * in the route loaders.
 *
 * Async from the outset even though the module adapter is synchronous, so a
 * later adapter that performs network reads is not a signature change.
 */

// Moved here from src/lib/content/unfolding.ts so the contract type survives
// the content module's eventual retirement; unfolding.ts imports it back.
export interface UnfoldingEntry {
	slug: string;
	kicker: string; // zine chapter this essay is drawn from
	title: string;
	dek?: string; // optional subtitle, shown under the title
	quote: string;
	quoteAttr?: string; // omitted when the quote is dyad's own words
	date: string; // ISO date, published date
	paragraphs: string[];
	// TipTap JSON body (plan KTD2's one budgeted contract change, spent at
	// U7). When present it carries the essay and paragraphs is empty; when
	// absent, paragraphs carries it via the segments.ts inline grammar.
	// Validated by $lib/server/validate-essay-body (structure + no inline
	// media); rendered only through $lib/utils/tiptap-html.
	body?: JSONContent;
	// Hero image path within the "newsletter assets" Supabase bucket. Falls
	// back to the textured placeholder panel when unset.
	heroImage?: string;
	heroCredit?: string; // photo credit, shown bottom-right under the image
	heroCreditUrl?: string; // link target for heroCredit, e.g. the artist's profile
}

/**
 * The entry without its body. The archive page and the sitemap read only
 * metadata; shipping every essay body on every archive request would grow
 * that payload linearly with the catalogue.
 */
export type UnfoldingSummary = Omit<UnfoldingEntry, 'paragraphs' | 'body'>;

// Moved here from the Wiggling page component (see src/lib/content/wiggling.ts).
export interface WigglingVoice {
	src: string; // self-hosted reel
	poster: string; // poster frame, resolved through storageUrl()
	name: string;
	episode: string; // outbound link to the full conversation — a link, never an embed
}

export interface ContentService {
	/** All entries as summaries, in display order (newest first). */
	listEntries(): Promise<UnfoldingSummary[]>;
	/** The full entry for a slug, or null when unknown. Never throws on bad input. */
	getEntry(slug: string): Promise<UnfoldingEntry | null>;
	/** The Wiggling voices, in display order. */
	listVoices(): Promise<WigglingVoice[]>;
}

// Bounds for the shape guard. The adapter output is checked at the port —
// the single place every source's records pass — so a malformed record from
// any future source is skipped and logged rather than rendered.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 128;
const MAX_FIELD_LENGTH = 1000;
const MAX_PARAGRAPH_LENGTH = 20_000;
const MAX_PARAGRAPH_COUNT = 200;

export function isValidSlug(slug: string): boolean {
	return slug.length > 0 && slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug);
}

function isBoundedString(value: unknown): value is string {
	return typeof value === 'string' && value.length <= MAX_FIELD_LENGTH;
}

function isBoundedOptionalString(value: unknown): boolean {
	return value === undefined || isBoundedString(value);
}

/**
 * Shape guard every adapter's output passes before it can reach a page.
 * Returns false rather than throwing: a bad record is skipped and logged,
 * and the rest of the listing still renders.
 */
export function isValidUnfoldingEntry(value: unknown): value is UnfoldingEntry {
	if (typeof value !== 'object' || value === null) return false;
	const entry = value as Record<string, unknown>;

	if (typeof entry.slug !== 'string' || !isValidSlug(entry.slug)) return false;
	if (!isBoundedString(entry.kicker)) return false;
	if (!isBoundedString(entry.title) || entry.title.length === 0) return false;
	if (!isBoundedString(entry.quote)) return false;
	if (!isBoundedString(entry.date)) return false;
	if (!isBoundedOptionalString(entry.dek)) return false;
	if (!isBoundedOptionalString(entry.quoteAttr)) return false;
	if (!isBoundedOptionalString(entry.heroImage)) return false;
	if (!isBoundedOptionalString(entry.heroCredit)) return false;
	if (!isBoundedOptionalString(entry.heroCreditUrl)) return false;

	if (!Array.isArray(entry.paragraphs) || entry.paragraphs.length > MAX_PARAGRAPH_COUNT) {
		return false;
	}
	if (
		!entry.paragraphs.every((p) => typeof p === 'string' && p.length <= MAX_PARAGRAPH_LENGTH)
	) {
		return false;
	}

	// Body variant (KTD2): optional TipTap JSON, validated structurally and
	// against the no-inline-media rule. An entry must carry a body, some
	// paragraphs, or both — an empty essay is a malformed record.
	if (entry.body !== undefined && validateEssayBody(entry.body) !== null) return false;
	return entry.body !== undefined || entry.paragraphs.length > 0;
}

export function toUnfoldingSummary(entry: UnfoldingEntry): UnfoldingSummary {
	// Rest-destructure so the summary carries no `paragraphs`/`body` key at
	// all, not keys set to undefined.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { paragraphs, body, ...summary } = entry;
	return summary;
}

/**
 * Adapter over the in-repo content module. Carries the boundary through the
 * migration; retired when content moves to a runtime source.
 */
export class ModuleContentService implements ContentService {
	// The entries/voices parameters are a test seam; production callers use the defaults.
	constructor(
		private entries: UnfoldingEntry[] = unfoldingEntries,
		private voices: WigglingVoice[] = wigglingVoices
	) {}

	async listEntries(): Promise<UnfoldingSummary[]> {
		return this.entries.filter((entry) => this.passesGuard(entry)).map(toUnfoldingSummary);
	}

	async listVoices(): Promise<WigglingVoice[]> {
		return this.voices;
	}

	async getEntry(slug: string): Promise<UnfoldingEntry | null> {
		if (!isValidSlug(slug)) return null;
		const entry = this.entries.find((e) => e.slug === slug);
		if (!entry || !this.passesGuard(entry)) return null;
		// Identity guarantee: for a known slug the module's entry is returned
		// structurally unchanged — no reorder, no reshape, no normalisation.
		return entry;
	}

	private passesGuard(entry: UnfoldingEntry): boolean {
		if (isValidUnfoldingEntry(entry)) return true;
		const label =
			typeof (entry as { slug?: unknown })?.slug === 'string'
				? (entry as { slug: string }).slug
				: '(no slug)';
		console.error(`content: entry ${label} failed the shape guard and was skipped`);
		return false;
	}
}

let cachedService: ContentService | null = null;
let cachedBinding: ContentKV | undefined;

/**
 * Source selection is a config gate (plan U5/KTD6): the module adapter is the
 * default everywhere; the atproto spike adapter activates only when
 * CONTENT_SOURCE=atproto and a repo is named — intended for preview
 * deployments during the spike, never a silent production switch.
 */
function makeSourceAdapter(): ContentService {
	if (env.CONTENT_SOURCE === 'supabase') {
		// U7's chosen source (Branch B): published rows via the service-role
		// client. Gated so the module adapter stays the default until the U8
		// cutover flips it deliberately.
		return new SupabaseContentService(supabaseContentDb(makeAdminClient()));
	}
	if (env.CONTENT_SOURCE === 'atproto' && env.CONTENT_ATPROTO_REPO) {
		return new AtprotoContentService({
			repo: env.CONTENT_ATPROTO_REPO,
			entryHost: env.CONTENT_ATPROTO_ENTRY_HOST || undefined
		});
	}
	return new ModuleContentService();
}

/**
 * The injection point route loaders use. With the CONTENT_KV binding present
 * on the platform (production and preview deployments, where the binding is
 * dashboard-managed), returns the KV-cached service wrapping the source
 * adapter; without it (local dev, vitest), transparently returns the bare
 * adapter, so a missing binding degrades to uncached reads rather than
 * breaking a page.
 */
export function getContentService(platform?: App.Platform): ContentService {
	const kv = platform?.env?.CONTENT_KV;
	if (cachedService && cachedBinding === kv) return cachedService;
	cachedBinding = kv;
	const source = makeSourceAdapter();
	cachedService = kv ? new CachedContentService(source, kv) : source;
	return cachedService;
}

/** Test hook: reset module cache state between test cases. */
export function _resetContentCache(): void {
	cachedService = null;
	cachedBinding = undefined;
}
