// Renders the share-preview card from template.html to static/images/.
//
// Usage: node scripts/og-card/render.mjs <output-filename>
// e.g.:  node scripts/og-card/render.mjs og-card-v2.png
//
// Scrapers (Slack, WhatsApp, iMessage) cache og:image by URL with no
// reliable expiry, so a content change MUST ship under a new filename,
// with src/routes/+page.svelte updated to match. Keep old card files in
// place; cached references to them still resolve.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const out = process.argv[2];
if (!out) {
	console.error('usage: node scripts/og-card/render.mjs <output-filename>');
	process.exit(1);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, '../../static/images', out);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto('file://' + path.join(here, 'template.html'));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: target });
await browser.close();
console.log('wrote', target);
