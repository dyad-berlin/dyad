import { test, expect } from '@playwright/test';

// The zine (community / governance / community-care / docs / voices) and the
// landing pin→card→Join funnel are all anonymous surfaces, so no auth storage
// state is needed. The funnel test depends on seeded geo-located prompts in the
// local Supabase stack; it skips gracefully when no pins are present.
// Steward-ownership was removed (archived to src/lib/archive/) — dyad is not yet
// steward-owned; /community + /docs replaced it in the restructure. /docs is a
// self-contained master-detail surface with its own chrome (no zine header
// wordmark), so it's excluded from this wordmark+footer smoke.

const ZINE_PAGES = ['/community', '/community-care', '/voices'];

test.describe('Zine pages — smoke', () => {
	for (const path of ZINE_PAGES) {
		test(`${path} returns 200 and renders the wordmark + footer`, async ({ page }) => {
			const response = await page.goto(path);
			expect(response?.status()).toBe(200);
			// Wordmark in the zine header.
			await expect(page.locator('.zine-wordmark')).toBeVisible();
			// ZineFooter renders its column headers at the bottom of the page.
			await expect(page.locator('.footer-col-head').first()).toBeVisible();
		});
	}
});

test.describe('Landing — pin → card → Join funnel (best effort)', () => {
	test('clicking a map pin opens a card whose Join CTA opens the waitlist', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('.left-title')).toBeVisible();

		// Wait for the lazy-loaded map markers. If the seed has no geo-located
		// published prompts, there are no pins — skip rather than fail.
		const marker = page.locator('.marker-pin').first();
		try {
			await marker.waitFor({ state: 'visible', timeout: 8000 });
		} catch {
			test.skip(true, 'No geo-located prompts seeded — nothing to click.');
			return;
		}

		await marker.click();
		await expect(page.locator('.map-card')).toBeVisible();

		await page.locator('.map-card-cta').click();
		await expect(page.getByRole('button', { name: /join waitlist/i })).toBeVisible();
	});
});
