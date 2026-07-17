import { describe, it, expect, vi } from 'vitest';

// A deployment with no ATPROTO_* env: the provider must disable itself, which
// 404s every atproto surface via the registry filter. Own file so the empty-env
// mock does not collide with the configured mock in atproto.test.ts.
vi.mock('$env/dynamic/private', () => ({ env: {} }));

describe('atproto provider (unconfigured)', () => {
	it('is null when required env is absent', async () => {
		const { atprotoProvider } = await import('./atproto.js');
		expect(atprotoProvider()).toBeNull();
	});

	it('serves no client metadata', async () => {
		const { getAtprotoClientMetadata } = await import('./atproto.js');
		expect(getAtprotoClientMetadata()).toBeNull();
	});
});
