import { describe, it, expect, vi } from 'vitest';

// Env-override scenarios live in their own file: wiggling-load.test.ts pins
// the env to the fixture's capture conditions with its own hoisted mock, and
// one hoisted mock per file is the only shape vitest's module cache honours
// for transitive imports (storage-url reads the env at module load).
vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_VIDEO_BASE_URL: 'https://video.example',
		PUBLIC_STORAGE_BASE_URL: 'https://assets.example'
	}
}));

const { wigglingVoices } = await import('$lib/content/wiggling');

describe('wiggling env overrides', () => {
	it('reel sources honour PUBLIC_VIDEO_BASE_URL when set', () => {
		expect(wigglingVoices).toHaveLength(4);
		for (const voice of wigglingVoices) {
			expect(voice.src).toMatch(/^https:\/\/video\.example\/voices\//);
		}
	});

	it('poster URLs resolve through storageUrl() and honour PUBLIC_STORAGE_BASE_URL when set', () => {
		for (const voice of wigglingVoices) {
			expect(voice.poster).toMatch(
				/^https:\/\/assets\.example\/storage\/v1\/object\/public\/newsletter%20assets\/voices\//
			);
		}
	});
});
