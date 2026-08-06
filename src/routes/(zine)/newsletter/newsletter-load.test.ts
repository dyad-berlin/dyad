import { describe, it, expect } from 'vitest';
import type { UnfoldingEntry, UnfoldingSummary } from '$lib/services/content';
import baseline from './newsletter-baseline.fixture.json';
import { load as archiveLoad } from './+page.server';
import { load as slugLoad } from './[slug]/+page.server';

// Characterisation against the committed pre-migration baseline: the loaders
// must return what the pages received before the port existed. Recaptured
// immediately before cutover when the module adapter is retired.

type ArchiveEvent = Parameters<typeof archiveLoad>[0];
type SlugEvent = Parameters<typeof slugLoad>[0];

const slugs = Object.keys(baseline.entries);

async function archivePayload(): Promise<{ entries: UnfoldingSummary[] }> {
	return (await archiveLoad({} as ArchiveEvent)) as { entries: UnfoldingSummary[] };
}

describe('/newsletter archive load', () => {
	it('payload equals the baseline: same order, summary fields intact, no paragraphs', async () => {
		const result = await archivePayload();
		expect(result.entries).toEqual(baseline.archive);
	});

	it('the newest entry is first, so the page features it', async () => {
		const result = await archivePayload();
		expect(result.entries[0].slug).toBe(baseline.archive[0].slug);
	});

	it('ships no essay bodies', async () => {
		const result = await archivePayload();
		for (const entry of result.entries) {
			expect('paragraphs' in entry).toBe(false);
		}
	});
});

describe('/newsletter/[slug] load', () => {
	it('returns the full entry for every baseline slug, equal to its capture', async () => {
		expect(slugs.length).toBeGreaterThan(0);
		for (const slug of slugs) {
			const result = (await slugLoad({ params: { slug } } as SlugEvent)) as {
				entry: UnfoldingEntry;
			};
			expect(result.entry).toEqual(baseline.entries[slug as keyof typeof baseline.entries]);
		}
	});

	it('throws a 404 for an unknown slug, matching pre-migration behaviour', async () => {
		await expect(slugLoad({ params: { slug: 'no-such-essay' } } as SlugEvent)).rejects.toMatchObject(
			{
				status: 404
			}
		);
	});
});
