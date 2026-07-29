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
		// Wait for hydration before the plain click — pre-hydration the
		// intercept isn't attached yet and the raw SSR link would navigate.
		// The Leaflet container only mounts from onMount, so its presence
		// means the page's JS is live.
		await page.locator('.leaflet-container').waitFor({ timeout: 15000 });
		// …but a plain click previews instead of navigating. The URL gains the
		// preview param (shareable link, back-restore) — assert it, so the
		// persistence contract is locked in rather than trivially matched.
		await card.click();
		await expect(page).toHaveURL(/\/discover\?preview=/);
		await expect(page.locator('.preview-card')).toBeVisible();
		await expect(page.locator('.marker-pin--active')).toHaveCount(1);
		await expect(page.locator('.preview-cta')).toHaveAttribute('href', /^\/conversations\//);
	});

	test('back restores the preview after visiting a conversation; back again closes it', async ({ page }) => {
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
		await expect(page).toHaveURL(/\?preview=/);

		// Through the CTA to the conversation, then back: same card, same URL.
		await page.locator('.preview-cta').click();
		await expect(page).toHaveURL(/\/conversations\//);
		await page.goBack();
		await expect(page).toHaveURL(/\?preview=/);
		await expect(page.locator('.preview-card')).toBeVisible();

		// Back past the open-entry closes the card and stays on discover.
		await page.goBack();
		await expect(page.locator('.preview-card')).toHaveCount(0);
		await expect(page).toHaveURL(/\/discover(?!\?preview)/);
	});

	test('a time hop replaces the history entry — one back closes the card', async ({ page }) => {
		await page.goto('/discover');
		const pin = page.locator('.marker-pin').first();
		try {
			await pin.waitFor({ state: 'visible', timeout: 8000 });
		} catch {
			test.skip(true, 'No pins rendered.');
			return;
		}
		// Find a previewed conversation with a "more time(s)" fold to hop to.
		await pin.dispatchEvent('click');
		await expect(page.locator('.preview-card')).toBeVisible();
		const moreBtn = page.locator('.preview-card button', { hasText: /more time/i });
		if ((await moreBtn.count()) === 0) {
			test.skip(true, 'Previewed conversation has a single slot — nothing to hop.');
			return;
		}
		await moreBtn.click();
		const otherSlot = page.locator('.preview-card button.slot-row:not(.current)').last();
		await otherSlot.click();
		await expect(page.locator('.preview-card')).toBeVisible();

		// The hop replaced (not pushed) the preview entry: a single back must
		// CLOSE the card, not step to the pre-hop slot.
		await page.goBack();
		await expect(page.locator('.preview-card')).toHaveCount(0);
		await expect(page.locator('.marker-pin--active')).toHaveCount(0);
	});

	test('a direct ?preview link opens the card; closing keeps it closed and strips the param', async ({ page }) => {
		await page.goto('/discover');
		const pin = page.locator('.marker-pin').first();
		try {
			await pin.waitFor({ state: 'visible', timeout: 8000 });
		} catch {
			test.skip(true, 'No pins rendered.');
			return;
		}
		await pin.dispatchEvent('click');
		await expect(page).toHaveURL(/\?preview=/);
		const shared = page.url();

		// Hard load of the shared URL: the same card opens, pin ringed.
		await page.goto(shared);
		await expect(page.locator('.preview-card')).toBeVisible();
		await expect(page.locator('.marker-pin--active')).toHaveCount(1);

		// Closing must stick (no self-reopen from a stale URL read) and the
		// param must leave the address bar.
		await page.keyboard.press('Escape');
		await expect(page.locator('.preview-card')).toHaveCount(0);
		await expect(page).toHaveURL(/\/discover(?!\?preview)/);
		await page.waitForTimeout(500);
		await expect(page.locator('.preview-card')).toHaveCount(0);
	});

	test('a stale ?preview param is stripped without breaking the page', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(String(e)));
		await page.goto('/discover?preview=00000000-0000-0000-0000-000000000000');
		// The strip defers past router init — the param goes away shortly
		// after hydration rather than crashing it.
		await expect(page).toHaveURL(/\/discover(?!\?preview)/, { timeout: 10000 });
		expect(errors).toEqual([]);

		// And the preview machinery still works on this page load.
		const pin = page.locator('.marker-pin').first();
		try {
			await pin.waitFor({ state: 'visible', timeout: 8000 });
		} catch {
			test.skip(true, 'No pins rendered.');
			return;
		}
		await pin.dispatchEvent('click');
		await expect(page.locator('.preview-card')).toBeVisible();
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
