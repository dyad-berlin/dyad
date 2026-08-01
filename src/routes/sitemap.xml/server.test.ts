import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://abc.supabase.co' }));

const { GET } = await import('./+server.js');
const { PUBLIC_PATHS, NON_PUBLIC_PREFIXES, canonicalUrl } = await import('$lib/seo');
const { unfoldingEntries } = await import('$lib/content/unfolding');

async function render() {
	const headers: Record<string, string> = {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const res: Response = await (GET as any)({
		setHeaders: (h: Record<string, string>) => Object.assign(headers, h)
	});
	return { body: await res.text(), headers };
}

const locsOf = (body: string) => [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

describe('GET /sitemap.xml', () => {
	it('serves XML', async () => {
		const { headers } = await render();
		expect(headers['Content-Type']).toBe('application/xml');
	});

	it('declares the sitemap namespace and a matching urlset', async () => {
		const { body } = await render();
		expect(body).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
		expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
		expect(body.trimEnd()).toMatch(/<\/urlset>$/);
	});

	it('lists every declared public path', async () => {
		const locs = locsOf((await render()).body);
		for (const path of PUBLIC_PATHS) {
			expect(locs).toContain(canonicalUrl(path));
		}
	});

	it('lists every published newsletter entry', async () => {
		const locs = locsOf((await render()).body);
		for (const entry of unfoldingEntries) {
			expect(locs).toContain(canonicalUrl(`/newsletter/${entry.slug}`));
		}
	});

	it('uses the canonical origin, never a request host', async () => {
		const locs = locsOf((await render()).body);
		expect(locs.length).toBeGreaterThan(0);
		for (const loc of locs) {
			expect(loc.startsWith('https://dyad.social')).toBe(true);
		}
	});

	it('lists no gated route', async () => {
		const locs = locsOf((await render()).body);
		for (const loc of locs) {
			const path = new URL(loc).pathname;
			for (const prefix of NON_PUBLIC_PREFIXES) {
				expect(path === prefix || path.startsWith(prefix + '/')).toBe(false);
			}
		}
	});

	it('emits lastmod for entries that carry a date', async () => {
		const { body } = await render();
		for (const entry of unfoldingEntries) {
			expect(body).toContain(`<lastmod>${entry.date}</lastmod>`);
		}
	});

	it('emits no duplicate URLs', async () => {
		const locs = locsOf((await render()).body);
		expect(new Set(locs).size).toBe(locs.length);
	});

	it('escapes XML metacharacters so a stray ampersand cannot break the document', async () => {
		const { body } = await render();
		// Any bare & that is not already an entity would make this invalid XML.
		expect(body).not.toMatch(/&(?!(amp|lt|gt|quot|apos);)/);
	});
});
