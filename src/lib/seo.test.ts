import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://abc.supabase.co' }));

const { canonicalUrl, isPublicPath, articleJsonLd, SITE_ORIGIN, PUBLIC_PATHS, NON_PUBLIC_PREFIXES } =
	await import('./seo.js');

describe('canonicalUrl', () => {
	it('builds an absolute URL on the canonical origin', () => {
		expect(canonicalUrl('/wiggling')).toBe('https://dyad.social/wiggling');
	});

	it('leaves the root path as a single slash', () => {
		// A naive strip would produce 'https://dyad.social' with no path, and
		// declaring a canonical without a path is not the same URL.
		expect(canonicalUrl('/')).toBe('https://dyad.social/');
	});

	it('drops query strings so tracking params do not fragment the canonical', () => {
		expect(canonicalUrl('/zine?utm_source=newsletter')).toBe('https://dyad.social/zine');
	});

	it('drops hash fragments', () => {
		expect(canonicalUrl('/docs#governance')).toBe('https://dyad.social/docs');
	});

	it('strips a trailing slash so /wiggling and /wiggling/ agree', () => {
		expect(canonicalUrl('/wiggling/')).toBe(canonicalUrl('/wiggling'));
	});

	it('never doubles the slash after the origin', () => {
		for (const p of ['/', '/zine', '/newsletter/some-entry']) {
			expect(canonicalUrl(p)).not.toMatch(/[^:]\/\//);
		}
	});
});

describe('SITE_ORIGIN', () => {
	it('matches the server-side APP_ORIGIN so the two derivations cannot drift', async () => {
		// seo.ts cannot import $lib/server; this test is the only thing keeping
		// the duplicated origin logic honest.
		const { APP_ORIGIN } = await import('./server/app-origin.js');
		expect(SITE_ORIGIN).toBe(APP_ORIGIN);
	});
});

describe('articleJsonLd', () => {
	const base = {
		title: 'Conversation: A primal technology for sensemaking',
		description: 'A short standfirst.',
		path: '/newsletter/conversation-is-a-fundamental-technology',
		datePublished: '2026-07-20'
	};

	it('produces parseable JSON declaring an Article', () => {
		const parsed = JSON.parse(articleJsonLd(base));
		expect(parsed['@type']).toBe('Article');
		expect(parsed['@context']).toBe('https://schema.org');
	});

	it('uses the canonical URL for the entry', () => {
		const parsed = JSON.parse(articleJsonLd(base));
		expect(parsed.url).toBe(canonicalUrl(base.path));
	});

	it('carries the publication date when present', () => {
		expect(JSON.parse(articleJsonLd(base)).datePublished).toBe('2026-07-20');
	});

	it('omits datePublished entirely when absent, rather than emitting null', () => {
		const parsed = JSON.parse(articleJsonLd({ ...base, datePublished: undefined }));
		expect('datePublished' in parsed).toBe(false);
	});

	it('survives quotes and angle brackets in the title', () => {
		const parsed = JSON.parse(
			articleJsonLd({ ...base, title: 'She said "why" <not> how' })
		);
		expect(parsed.headline).toBe('She said "why" <not> how');
	});

	it('escapes a closing script sequence so the tag cannot terminate early', () => {
		// A literal `</script>` inside the JSON would end the script element and
		// spill the rest of the document as markup.
		const out = articleJsonLd({ ...base, description: 'ends here </script><img src=x>' });
		expect(out).not.toContain('</script>');
		expect(JSON.parse(out).description).toBe('ends here </script><img src=x>');
	});

	it('escapes the script-data-double-escape sequence, not just the closing tag', () => {
		// Inside a script element the tokenizer also reacts to `<!--` followed by
		// `<script`, which swallows the rest of the head. Escaping only `</` leaves
		// this open, so the assertion is that no raw `<` survives at all.
		const out = articleJsonLd({ ...base, title: 'a <!--<script> b' });
		expect(out).not.toContain('<');
		expect(JSON.parse(out).headline).toBe('a <!--<script> b');
	});

	it('carries an image when given one, since Article rich results require it', () => {
		const img = 'https://cdn.example/storage/v1/object/public/newsletter%20assets/hero.jpg';
		expect(JSON.parse(articleJsonLd({ ...base, image: img })).image).toBe(img);
	});

	it('omits image entirely when the entry has no hero', () => {
		expect('image' in JSON.parse(articleJsonLd(base))).toBe(false);
	});

	it('names the publisher', () => {
		const parsed = JSON.parse(articleJsonLd(base));
		expect(parsed.publisher.name).toBe('dyad');
		expect(parsed.publisher.url).toBe(SITE_ORIGIN);
	});
});

describe('isPublicPath', () => {
	it('accepts every declared public path', () => {
		for (const p of PUBLIC_PATHS) expect(isPublicPath(p)).toBe(true);
	});

	it('rejects every non-public prefix and its children', () => {
		for (const prefix of NON_PUBLIC_PREFIXES) {
			expect(isPublicPath(prefix)).toBe(false);
			expect(isPublicPath(prefix + '/anything')).toBe(false);
		}
	});

	it('accepts newsletter entry paths', () => {
		expect(isPublicPath('/newsletter/conversation-is-a-fundamental-technology')).toBe(true);
	});

	it('does not reject a public path that merely starts with a gated prefix', () => {
		// Each shares a full prefix with a gated path, so a bare startsWith would
		// return false and fail here. A path that only resembles a prefix without
		// containing it passes either way and would not test anything.
		expect(isPublicPath('/joined')).toBe(true); // vs '/join'
		expect(isPublicPath('/apirary')).toBe(true); // vs '/api'
		expect(isPublicPath('/administration')).toBe(true); // vs '/admin'
	});
});
