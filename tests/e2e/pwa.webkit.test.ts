import { test, expect } from '@playwright/test';

/**
 * WebKit-only: the install signals iOS actually reads.
 *
 * src/app.html.test.ts pins the tags in the source file. These assert the
 * engine that ships in iOS Safari reaches them in the served HTML and acts on
 * them — which is the part no Chromium-based check can establish. Chrome
 * DevTools, Lighthouse, and the other two Playwright projects are all Blink,
 * and Blink is what suggested the rename that broke iOS in the first place.
 */

test.describe('PWA install signals in WebKit', () => {
	test('WebKit parses both capability metas and the manifest link', async ({ page }) => {
		await page.goto('/');

		const tags = await page.evaluate(() =>
			[
				...document.querySelectorAll(
					'meta[name*="web-app"], link[rel="manifest"], link[rel="apple-touch-icon"]'
				)
			].map((el) => el.outerHTML)
		);

		// WebKit reads only the apple- form; dropping it is what cost iOS
		// standalone display for six months (commit 0517da70).
		expect(tags.join('\n')).toContain('name="apple-mobile-web-app-capable"');
		expect(tags.join('\n')).toContain('name="mobile-web-app-capable"');
		expect(tags.join('\n')).toContain('rel="manifest"');
		expect(tags.join('\n')).toContain('rel="apple-touch-icon"');
	});

	test('WebKit fetches the manifest on its own, and it is valid', async ({ page, baseURL }) => {
		// The manifest is emitted by the build; devOptions is off, so under
		// `npm run dev` it 404s and there is nothing to assert. CI runs against
		// `npm run build && npm run preview`, where this is the real check.
		const probe = await page.request.get(`${baseURL}/manifest.webmanifest`);
		test.skip(
			probe.status() === 404,
			'manifest is build-only (devOptions disabled); run against a build, as CI does'
		);

		const requests: string[] = [];
		page.on('request', (r) => requests.push(r.url()));

		await page.goto('/');
		await page.waitForLoadState('load');

		// Unprompted by any script: WebKit follows the link element itself.
		// Chromium does not do this on load, so this assertion only means
		// something in this project.
		await expect
			.poll(() => requests.some((u) => u.includes('manifest.webmanifest')), { timeout: 5000 })
			.toBe(true);

		const manifest = await probe.json();
		expect(manifest.display).toBe('standalone');
		expect(manifest.start_url).toBe('/');
		expect(manifest.scope).toBe('/');
		expect(manifest.id).toBe('/');

		// The Home Screen icon has to actually exist, or the install is broken in
		// a way the manifest alone will not reveal.
		const icon = await page.request.get(`${baseURL}/icon-192.png`);
		expect(icon.status()).toBe(200);
	});
});
