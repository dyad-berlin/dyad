<script lang="ts">
	import type { PromptSummary, TimeSlot } from '$lib/domain/types';
	import { copy } from '$lib/copy';

	// The landing's own pin card, not MapPreviewCard: that card's content
	// block is a door to /conversations/[id] (auth-gated), its meta line is
	// the type tag + @author, and its time rows are hop-doors wired to
	// activeSlotIds/onHopSlot — none of it usable by an anonymous visitor.
	// This card leads with the conversation itself and asks to join.

	interface Props {
		prompts: PromptSummary[];
		initialCenter?: [number, number] | null;
		/** Collapsed: a card in the top-right corner. Expanded: the full
		 *  viewport. The page owns the state (Escape, scroll lock, and CTA
		 *  hiding key off it); the zoom control here writes it back. */
		expanded?: boolean;
	}

	let { prompts, initialCenter = null, expanded = $bindable(false) }: Props = $props();

	const og = copy.landing;

	// The pin cluster opened over the map (Airbnb-style card). Co-located
	// conversations are all kept so the visitor can pick from them; an empty
	// array means no card is open.
	let selectedItems = $state<Array<{ prompt: PromptSummary; slots: TimeSlot[] }>>([]);
	let activeIndex = $state(0);
	const selected = $derived<PromptSummary | null>(selectedItems[activeIndex]?.prompt ?? null);

	function closeConversation() {
		selectedItems = [];
		activeIndex = 0;
	}

	// Clicking a map pin opens the cluster of co-located conversations as a
	// floating card. The first item (closest to the click) is shown by default;
	// when the cluster holds more than one, the card lets the visitor switch.
	function handlePinSelect(items: Array<{ prompt: PromptSummary; slots: TimeSlot[] }>) {
		selectedItems = items;
		activeIndex = 0;
	}

	function formatDate(iso?: string | null): string {
		if (!iso) return '';
		return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	function areaOf(prompt: PromptSummary): string {
		return prompt.available_slots[0]?.general_area ?? '';
	}
</script>

<aside class="map-pane" class:expanded>
	<div class="map-frame">
		<span class="map-banner">{og.mapBanner}</span>

		<!-- Icon-only, so it needs an explicit label; the label names the
		     action rather than the current state. -->
		<button
			type="button"
			class="map-zoom"
			aria-expanded={expanded}
			aria-label={expanded ? og.mapZoomOut : og.mapZoomIn}
			title={expanded ? og.mapZoomOut : og.mapZoomIn}
			onclick={() => (expanded = !expanded)}
		>
			<!-- Viewfinder: four corner marks framing a plus, and the same
			     frame around a minus once zoomed in. -->
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M3 8V3h5" />
				<path d="M16 3h5v5" />
				<path d="M3 16v5h5" />
				<path d="M21 16v5h-5" />
				<path d="M9 12h6" />
				{#if !expanded}<path d="M12 9v6" />{/if}
			</svg>
		</button>

		<div class="map-inner">
			{#await import('$lib/components/MapView.svelte')}
				<div class="map-placeholder"></div>
			{:then { default: MapView }}
				<!-- Zoom 12 sits between the two extremes: the inner city reads
				     as a whole, with districts still named, rather than either a
				     single neighbourhood or the entire metro area. -->
				<MapView
					{prompts}
					{initialCenter}
					initialZoom={12}
					onSelectPin={handlePinSelect}
					onMapClick={closeConversation}
					scrollWheelZoom={expanded}
					zoomControl={false}
				/>
			{:catch}
				<div class="map-placeholder"></div>
			{/await}
		</div>

		{#if selected}
			<div class="map-card">
				<button class="map-card-close" onclick={closeConversation} aria-label={copy.common.close}>
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
				</button>
				{#if selectedItems.length > 1}
					<!-- Co-located conversations: a compact picker so none are discarded. -->
					<div class="map-card-cluster">
						{#each selectedItems as item, i (item.prompt.id)}
							<button
								class="map-card-cluster-item"
								class:active={i === activeIndex}
								onclick={() => (activeIndex = i)}
							>
								{item.prompt.title ?? copy.common.untitled}
							</button>
						{/each}
					</div>
				{/if}
				{#if selected.cover_image_url}
					<div class="map-card-cover">
						<img src={selected.cover_image_url} alt={selected.title ? og.mapCardCoverAlt(selected.title) : ''} />
					</div>
				{/if}
				<div class="map-card-body">
					<h3 class="map-card-title">{selected.title ?? copy.common.untitled}</h3>
					<div class="map-card-meta">
						{#if areaOf(selected)}<span>{areaOf(selected)}</span>{/if}
						{#if selected.soonest_slot}<span>{formatDate(selected.soonest_slot)}</span>{/if}
					</div>
					{#if selected.body_snippet}
						<p class="map-card-snippet">{selected.body_snippet}</p>
					{/if}
					<a href="/waitlist" class="map-card-cta">{og.mapCardCta}</a>
				</div>
			</div>
		{/if}
	</div>
</aside>

<style>
	/* ── Map — a card on the right, expandable to the full viewport. ──
	   Inherits the landing palette from the page shell: --map-w, --topbar-h,
	   --landing-hairline(-on-paper), --landing-ink-on-paper, --font-ui.
	   The map-only surfaces live here. */
	.map-pane {
		/* The map sits almost the same tone as the paper ground, so it reads
		   as part of the page rather than a dark box dropped onto it. */
		--landing-map-surface: rgba(250, 248, 243, 0.92);
		--landing-card-bg: #fff;
		--landing-card-ink: #111;
		--landing-card-ink-soft: #555;
		--landing-card-ink-muted: #717171;

		position: absolute;
		right: var(--space-6);
		/* Clears the actions row rather than starting level with it, so Join
		   and Sign in are never behind the map. */
		top: calc(var(--space-6) + var(--topbar-h));
		z-index: 30;
		width: var(--map-w);
	}

	/* Zoomed in, the map takes the whole viewport — fixed rather than absolute
	   so it leaves the column entirely and covers the page. */
	.map-pane.expanded {
		position: fixed;
		inset: 0;
		width: auto;
		z-index: 200;
	}
	/* Expanding lifts the map out of the column flow to cover the full pane —
	   so it opens *over* the hero text rather than shrinking to share the
	   space with it. The frame is opaque, so nothing shows through; the text
	   is untouched underneath and returns on collapse. */
	.map-pane.expanded .map-frame {
		position: absolute;
		inset: 0;
		aspect-ratio: auto;
		border: none;
		border-radius: 0;
		padding: 0;
		box-shadow: none;
	}
	.map-pane.expanded .map-inner { border-radius: 0; }

	/* Banner pinned to the map, mirroring the expand control opposite it. */
	.map-banner {
		position: absolute;
		top: var(--space-3);
		left: var(--space-3);
		z-index: 1200;
		font-family: var(--font-ui);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		/* Dark ink, not --landing-ink: that token is the light off-white used
		   for type over the photograph, and this label sits on a paper pill. */
		color: var(--landing-ink-on-paper);
		background: rgba(250, 248, 243, 0.9);
		border: 1px solid var(--landing-hairline-on-paper);
		border-radius: var(--radius-pill);
		padding: 5px 12px;
	}

	.map-zoom {
		position: absolute;
		top: var(--space-3);
		right: var(--space-3);
		z-index: 1200;
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		padding: 0;
		color: var(--landing-ink-on-paper);
		background: rgba(250, 248, 243, 0.9);
		border: 1px solid var(--landing-hairline-on-paper);
		border-radius: 50%;
		cursor: pointer;
		transition: background 0.15s;
	}
	.map-zoom:hover { background: rgba(250, 248, 243, 1); }
	.map-zoom svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		/* Square ends and mitred corners — the mark is meant to read as crop
		   marks, so rounding the joins would soften exactly what it is. */
		stroke-width: 2;
		stroke-linecap: butt;
		stroke-linejoin: miter;
	}

	.map-frame {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: var(--landing-map-surface);
		backdrop-filter: blur(16px);
		border: 1px solid var(--landing-hairline);
		border-radius: var(--radius-card);
		padding: var(--space-3);
		box-sizing: border-box;
		box-shadow:
			0 40px 90px -30px rgba(43, 36, 26, 0.22),
			0 10px 26px -10px rgba(43, 36, 26, 0.12);
	}

	.map-inner {
		width: 100%;
		height: 100%;
		overflow: hidden;
		border-radius: calc(var(--radius-card) - 6px);
	}

	/* Pale the OSM tiles down toward the paper ground — mostly desaturated and
	   lifted, so the map reads as almost the same tone as the background
	   rather than a block of stock orange/yellow. Scoped to the tile pane
	   only: the cover-image pins live in a separate marker pane and keep full
	   colour, so they pop against it. */
	.map-inner :global(.leaflet-tile-pane) {
		filter: saturate(0.3) brightness(1.07) contrast(0.92);
	}
	.map-inner :global(.leaflet-container) {
		background: var(--landing-map-surface);
	}

	.map-placeholder { width: 100%; height: 100%; background: var(--landing-map-surface); }

	/* ── Card floating over the map when a pin is picked ── */
	.map-card {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: 1100;
		width: min(280px, 84%);
		background: var(--landing-card-bg);
		border-radius: 14px;
		overflow: hidden;
		box-shadow: 0 20px 60px rgba(43, 36, 26, 0.25);
		text-align: left;
	}

	.map-card-close {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 2;
		width: 26px;
		height: 26px;
		border: none;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.95);
		color: #222;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.map-card-cluster {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		padding: var(--space-3) var(--space-3) 0;
	}

	.map-card-cluster-item {
		font-family: var(--font-ui);
		font-size: 0.6rem;
		color: var(--landing-card-ink-muted);
		background: rgba(0, 0, 0, 0.05);
		border: none;
		border-radius: var(--radius-pill);
		padding: 3px 9px;
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;
	}
	.map-card-cluster-item.active {
		background: var(--landing-card-ink);
		color: var(--landing-card-bg);
	}

	.map-card-cover {
		width: 100%;
		aspect-ratio: 3 / 2;
		overflow: hidden;
	}
	.map-card-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }

	.map-card-body { padding: var(--space-3) var(--space-4) var(--space-4); }

	.map-card-title {
		font-size: var(--text-base);
		font-weight: 600;
		color: var(--landing-card-ink);
		margin: 0 0 var(--space-1);
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.map-card-meta {
		display: flex;
		gap: var(--space-3);
		font-family: var(--font-ui);
		font-size: 0.62rem;
		color: var(--landing-card-ink-muted);
		margin-bottom: var(--space-3);
	}

	.map-card-snippet {
		font-family: var(--font-serif);
		font-size: 0.82rem;
		line-height: 1.45;
		color: var(--landing-card-ink-soft);
		margin: 0 0 var(--space-3);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.map-card-cta {
		display: block;
		text-align: center;
		text-decoration: none;
		background: var(--landing-card-ink);
		font-family: var(--font-ui);
		font-size: 0.7rem;
		letter-spacing: 0.04em;
		color: var(--landing-card-bg);
		padding: 9px 14px;
		border-radius: var(--radius-pill);
	}

	/* ── Mobile — the pane sits in the page flow, on the paper ground. ── */
	@media (max-width: 768px) {
		.map-pane {
			/* On paper, not the photo: the frame's hairline flips to the dark
			   paper value. */
			--landing-hairline: var(--landing-hairline-on-paper);
			position: relative;
			right: auto;
			top: auto;
			width: auto;
			order: 3;
			padding: var(--space-8) var(--space-5) 0;
		}
		/* Taller than the desktop card: on a narrow column a 16/9 strip leaves
		   too little of the city to read. Expanding still earns its keep here,
		   growing to the full viewport so pins can be picked apart. */
		.map-frame { aspect-ratio: 4 / 3; }

		/* The pin card leads with the conversation itself — cover, title, and
		   a couple of lines — rather than an ask. Joining is already the
		   page's headline CTA. */
		.map-card-cta { display: none; }
	}
</style>
