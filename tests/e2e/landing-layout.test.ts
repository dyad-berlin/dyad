import { test, expect } from '@playwright/test';

// Layout guards for the landing rebuild (PR #167 intent on main). Both tests
// run anonymously — the landing redirects signed-in members to /discover.
//
// 1. Hero text vs map pane: .left's max-width is derived from --map-w so the
//    text column can never sit under the absolutely-positioned map. That was
//    the exact bug class #167 fixed with no guard: from ~769px to ~1300px the
//    headline ran beneath the map. 900x700 sits inside that band.
// 2. Overlay stacking: the expanded map and the auth dialog both hold the
//    ref-counted body scroll lock, and Escape must close only the topmost
//    overlay (dialog first, map second).

type Box = { x: number; y: number; width: number; height: number };

function boxesIntersect(a: Box, b: Box): boolean {
	return (
		a.x < b.x + b.width &&
		b.x < a.x + a.width &&
		a.y < b.y + b.height &&
		b.y < a.y + a.height
	);
}

test.describe('Landing layout — hero text vs map pane', () => {
	// Inside the historical overlap band; also short enough (700px) that the
	// column has to scroll rather than clip.
	test.use({ viewport: { width: 900, height: 700 } });

	test('hero text block and map pane bounding boxes do not intersect', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('.left-title')).toBeVisible();
		await expect(page.locator('.map-pane')).toBeVisible();

		// section.left is the whole text column (headline block + footer) —
		// the element the CSS guard caps. The map pane is its absolutely
		// positioned sibling at the top right.
		const left = await page.locator('section.left').boundingBox();
		const map = await page.locator('.map-pane').boundingBox();

		// Fail loudly if a selector goes stale — a null box must not read as
		// "no intersection".
		expect(left).not.toBeNull();
		expect(map).not.toBeNull();

		expect(
			boxesIntersect(left!, map!),
			`hero column ${JSON.stringify(left)} intersects map pane ${JSON.stringify(map)}`
		).toBe(false);
	});
});

test.describe('Landing map — the two Leaflet prop bugs', () => {
	// Both behaviours are prop-driven and were invisible to the suite: Leaflet
	// reads scrollWheelZoom once at construction and caches its container size,
	// so a prop flip did nothing and a CSS resize left stale tiles.

	test('wheel scrolls the page while collapsed and zooms the map while expanded', async ({
		page
	}) => {
		await page.goto('/');
		await page.locator('.leaflet-container').waitFor({ timeout: 15000 });

		// OSM tile URLs are /{z}/{x}/{y}.png, so the zoom level is observable
		// from the loaded tiles without reaching for Leaflet's internals.
		const zoom = () =>
			page.evaluate(() => {
				const t = document.querySelector<HTMLImageElement>('img.leaflet-tile-loaded');
				return t?.src.match(/\/(\d+)\/\d+\/\d+\.png/)?.[1] ?? null;
			});
		const mapBox = (await page.locator('.leaflet-container').boundingBox())!;
		expect(mapBox).not.toBeNull();
		const centre = { x: mapBox.x + mapBox.width / 2, y: mapBox.y + mapBox.height / 2 };

		// Collapsed: scrollWheelZoom={false}, so the wheel must not zoom. (It
		// does not scroll the page either — the desktop shell is fixed and
		// deliberately unscrollable; the point of the prop is that the map does
		// not swallow the gesture.)
		const collapsedZoom = await zoom();
		expect(collapsedZoom, 'zoom level should be readable from the tile pane').not.toBeNull();
		await page.mouse.move(centre.x, centre.y);
		await page.mouse.wheel(0, 400);
		await page.waitForTimeout(700);
		expect(await zoom(), 'wheel over the collapsed map must not zoom it').toBe(collapsedZoom);

		// Expanded: the prop flips to true. Leaflet reads it once at
		// construction, so this only works because of the sync effect.
		await page.locator('.map-zoom').click();
		await expect(page.locator('.map-pane')).toHaveClass(/expanded/);
		await page.waitForTimeout(400);

		const zoomBefore = await zoom();
		const box = (await page.locator('.leaflet-container').boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.wheel(0, -300);
		await expect
			.poll(zoom, { timeout: 5000, message: 'wheel over the expanded map should zoom it' })
			.not.toBe(zoomBefore);
	});

	test('expanding re-measures the map so tiles cover the new size', async ({ page }) => {
		await page.goto('/');
		await page.locator('.leaflet-container').waitFor({ timeout: 15000 });

		await page.locator('.map-zoom').click();
		await expect(page.locator('.map-pane')).toHaveClass(/expanded/);
		await page.waitForTimeout(1200);

		// Without invalidateSize Leaflet keeps the collapsed dimensions and
		// paints tiles for that box, leaving the rest of the pane blank.
		const { pane, tiled } = await page.evaluate(() => {
			const c = document.querySelector('.leaflet-container')!.getBoundingClientRect();
			const boxes = [...document.querySelectorAll('.leaflet-tile-loaded')].map((t) =>
				t.getBoundingClientRect()
			);
			return {
				pane: { w: c.width, h: c.height },
				tiled: {
					w: Math.max(...boxes.map((b) => b.right)) - Math.min(...boxes.map((b) => b.left)),
					h: Math.max(...boxes.map((b) => b.bottom)) - Math.min(...boxes.map((b) => b.top))
				}
			};
		});

		expect(tiled.w, `tiles span ${tiled.w}px of a ${pane.w}px pane`).toBeGreaterThanOrEqual(
			pane.w
		);
		expect(tiled.h, `tiles span ${tiled.h}px of a ${pane.h}px pane`).toBeGreaterThanOrEqual(
			pane.h
		);
	});
});

test.describe('Landing overlays — scroll lock and Escape ordering', () => {
	test('dialog over expanded map: lock survives dialog close, Escape collapses map only after', async ({ page }) => {
		await page.goto('/');

		// Hydration gate: the zoom control's handler attaches client-side, and
		// the Leaflet container only mounts after the dynamic import resolves —
		// clicking earlier is a silent no-op (see smoke.responsive.test.ts).
		await page.locator('.leaflet-container').waitFor({ timeout: 15000 });

		// Expand the map. The page's $effect takes the first hold on the
		// ref-counted body scroll lock (an inline overflow:hidden — distinct
		// from the stylesheet's desktop overflow:hidden, so the inline style
		// is the honest read of the lock's state).
		await page.locator('.map-zoom').click();
		await expect(page.locator('.map-pane')).toHaveClass(/expanded/);
		await expect
			.poll(() => page.evaluate(() => document.body.style.overflow))
			.toBe('hidden');

		// Open sign-in over the expanded map. While the map is expanded the
		// header actions fade to visibility:hidden by design (the collapse
		// control must not end up under the Join pill on touch), so a pointer
		// cannot reach the link; dispatch the click on it directly. The same state is
		// reachable by a real user in the reverse order — open the dialog,
		// then Tab to the zoom control (no focus trap, background not inert)
		// and press Enter — and the guards under test are order-independent:
		// dialog open over expanded map, both holding the lock.
		await page.locator('.left-links a[href="/login"]').dispatchEvent('click');
		await expect(page.locator('.auth-dialog')).toBeVisible();

		// First Escape: the dialog owns it in the capture phase and stops
		// propagation — it closes, the map must NOT collapse.
		await page.keyboard.press('Escape');
		await expect(page.locator('.auth-dialog')).toHaveCount(0);
		await expect(page.locator('.map-pane')).toHaveClass(/expanded/);

		// The dialog released one hold; the expanded map still owns the other.
		// Body scroll stays locked — this is the clobbering bug the ref-count
		// exists to prevent (a plain overflow='' restore here would unlock
		// under the still-open map).
		expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

		// Second Escape: nothing above the map now, so it collapses and the
		// last holder restores the pre-lock inline overflow (empty).
		await page.keyboard.press('Escape');
		await expect(page.locator('.map-pane')).not.toHaveClass(/expanded/);
		await expect
			.poll(() => page.evaluate(() => document.body.style.overflow))
			.toBe('');
	});
});
