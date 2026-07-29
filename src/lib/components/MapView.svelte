<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { PromptSummary, TimeSlot } from '$lib/domain/types';
	import type { Map as LeafletMap, LayerGroup } from 'leaflet';
	import { buildPins, berlinDistance, FUZZ_MAX_METERS, type SlotFilter } from './MapView.pins';

	interface Props {
		prompts: PromptSummary[];
		onSelectPin: (items: Array<{ prompt: PromptSummary; slots: TimeSlot[] }>, area: string) => void;
		onMapClick?: () => void;
		initialCenter?: [number, number] | null;
		initialZoom?: number | null;
		onMoveEnd?: (center: [number, number], zoom: number) => void;
		scrollWheelZoom?: boolean;
		zoomControl?: boolean;
		zoomControlPosition?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
		/** Optional per-slot filter — when present, only slots passing this predicate
		 *  produce a pin. Used by the discover page so date/area filters narrow pin
		 *  emission rather than just the conversation list. */
		slotFilter?: SlotFilter;
		/** Fit signal: when this key changes to a non-null value, the view fits
		 *  the bounds of the currently visible (post-filter) pins. The discover
		 *  page passes the selected district, so choosing one centers the map on
		 *  it and zooms to cover its pins. Clearing (null) leaves the view put. */
		fitKey?: string | null;
		/** The slot the desktop preview card corresponds to. Its pin gets the
		 *  active treatment (scale + ring + elevation) and, when off-screen,
		 *  the map pans it into view — smoothly, and only as far as needed. */
		activeSlotId?: string | null;
		/** Gates the ensure-visible pan. The discover page passes its desktop
		 *  flag: on mobile the preview card is hidden and a pin tap must ring
		 *  without panning (the BottomSheet flow never panned). */
		panToActive?: boolean;
		/** How to pan when the active slot changes: 'ensure' nudges the pin
		 *  just inside the viewport margins (pin clicks — the pin is already
		 *  under the cursor); 'center' brings the pin+card composition to the
		 *  middle of the pane (sidebar opens and cross-location time hops,
		 *  where a minimal pan would strand the card on the edge). */
		activePanMode?: 'ensure' | 'center';
		/** Streams the active pin's container-point (pixels within the map
		 *  element), or null when no pin matches. Fires after marker rebuilds
		 *  and continuously through map moves/zooms, so an anchored overlay
		 *  (the preview card) can ride along with its pin. */
		onActivePinPoint?: (point: { x: number; y: number } | null) => void;
		/** Reports the active pin's co-located conversations (same grouping a
		 *  click on that pin would produce) whenever the active slot or pin set
		 *  changes. The preview card's stacked-pin switcher stays truthful to
		 *  the pin the card is anchored to — after a cross-location time hop,
		 *  the old pin's neighbors must not linger. Null when no pin matches. */
		onActivePinItems?: (items: Array<{ prompt: PromptSummary; slots: TimeSlot[] }> | null) => void;
	}

	let { prompts, onSelectPin, onMapClick, initialCenter, initialZoom, onMoveEnd, scrollWheelZoom = true, zoomControl = false, zoomControlPosition = 'topleft', slotFilter, fitKey = null, activeSlotId = null, panToActive = true, activePanMode = 'ensure', onActivePinPoint, onActivePinItems }: Props = $props();

	let mapContainer: HTMLElement | undefined = $state();
	let map: LeafletMap | undefined;
	let markerLayer: LayerGroup | undefined;

	// ── Configuration ────────────────────────────────────────────────────────
	const BERLIN_CENTER: [number, number] = [52.52, 13.405];
	const DEFAULT_ZOOM = 12;

	// Fitting caps at neighbourhood scale: a district with one pin must not
	// zoom to rooftop level (positions are fuzzed for privacy anyway).
	const FIT_MAX_ZOOM = 15;
	const FIT_PADDING: [number, number] = [40, 40];

	function rebuildMarkers(L: typeof import('leaflet')) {
		if (!markerLayer) return [] as ReturnType<typeof buildPins>;
		markerLayer.clearLayers();

		const pins = buildPins(prompts, slotFilter);

		for (const pin of pins) {
			// Cover image marker (or placeholder)
			// Escape HTML attributes to prevent XSS from user-controlled URLs/titles
			const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			const imgSrc = pin.prompt.cover_image_url;
			const html = imgSrc
				? `<img src="${esc(imgSrc)}" alt="" class="marker-img" loading="lazy" />`
				: `<div class="marker-placeholder">${esc((pin.prompt.title ?? '?')[0])}</div>`;

			const isActive = activeSlotId !== null && pin.slots.some((s) => s.id === activeSlotId);
			const icon = L.divIcon({
				html,
				className: isActive ? 'marker-pin marker-pin--active' : 'marker-pin',
				iconSize: [44, 44],
				iconAnchor: [22, 22]
			});

			// The active pin rises above overlapping neighbors — fuzzed
			// positions cluster, and a selected pin buried under its neighbor
			// reads as "nothing selected".
			const marker = L.marker(pin.position, { icon, zIndexOffset: isActive ? 1000 : 0 });
			marker.on('click', () => {
				const items = itemsAround(pin, pins);
				onSelectPin(items, `${items.length} nearby`);
			});
			marker.addTo(markerLayer);
		}
		return pins;
	}

	/** Conversations co-located with a pin — the pin itself plus neighbors
	 *  within the fuzz radius, distance-sorted, deduped by prompt ID. The
	 *  anchor pin is at distance 0, so the sort places it first — it always
	 *  survives dedup, and its slots are the ones the card renders. Shared by
	 *  the marker click handler and the active-pin items reporter so both
	 *  doors and time hops see the same cluster. */
	function itemsAround(center: ReturnType<typeof buildPins>[number], pins: ReturnType<typeof buildPins>) {
		const pos = center.position;
		const nearby = pins
			.filter(p => berlinDistance(p.position[0], p.position[1], pos[0], pos[1]) < FUZZ_MAX_METERS)
			.sort((a, b) => {
				const distA = (a.position[0] - pos[0]) ** 2 + (a.position[1] - pos[1]) ** 2;
				const distB = (b.position[0] - pos[0]) ** 2 + (b.position[1] - pos[1]) ** 2;
				return distA - distB;
			});
		const seen = new Set<string>();
		return nearby
			.filter(p => { if (seen.has(p.prompt.id)) return false; seen.add(p.prompt.id); return true; })
			.map(p => ({ prompt: p.prompt, slots: p.slots }));
	}

	let leafletModule: typeof import('leaflet') | undefined;

	onMount(async () => {
		if (!mapContainer) return;

		const L = await import('leaflet');
		leafletModule = L;

		(L.Icon.Default as any).prototype.options.imagePath = '/leaflet/';

		map = L.map(mapContainer, {
			center: initialCenter ?? BERLIN_CENTER,
			zoom: initialZoom ?? DEFAULT_ZOOM,
			zoomControl: false,
			attributionControl: true,
			scrollWheelZoom
		});

		if (zoomControl) {
			L.control.zoom({ position: zoomControlPosition }).addTo(map);
		}

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
			maxZoom: 19,
			detectRetina: true
		}).addTo(map);

		// Close bottom sheet when clicking the map (not a marker)
		map.on('click', () => {
			onMapClick?.();
		});

		// Report map position changes (debounced)
		let moveEndTimer: ReturnType<typeof setTimeout>;
		map.on('moveend', () => {
			clearTimeout(moveEndTimer);
			moveEndTimer = setTimeout(() => {
				if (!map) return;
				const c = map.getCenter();
				onMoveEnd?.([c.lat, c.lng], map.getZoom());
			}, 300);
		});

		markerLayer = L.layerGroup().addTo(map);
		lastPins = rebuildMarkers(L);
		reportActivePoint();
		reportActiveItems(lastPins);
		// The anchored preview card rides its pin: re-report on every frame of
		// a pan/zoom so the card follows, and on moveend for the settled state.
		map.on('move zoom moveend zoomend', reportActivePoint);
		// Seed the change trackers with the mount-time props: otherwise the
		// first $effect run treats every prop as "changed" and — with a
		// district filter active on remount — refits the map, clobbering the
		// pan/zoom just restored from the page snapshot.
		prevPrompts = prompts;
		prevSlotFilter = slotFilter;
		prevFitKey = fitKey;
		prevActiveSlotId = activeSlotId;
		// An active slot present at mount (URL-restored preview) was set
		// before the async Leaflet load finished — the seeding above swallows
		// the change, so pan to it here.
		if (activeSlotId !== null && panToActive) {
			const pin = lastPins.find((p) => p.slots.some((s) => s.id === activeSlotId));
			if (pin) {
				if (activePanMode === 'center') centerOn(pin.position);
				else ensureVisible(pin.position);
			}
		}
	});

	/** Pan just far enough that the active pin sits inside comfortable
	 *  viewport margins. No-op when already visible. The anchored preview
	 *  card flips sides at the edges, so no overlay inset is needed. */
	function ensureVisible(position: [number, number]) {
		if (!map) return;
		const point = map.latLngToContainerPoint(position);
		const size = map.getSize();
		const MARGIN = 60;
		let dx = 0;
		let dy = 0;
		if (point.x < MARGIN) dx = point.x - MARGIN;
		else if (point.x > size.x - MARGIN) dx = point.x - (size.x - MARGIN);
		if (point.y < MARGIN) dy = point.y - MARGIN;
		else if (point.y > size.y - MARGIN) dy = point.y - (size.y - MARGIN);
		if (dx !== 0 || dy !== 0) map.panBy([dx, dy], { animate: true });
	}

	/** Pan so the pin lands left of the pane's midpoint — approximately
	 *  centering the pin-plus-card composition (the card hangs ~360px off the
	 *  pin's right side). Used for sidebar opens and cross-location hops,
	 *  where the pin starts far away or off-screen. */
	function centerOn(position: [number, number]) {
		if (!map) return;
		const point = map.latLngToContainerPoint(position);
		const size = map.getSize();
		const targetX = Math.max(size.x / 2 - 180, 60);
		const targetY = size.y / 2;
		map.panBy([point.x - targetX, point.y - targetY], { animate: true });
	}

	/** Last built pin set, kept so move/zoom events can re-report the active
	 *  pin's container point without a rebuild. */
	let lastPins: ReturnType<typeof buildPins> = [];

	function reportActivePoint() {
		if (!onActivePinPoint) return;
		if (!map || activeSlotId === null) {
			onActivePinPoint(null);
			return;
		}
		const pin = lastPins.find((p) => p.slots.some((s) => s.id === activeSlotId));
		if (!pin) {
			onActivePinPoint(null);
			return;
		}
		const point = map.latLngToContainerPoint(pin.position);
		onActivePinPoint({ x: point.x, y: point.y });
	}

	/** Report the active pin's cluster to the page. Unlike the point stream,
	 *  this only needs to fire when the active slot or the pin set changes —
	 *  not on every pan frame. */
	function reportActiveItems(pins: ReturnType<typeof buildPins>) {
		if (!onActivePinItems) return;
		const pin = activeSlotId === null ? undefined : pins.find((p) => p.slots.some((s) => s.id === activeSlotId));
		onActivePinItems(pin ? itemsAround(pin, pins) : null);
	}

	let prevPrompts: PromptSummary[] | undefined;
	let prevSlotFilter: SlotFilter | undefined;
	let prevFitKey: string | null = null;
	let prevActiveSlotId: string | null = null;
	$effect(() => {
		const currentPrompts = prompts;
		const currentFilter = slotFilter;
		const currentFitKey = fitKey;
		const currentActive = activeSlotId;
		if (
			leafletModule &&
			markerLayer &&
			(currentPrompts !== prevPrompts ||
				currentFilter !== prevSlotFilter ||
				currentFitKey !== prevFitKey ||
				currentActive !== prevActiveSlotId)
		) {
			prevPrompts = currentPrompts;
			prevSlotFilter = currentFilter;
			const fitRequested = currentFitKey !== prevFitKey && currentFitKey !== null;
			prevFitKey = currentFitKey;
			const panRequested = currentActive !== prevActiveSlotId && currentActive !== null && panToActive;
			prevActiveSlotId = currentActive;
			const pins = rebuildMarkers(leafletModule);
			lastPins = pins;
			if (fitRequested && map && pins.length > 0) {
				const bounds = leafletModule.latLngBounds(pins.map((p) => p.position));
				map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM });
			} else if (panRequested) {
				const activePin = pins.find((p) => p.slots.some((s) => s.id === currentActive));
				if (activePin) {
					if (activePanMode === 'center') centerOn(activePin.position);
					else ensureVisible(activePin.position);
				}
			}
			reportActivePoint();
			reportActiveItems(pins);
		}
	});

	onDestroy(() => {
		map?.off('move zoom moveend zoomend', reportActivePoint);
		map?.remove();
		map = undefined;
		markerLayer = undefined;
	});
</script>

<svelte:head>
	<link rel="stylesheet" href="/leaflet/leaflet.css" />
</svelte:head>

<div class="map-container" bind:this={mapContainer}></div>

<style>
	.map-container {
		width: 100%;
		height: 100%;
	}

	:global(.marker-pin) {
		background: none !important;
		border: none !important;
	}

	:global(.marker-img) {
		width: 44px !important;
		height: 44px !important;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid var(--bg-canvas);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		box-sizing: border-box;
		display: block;
		aspect-ratio: 1;
	}

	/* The pin the preview corresponds to: unmissable — scaled up, thick ring,
	   soft halo. Transform goes on the inner element (Leaflet owns the marker
	   root's transform); zIndexOffset in rebuildMarkers lifts it above
	   overlapping neighbors. */
	:global(.marker-pin--active .marker-img),
	:global(.marker-pin--active .marker-placeholder) {
		transform: scale(1.18);
		border: 2px solid var(--bg-canvas);
		box-shadow:
			0 0 0 3px var(--text-primary),
			0 6px 18px rgba(0, 0, 0, 0.35);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	:global(.leaflet-control-attribution) {
		font-size: 9px !important;
		background: rgba(255, 255, 255, 0.6) !important;
		padding: 2px 5px !important;
	}

	:global(.marker-placeholder) {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--text-primary);
		color: var(--bg-canvas);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--text-xl);
		font-weight: 500;
		border: 2px solid var(--bg-canvas);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		box-sizing: border-box;
	}
</style>
