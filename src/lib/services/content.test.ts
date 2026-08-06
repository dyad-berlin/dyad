import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { unfoldingEntries } from '$lib/content/unfolding';
import { ModuleContentService, type UnfoldingEntry } from './content';

function entry(partial: Partial<UnfoldingEntry>): UnfoldingEntry {
	return {
		slug: 'a-valid-slug',
		kicker: 'Kicker',
		title: 'A title',
		quote: 'A quote.',
		date: '2026-08-01',
		paragraphs: ['One paragraph.'],
		...partial
	};
}

describe('ModuleContentService', () => {
	let errorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		errorSpy.mockRestore();
	});

	describe('listEntries', () => {
		it('returns one summary per module entry, in array order, with no paragraphs field', async () => {
			const service = new ModuleContentService();
			const summaries = await service.listEntries();

			expect(summaries).toHaveLength(unfoldingEntries.length);
			summaries.forEach((summary, i) => {
				expect(summary.slug).toBe(unfoldingEntries[i].slug);
				expect('paragraphs' in summary).toBe(false);
			});
		});

		it('carries every non-body field through field-for-field', async () => {
			const service = new ModuleContentService();
			const summaries = await service.listEntries();

			summaries.forEach((summary, i) => {
				const { paragraphs: _paragraphs, ...expected } = unfoldingEntries[i];
				expect(summary).toEqual(expected);
			});
		});
	});

	describe('getEntry', () => {
		it('returns the full entry for a known slug, structurally equal to the module entry', async () => {
			const service = new ModuleContentService();
			for (const source of unfoldingEntries) {
				const got = await service.getEntry(source.slug);
				expect(got).toEqual(source);
			}
		});

		it('returns null for an unknown slug and does not throw', async () => {
			const service = new ModuleContentService();
			await expect(service.getEntry('no-such-essay')).resolves.toBeNull();
		});

		it('returns null for an empty slug', async () => {
			const service = new ModuleContentService();
			await expect(service.getEntry('')).resolves.toBeNull();
		});

		it('returns null for a slug with URL-unsafe characters', async () => {
			const service = new ModuleContentService();
			await expect(service.getEntry('../etc/passwd')).resolves.toBeNull();
			await expect(service.getEntry('a slug with spaces')).resolves.toBeNull();
			await expect(service.getEntry('slug?query=1')).resolves.toBeNull();
		});
	});

	describe('shape guard', () => {
		it('skips a malformed entry, logs via console.error, and still returns the rest', async () => {
			const malformed = [
				entry({ slug: 'good-entry' }),
				// missing title
				{ ...entry({ slug: 'missing-title' }), title: undefined },
				// paragraphs not an array of strings
				{ ...entry({ slug: 'bad-paragraphs' }), paragraphs: [1, 2] },
				// over-length field
				entry({ slug: 'over-length', kicker: 'x'.repeat(2000) })
			] as unknown as UnfoldingEntry[];

			const service = new ModuleContentService(malformed);
			const summaries = await service.listEntries();

			expect(summaries.map((s) => s.slug)).toEqual(['good-entry']);
			expect(errorSpy).toHaveBeenCalledTimes(3);
		});

		it('guards getEntry as well as listings', async () => {
			const malformed = [
				{ ...entry({ slug: 'broken-body' }), paragraphs: 'not an array' }
			] as unknown as UnfoldingEntry[];

			const service = new ModuleContentService(malformed);
			await expect(service.getEntry('broken-body')).resolves.toBeNull();
			expect(errorSpy).toHaveBeenCalledTimes(1);
		});

		it('passes all real module entries', async () => {
			const service = new ModuleContentService();
			const summaries = await service.listEntries();
			expect(summaries).toHaveLength(unfoldingEntries.length);
			expect(errorSpy).not.toHaveBeenCalled();
		});
	});
});
