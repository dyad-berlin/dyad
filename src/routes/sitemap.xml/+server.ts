import type { RequestHandler } from './$types';
import { canonicalUrl, PUBLIC_PATHS } from '$lib/seo';
import { unfoldingEntries } from '$lib/content/unfolding';

/**
 * Sitemap for the public surface.
 *
 * A route rather than a file in static/ because newsletter entries are data:
 * a checked-in XML file would drift the moment a post is published. URLs are
 * built through the canonical helper so the sitemap and the canonical tags
 * cannot disagree about a page's address.
 */

function xmlEscape(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

interface SitemapEntry {
	path: string;
	lastmod?: string;
}

export const GET: RequestHandler = async ({ setHeaders }) => {
	const entries: SitemapEntry[] = [
		...PUBLIC_PATHS.map((path) => ({ path })),
		...unfoldingEntries.map((entry) => ({
			path: `/newsletter/${entry.slug}`,
			lastmod: entry.date
		}))
	];

	const urls = entries
		.map(({ path, lastmod }) => {
			const loc = `\t\t<loc>${xmlEscape(canonicalUrl(path))}</loc>`;
			const mod = lastmod ? `\n\t\t<lastmod>${xmlEscape(lastmod)}</lastmod>` : '';
			return `\t<url>\n${loc}${mod}\n\t</url>`;
		})
		.join('\n');

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

	// Content changes only when a post is published, so a short shared cache with
	// a long stale window keeps crawler traffic off the worker.
	setHeaders({
		'Content-Type': 'application/xml',
		'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
	});

	return new Response(body);
};
