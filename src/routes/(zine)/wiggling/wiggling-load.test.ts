import { describe, it, expect, vi } from 'vitest';
import baseline from './wiggling-baseline.fixture.json';

// Pin the env for the equality scenarios: the fixture was captured with no
// PUBLIC_VIDEO_BASE_URL and no PUBLIC_STORAGE_BASE_URL set.
vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { load } = await import('./+page.server');
const { wigglingVoices } = await import('$lib/content/wiggling');

type LoadEvent = Parameters<typeof load>[0];

async function payload() {
	return (await load({} as LoadEvent)) as { voices: typeof wigglingVoices };
}

describe('wiggling content module', () => {
	it('equals the committed pre-extraction fixture — the before/after comparison', () => {
		expect(wigglingVoices).toEqual(baseline.voices);
	});

	it('carries Kaspar, un-archived once his reel reached the bucket', () => {
		expect(wigglingVoices.map((v) => v.name)).toContain('Kaspar Föhres');
		expect(wigglingVoices.some((v) => v.src.includes('kaspar.mp4'))).toBe(true);
	});
});

describe('/wiggling load', () => {
	it('returns all four voices with src, poster, name and episode intact', async () => {
		const { voices } = await payload();
		expect(voices).toHaveLength(4);
		for (const voice of voices) {
			expect(voice.src).toMatch(/^https:\/\//);
			expect(voice.poster).toMatch(/^https:\/\//);
			expect(voice.name.length).toBeGreaterThan(0);
			expect(voice.episode).toMatch(/^https:\/\/www\.youtube\.com\//);
		}
	});

	it('payload equals the fixture', async () => {
		const { voices } = await payload();
		expect(voices).toEqual(baseline.voices);
	});
});
