import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	SupabaseContentService,
	rowToEntry,
	type ContentDbClient,
	type UnfoldingRow,
	type WigglingVoiceRow
} from './content-supabase';

function row(partial: Partial<UnfoldingRow>): UnfoldingRow {
	return {
		slug: 'a-valid-slug',
		kicker: 'Kicker',
		title: 'A title',
		dek: null,
		quote: 'A quote.',
		quote_attr: null,
		date: '2026-08-29',
		paragraphs: ['One paragraph.'],
		body: null,
		hero_image: null,
		hero_credit: null,
		hero_credit_url: null,
		...partial
	};
}

const VALID_BODY = {
	type: 'doc',
	content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body.' }] }]
};

function db(overrides: Partial<ContentDbClient> = {}): ContentDbClient {
	return {
		listPublishedEntries: async () => [],
		getPublishedEntry: async () => null,
		listPublishedVoices: async () => [],
		...overrides
	};
}

describe('SupabaseContentService', () => {
	let errorSpy: ReturnType<typeof vi.spyOn>;
	beforeEach(() => {
		errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => {
		errorSpy.mockRestore();
	});

	describe('rowToEntry', () => {
		it('maps a paragraphs row to the contract, NULL optionals absent', () => {
			const entry = rowToEntry(row({}));
			expect(entry).not.toBeNull();
			expect(entry?.slug).toBe('a-valid-slug');
			expect('dek' in entry!).toBe(false);
			expect('body' in entry!).toBe(false);
		});

		it('maps a body row: paragraphs NULL becomes an empty array, body carried', () => {
			const entry = rowToEntry(row({ paragraphs: null, body: VALID_BODY }));
			expect(entry?.paragraphs).toEqual([]);
			expect(entry?.body).toEqual(VALID_BODY);
		});

		it('maps snake_case optionals to the camelCase contract', () => {
			const entry = rowToEntry(
				row({
					quote_attr: 'Someone',
					hero_image: 'heroes/x.webp',
					hero_credit: 'A. Artist',
					hero_credit_url: 'https://example.org'
				})
			);
			expect(entry?.quoteAttr).toBe('Someone');
			expect(entry?.heroImage).toBe('heroes/x.webp');
			expect(entry?.heroCredit).toBe('A. Artist');
			expect(entry?.heroCreditUrl).toBe('https://example.org');
		});

		it('skips and logs a row that fails the shape guard', () => {
			expect(rowToEntry(row({ title: '' }))).toBeNull();
			expect(errorSpy).toHaveBeenCalled();
		});

		it('skips a row whose body carries an inline image', () => {
			const body = {
				type: 'doc',
				content: [{ type: 'image', attrs: { src: 'https://example.org/x.png' } }]
			};
			expect(rowToEntry(row({ paragraphs: null, body }))).toBeNull();
		});

		it('skips an empty essay: no paragraphs and no body', () => {
			expect(rowToEntry(row({ paragraphs: null, body: null }))).toBeNull();
		});
	});

	describe('listEntries', () => {
		it('returns summaries without paragraphs or body, malformed rows skipped', async () => {
			const service = new SupabaseContentService(
				db({
					listPublishedEntries: async () => [
						row({ slug: 'good-one' }),
						row({ slug: 'bad-one', title: '' })
					]
				})
			);
			const summaries = await service.listEntries();
			expect(summaries.map((s) => s.slug)).toEqual(['good-one']);
			expect('paragraphs' in summaries[0]).toBe(false);
			expect('body' in summaries[0]).toBe(false);
		});
	});

	describe('getEntry', () => {
		it('rejects an invalid slug before any DB call', async () => {
			const getPublishedEntry = vi.fn();
			const service = new SupabaseContentService(db({ getPublishedEntry }));
			expect(await service.getEntry('NOT VALID')).toBeNull();
			expect(getPublishedEntry).not.toHaveBeenCalled();
		});

		it('returns null for an unknown slug', async () => {
			const service = new SupabaseContentService(db({}));
			expect(await service.getEntry('unknown-slug')).toBeNull();
		});

		it('propagates a DB failure so the cache layer can serve last-known-good', async () => {
			const service = new SupabaseContentService(
				db({
					getPublishedEntry: async () => {
						throw new Error('db down');
					}
				})
			);
			await expect(service.getEntry('a-valid-slug')).rejects.toThrow('db down');
		});
	});

	describe('listVoices', () => {
		it('resolves stored paths to full URLs — rows never carry URLs (R4)', async () => {
			const voiceRow: WigglingVoiceRow = {
				name: 'Pauline Gwet',
				src: 'voices/pauline.mp4',
				poster: 'voices/pauline.webp',
				episode: 'https://www.youtube.com/watch?v=x'
			};
			const service = new SupabaseContentService(
				db({ listPublishedVoices: async () => [voiceRow] })
			);
			const [voice] = await service.listVoices();
			expect(voice.src).toMatch(/^https:\/\/.+\/voices\/pauline\.mp4$/);
			expect(voice.poster).toMatch(/^https:\/\/.+\/voices\/pauline\.webp$/);
			expect(voice.name).toBe('Pauline Gwet');
			expect(voice.episode).toBe('https://www.youtube.com/watch?v=x');
		});
	});
});
