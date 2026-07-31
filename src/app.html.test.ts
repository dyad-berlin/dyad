import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The PWA install signals live in static HTML and build config, so nothing else
 * in the toolchain can see them: svelte-check, the build, and Lighthouse all
 * pass with them missing, and the only symptom is on a real iOS device.
 *
 * That is not hypothetical. Commit 0517da70 carried a sub-commit titled "Fix
 * deprecated apple-mobile-web-app-capable meta tag" — correct Chromium advice,
 * but WebKit never implemented the unprefixed name, so iOS silently lost
 * standalone display for six months. These assertions are the forcing function
 * that was missing.
 */

const shell = readFileSync(fileURLToPath(new URL('./app.html', import.meta.url)), 'utf-8');
const viteConfig = readFileSync(
	fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
	'utf-8'
);

describe('app.html PWA install signals', () => {
	it('carries both standalone-capable meta names', () => {
		// WebKit reads only the apple- form; Chromium reads only the unprefixed
		// one and warns on the apple- form. Dropping either loses a platform.
		expect(shell).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
		expect(shell).toContain('<meta name="mobile-web-app-capable" content="yes" />');
	});

	it('links the web app manifest', () => {
		// @vite-pwa/sveltekit generates the manifest but does not inject this
		// link, so without it no document ever references the manifest and both
		// Chromium install and the iOS display fallback go dark.
		expect(shell).toMatch(/<link\s+rel="manifest"\s+href="[^"]+"\s*\/>/);
	});

	it('links a manifest href matching manifestFilename in vite.config.ts', () => {
		const href = shell.match(/<link\s+rel="manifest"\s+href="([^"]+)"/)?.[1];
		const filename = viteConfig.match(/manifestFilename:\s*'([^']+)'/)?.[1];

		expect(href).toBeDefined();
		expect(filename).toBeDefined();
		// app.html cannot import from vite.config.ts, so the href is hand-written.
		// This is the only thing keeping the two from drifting apart.
		expect(href).toBe(`/${filename}`);
	});

	it('keeps the apple-touch-icon that iOS uses for the Home Screen', () => {
		expect(shell).toContain('rel="apple-touch-icon"');
	});
});
