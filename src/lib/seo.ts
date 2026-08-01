import { PUBLIC_SUPABASE_URL } from '$env/static/public';

/**
 * Canonical origin for the public site.
 *
 * Deliberately duplicates the derivation in `$lib/server/app-origin`, which
 * cannot be imported here: SvelteKit forbids `$lib/server/*` in code that
 * reaches the client, and the canonical tag is emitted from the root layout.
 * `seo.test.ts` asserts the two stay equal, so the duplication cannot drift
 * silently.
 */
const IS_LOCAL =
	PUBLIC_SUPABASE_URL?.includes('localhost') || PUBLIC_SUPABASE_URL?.includes('127.0.0.1');

export const SITE_ORIGIN = IS_LOCAL ? 'http://localhost:5173' : 'https://dyad.social';

/**
 * Path prefixes that must never be indexed: the authenticated app, the admin
 * plane, the editor, auth flows, and the API. Mirrored by the Disallow list in
 * `static/robots.txt` — `robots.test.ts` asserts the two agree.
 */
export const NON_PUBLIC_PREFIXES = [
	'/admin',
	'/api',
	'/discover',
	'/conversations',
	'/meetings',
	'/feedback',
	'/profile',
	'/membership',
	'/users',
	'/login',
	'/signup',
	'/join',
	'/welcome',
	'/access-ended',
	'/logout',
	'/dev'
] as const;

/**
 * Public paths with stable URLs. `/newsletter/[slug]` entries are enumerated
 * from the content module at request time rather than listed here.
 */
export const PUBLIC_PATHS = [
	'/',
	'/zine',
	'/wiggling',
	'/newsletter',
	'/community-care',
	'/docs',
	'/waitlist',
	'/impressum',
	'/datenschutz',
	'/agb',
	'/legal'
] as const;

export function isPublicPath(pathname: string): boolean {
	return !NON_PUBLIC_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
	);
}

/**
 * Absolute canonical URL for a path, always on the canonical origin.
 *
 * Built from the origin rather than the request host on purpose: dyad.amsterdam
 * and the Cloudflare preview subdomains serve the same public pages, and a
 * host-derived canonical would declare each duplicate authoritative instead of
 * consolidating them.
 */
export function canonicalUrl(pathname: string): string {
	const [rawPath] = pathname.split(/[?#]/);
	const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
	return SITE_ORIGIN + (path.startsWith('/') ? path : '/' + path);
}

export interface ArticleMeta {
	title: string;
	description: string;
	path: string;
	datePublished?: string;
}

/**
 * JSON-LD `Article` for a published essay, ready to embed in a script tag.
 *
 * Serialised with `JSON.stringify` and then escaped for the one character
 * sequence that can terminate a script element early: a literal `</` inside
 * the JSON would close the tag and spill the remainder into the document as
 * markup. This is a different hazard from HTML text escaping, so
 * `$lib/utils/escape-html` is deliberately not used here.
 */
export function articleJsonLd(meta: ArticleMeta): string {
	const data: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline: meta.title,
		description: meta.description,
		url: canonicalUrl(meta.path),
		publisher: {
			'@type': 'Organization',
			name: 'dyad',
			url: SITE_ORIGIN
		}
	};
	if (meta.datePublished) data.datePublished = meta.datePublished;

	return JSON.stringify(data).replace(/<\//g, '<\\/');
}
