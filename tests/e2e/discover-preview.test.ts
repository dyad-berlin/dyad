import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../helpers/auth';

// Desktop preview card — "one preview, two doors" (PR #153). A pin click and
// a sidebar card click open the same floating card over the map; direct
// navigation happens only from the card's CTA. The BottomSheet keeps this
// role on mobile (covered by smoke.responsive.test.ts).
//
// Depends on the seeded published prompts with future slots (seed.sql uses
// NOW()-relative slot times, so pins always exist on a fresh stack). Skips
// gracefully when no pins render.

test.use({ storageState: TEST_USERS.lisa.storagePath });

test.describe('Discover — desktop preview card', () => {
	test('pin click opens the card, rings the pin, and Esc clears both', async ({ page }) => {
		await page.goto('/discover');
		const pin = page.locator('.marker-pin').first();
		try {
			await pin.waitFor({ state: 'visible', timeout: 8000 });
		} catch {
			test.skip(true, 'No pins rendered — nothing to preview.');
			return;
		}
		// Fuzzed pin positions can overlap at the default zoom, leaving the
		// first pin's center covered by a neighbor — Playwright's actionability
		// check would wait forever. Dispatch the click on the targeted marker:
		// the handler works from pin data, not pointer coordinates.
		await pin.dispatchEvent('click');

		await expect(page.locator('.preview-card')).toBeVisible();
		// Desktop uses the card, never the bottom sheet.
		await expect(page.locator('.sheet-host .sheet')).toBeHidden();
		// The door pin is ringed and its slot(s) highlighted in place.
		await expect(page.locator('.marker-pin--active')).toHaveCount(1);
		expect(await page.locator('.slot-row.current').count()).toBeGreaterThan(0);

		await page.keyboard.press('Escape');
		await expect(page.locator('.preview-card')).toHaveCount(0);
		await expect(page.locator('.marker-pin--active')).toHaveCount(0);
	});

	test('sidebar card click previews without navigating; the CTA carries the link', async ({ page }) => {
		await page.goto('/discover');
		const card = page.locator('.list-pane .card').first();
		try {
			await card.waitFor({ state: 'visible', timeout: 8000 });
		} catch {
			test.skip(true, 'No conversations in the feed.');
			return;
		}
		// The card stays a real link (cmd/middle-click keeps working)…
		await expect(card).toHaveAttribute('href', /\/conversations\//);
		// …but a plain click previews instead of navigating.
		await card.click();
		await expect(page).toHaveURL(/\/discover/);
		await expect(page.locator('.preview-card')).toBeVisible();
		await expect(page.locator('.marker-pin--active')).toHaveCount(1);
		await expect(page.locator('.preview-cta')).toHaveAttribute('href', /^\/conversations\//);
	});

	test('changing a filter closes the card and clears the ring', async ({ page }) => {
		await page.goto('/discover');
		const pin = page.locator('.marker-pin').first();
		try {
			await pin.waitFor({ state: 'visible', timeout: 8000 });
		} catch {
			test.skip(true, 'No pins rendered.');
			return;
		}
		await pin.dispatchEvent('click'); // see overlap note in the first test
		await expect(page.locator('.preview-card')).toBeVisible();

		// Open the filter sheet and toggle a day — any filter change must
		// clear the whole preview (card, ring, state), not just the card.
		await page.locator('[aria-label*="filter" i]').first().click();
		await page.locator('.day-row .day-cell').first().click();
		await expect(page.locator('.preview-card')).toHaveCount(0);
		await expect(page.locator('.marker-pin--active')).toHaveCount(0);
	});
});
