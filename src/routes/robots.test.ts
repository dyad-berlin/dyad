import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://abc.supabase.co' }));

const { NON_PUBLIC_PREFIXES, PUBLIC_PATHS, SITE_ORIGIN } = await import('../lib/seo.js');

const robots = readFileSync(
	fileURLToPath(new URL('../../static/robots.txt', import.meta.url)),
	'utf-8'
);

const disallowed = robots
	.split('\n')
	.filter((l) => l.trim().toLowerCase().startsWith('disallow:'))
	.map((l) => l.split(':')[1].trim())
	.filter(Boolean);

describe('static/robots.txt', () => {
	it('points crawlers at the sitemap on the canonical origin', () => {
		const sitemap = robots.match(/^Sitemap:\s*(\S+)/m)?.[1];
		expect(sitemap).toBe(`${SITE_ORIGIN}/sitemap.xml`);
	});

	it('disallows every gated prefix', () => {
		// The mirror check: a prefix added to seo.ts without a matching Disallow
		// would leave a gated surface crawlable.
		for (const prefix of NON_PUBLIC_PREFIXES) {
			expect(disallowed).toContain(prefix);
		}
	});

	it('disallows nothing that is not a declared gated prefix', () => {
		for (const rule of disallowed) {
			expect(NON_PUBLIC_PREFIXES).toContain(rule);
		}
	});

	it('leaves every public path crawlable under real robots semantics', () => {
		// RFC 9309 matches Disallow values as a bare prefix, not on path segments:
		// `Disallow: /join` blocks `/joined` too. Modelling it with the separator-
		// aware rule that isPublicPath uses would make this test agree with seo.ts
		// while both disagree with the crawler — exactly the bug it exists to
		// catch, since a public path shadowed by a gated prefix would pass.
		for (const path of PUBLIC_PATHS) {
			const blocked = disallowed.some((d) => path.startsWith(d));
			expect(blocked, `${path} is blocked by robots.txt under bare-prefix matching`).toBe(false);
		}
	});

	it('declares a User-agent before any Disallow line', () => {
		const firstAgent = robots.split('\n').findIndex((l) => /^user-agent:/i.test(l.trim()));
		const firstDisallow = robots.split('\n').findIndex((l) => /^disallow:/i.test(l.trim()));
		expect(firstAgent).toBeGreaterThanOrEqual(0);
		expect(firstAgent).toBeLessThan(firstDisallow);
	});
});
