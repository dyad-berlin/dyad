import type { RequestHandler } from './$types';
import { canonicalUrl, PUBLIC_PATHS } from '$lib/seo';
import { getContentService } from '$lib/services/content';
import { escapeHtml } from '$lib/utils/escape-html';

/**
 * Sitemap for the public surface.
 *
 * A route rather than a file in static/ because newsletter entries are data:
 * a checked-in XML file would drift the moment a post is published. URLs are
 * built through the canonical helper so the sitemap and the canonical tags
 * cannot disagree about a page's address.
 */

interface SitemapEntry {
	path: string;
	lastmod?: string;
}

/** W3C date, which is what the sitemap spec accepts for lastmod. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.+Z-]+)?$/;

export const GET: RequestHandler = async ({ setHeaders, locals, platform }) => {
	// Summaries via the content port. The port's shape guard already skips any
	// malformed entry, which would otherwise become /newsletter/undefined in a
	// document search engines treat as authoritative.
	const summaries = await getContentService(platform).listEntries();

	const entries: SitemapEntry[] = [
		...PUBLIC_PATHS.map((path) => ({ path })),
		...summaries.map((entry) => ({
			path: `/newsletter/${entry.slug}`,
			lastmod: ISO_DATE.test(entry.date ?? '') ? entry.date : undefined
		}))
	];

	const urls = entries
		.map(({ path, lastmod }) => {
			// encodeURI first so a slug with a space or non-ASCII character yields a
			// resolvable URL; escapeHtml then covers the XML metacharacters.
			const loc = `\t\t<loc>${escapeHtml(encodeURI(canonicalUrl(path)))}</loc>`;
			const mod = lastmod ? `\n\t\t<lastmod>${escapeHtml(lastmod)}</lastmod>` : '';
			return `\t<url>\n${loc}${mod}\n\t</url>`;
		})
		.join('\n');

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

	// The body is identical for every visitor, so it is shared-cacheable — but
	// only for an anonymous request. A signed-in request runs the same auth
	// pipeline as any other and can carry a refreshed Set-Cookie; pairing that
	// with a public directive is how a shared cache ends up holding someone's
	// session. Cloudflare declines to cache Set-Cookie responses today, which is
	// a platform behaviour rather than a guarantee this code should lean on.
	// Note the anonymous branch's `public, s-maxage` directive is currently
	// advisory: the edge does not cache Worker responses on headers alone
	// (verified DYNAMIC in production, 2026-08-05). The anonymous/signed-in
	// split is the part that matters.
	setHeaders({
		'Content-Type': 'application/xml',
		'Cache-Control': locals.user
			? 'private, no-store'
			: 'public, s-maxage=3600, stale-while-revalidate=86400'
	});

	return new Response(body);
};
