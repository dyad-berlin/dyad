import { unfoldingEntries } from '$lib/content/unfolding';
import { CachedContentService, type ContentKV } from '$lib/server/content-cache';

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
export type UnfoldingSummary = Omit<UnfoldingEntry, 'paragraphs'>;

export interface ContentService {
	/** All entries as summaries, in display order (newest first). */
	listEntries(): Promise<UnfoldingSummary[]>;
	/** The full entry for a slug, or null when unknown. Never throws on bad input. */
	getEntry(slug: string): Promise<UnfoldingEntry | null>;
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
	return entry.paragraphs.every(
		(p) => typeof p === 'string' && p.length <= MAX_PARAGRAPH_LENGTH
	);
}

function toSummary(entry: UnfoldingEntry): UnfoldingSummary {
	// Rest-destructure so the summary carries no `paragraphs` key at all,
	// not a `paragraphs: undefined`.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { paragraphs, ...summary } = entry;
	return summary;
}

/**
 * Adapter over the in-repo content module. Carries the boundary through the
 * migration; retired when content moves to a runtime source.
 */
export class ModuleContentService implements ContentService {
	// The entries parameter is a test seam; production callers use the default.
	constructor(private entries: UnfoldingEntry[] = unfoldingEntries) {}

	async listEntries(): Promise<UnfoldingSummary[]> {
		return this.entries.filter((entry) => this.passesGuard(entry)).map(toSummary);
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
 * The injection point route loaders use. With the CONTENT_KV binding present
 * on the platform (production and preview deployments, where the binding is
 * dashboard-managed), returns the KV-cached service wrapping the module
 * adapter; without it (local dev, vitest), transparently returns the bare
 * adapter, so a missing binding degrades to uncached reads rather than
 * breaking a page.
 */
export function getContentService(platform?: App.Platform): ContentService {
	const kv = platform?.env?.CONTENT_KV;
	if (cachedService && cachedBinding === kv) return cachedService;
	cachedBinding = kv;
	cachedService = kv
		? new CachedContentService(new ModuleContentService(), kv)
		: new ModuleContentService();
	return cachedService;
}

/** Test hook: reset module cache state between test cases. */
export function _resetContentCache(): void {
	cachedService = null;
	cachedBinding = undefined;
}
