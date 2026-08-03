<script lang="ts">
	import type { PageData } from './$types';
	import type { PromptSummary, TimeSlot } from '$lib/domain/types';
	import AuthDialog from '$lib/components/AuthDialog.svelte';
	import { copy } from '$lib/copy';
	import { env } from '$env/dynamic/public';
	import { storageUrl } from '$lib/utils/storage-url';

	// Social links, env-gated exactly like ZineFooter — a link renders only
	// when its URL is configured in the Pages env.
	const instagramUrl = (env.PUBLIC_INSTAGRAM_URL ?? '').trim();
	const blueskyUrl = (env.PUBLIC_BLUESKY_URL ?? '').trim();

	const og = copy.landing;
	const ogImage = `${og.ogUrl}/images/og-card.png`;

	let { data }: { data: PageData } = $props();

	let authDialog = $state<AuthDialog | undefined>();

	// Static pastoral backdrop. Lives in the 'newsletter assets' bucket the
	// newsletter cover images use — confirmed with a direct request (200).
	const bgImageUrl = storageUrl('newsletter assets', 'landing page.jpg');
















	// Collapsed, the map is a card in the top-right corner; expanded, it takes
	// the right half of the page as it used to. MapView watches its own
	// container with a ResizeObserver, so Leaflet reflows on the transition
	// without this component signalling anything.
	let mapExpanded = $state(false);

	// A full-screen map is a modal surface: hold the page still behind it, and
	// let Escape out the way any overlay should.
	$effect(() => {
		if (typeof document === 'undefined') return;
		document.body.style.overflow = mapExpanded ? 'hidden' : '';
		return () => {
			document.body.style.overflow = '';
		};
	});

	function onWindowKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && mapExpanded) mapExpanded = false;
	}

	// ── Map ──────────────────────────────────────────────────────────────
	// The pin cluster opened over the map (Airbnb-style card). Co-located
	// conversations are all kept so the visitor can pick from them; an empty
	// array means no card is open.
	let selectedItems = $state<Array<{ prompt: PromptSummary; slots: TimeSlot[] }>>([]);
	let activeIndex = $state(0);
	const selected = $derived<PromptSummary | null>(selectedItems[activeIndex]?.prompt ?? null);

	const conversations = $derived<PromptSummary[]>(data.mapPrompts ?? []);

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

	// Join no longer opens a modal — it navigates straight to /waitlist (plain
	// href, no intercept). Login still opens in a dialog over the landing page.
	function openLogin() {
		authDialog?.show('login');
	}
</script>

<svelte:head>
	<title>{og.title}</title>
	<meta name="description" content={og.metaDescription} />

	<!-- Open Graph (Facebook, LinkedIn, Slack, iMessage, Discord, Signal, …) -->
	<meta property="og:title" content={og.title} />
	<meta property="og:description" content={og.metaDescription} />
	<meta property="og:url" content={og.ogUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content={ogImage} />
	<meta property="og:site_name" content={og.ogSiteName} />

	<!-- Twitter / X -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={og.title} />
	<meta name="twitter:description" content={og.metaDescription} />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>

<!-- ── Hero over a static photo ──
     Deliberately theme-independent, like the (zine) pages: its own local
     --landing-* custom properties, not the global light/dark tokens, so it
     always reads bright regardless of the app's own theme toggle. -->
<svelte:window onkeydown={onWindowKey} />

<div class="shell">
	<!-- Static pastoral backdrop. The gradient is the base layer; the photo
	     sits on top of it as a second background-image layer, so a 404 just
	     leaves the gradient showing — no broken-image glitch, no JS needed. -->
	<div class="sky" style:background-image={`url(${bgImageUrl}), var(--sky-fallback-gradient)`} aria-hidden="true">
		<div class="sky-scrim"></div>
	</div>

	<!-- Top-left: wordmark. -->
	<div class="intro">
		<a href="/" class="wordmark" aria-label="Dyad, home">{og.wordmark}</a>
	</div>

	<!-- A direct child of .shell, not of .left. .left carries its own z-index,
	     which would trap these below the map however high their own z-index
	     went; a stacking context cannot be escaped from the inside. -->
	<div class="left-links" class:behind-map={mapExpanded}>
		<!-- href fallback so this action degrades without JS -->
		<a href="/login" class="text-link" onclick={(e) => { e.preventDefault(); openLogin(); }}>{og.logIn}</a>
		<a href="/waitlist" class="btn-join" data-testid="join-cta">{og.joinWaitlist}</a>
	</div>

	<!-- Top-right: a small map of live conversations, expandable to the right
	     half of the page. -->
	<aside class="map-pane" class:expanded={mapExpanded}>
		<div class="map-frame">
			<span class="map-banner">{og.mapBanner}</span>

			<!-- Icon-only, so it needs an explicit label; the label names the
			     action rather than the current state. -->
			<button
				type="button"
				class="map-zoom"
				aria-expanded={mapExpanded}
				aria-label={mapExpanded ? og.mapZoomOut : og.mapZoomIn}
				title={mapExpanded ? og.mapZoomOut : og.mapZoomIn}
				onclick={() => (mapExpanded = !mapExpanded)}
			>
				<!-- Viewfinder: four corner marks framing a plus, and the same
				     frame around a minus once zoomed in. -->
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path d="M3 8V3h5" />
					<path d="M16 3h5v5" />
					<path d="M3 16v5h5" />
					<path d="M21 16v5h-5" />
					<path d="M9 12h6" />
					{#if !mapExpanded}<path d="M12 9v6" />{/if}
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
						prompts={conversations}
						initialCenter={data.mapCenter}
						initialZoom={12}
						onSelectPin={handlePinSelect}
						onMapClick={closeConversation}
						scrollWheelZoom={mapExpanded}
						zoomControl={false}
					/>
				{:catch}
					<div class="map-placeholder"></div>
				{/await}
			</div>

			{#if selected}
				<div class="map-card">
					<button class="map-card-close" onclick={closeConversation} aria-label="Close">
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
					</button>
					{#if selectedItems.length > 1}
						<!-- Co-located conversations: a compact picker so none are discarded. -->
						<div class="map-card-cluster">
							{#each selectedItems as item, i}
								<button
									class="map-card-cluster-item"
									class:active={i === activeIndex}
									onclick={() => (activeIndex = i)}
								>
									{item.prompt.title ?? 'Untitled'}
								</button>
							{/each}
						</div>
					{/if}
					{#if selected.cover_image_url}
						<div class="map-card-cover">
							<img src={selected.cover_image_url} alt={selected.title ? `Cover image for ${selected.title}` : ''} />
						</div>
					{/if}
					<div class="map-card-body">
						<h3 class="map-card-title">{selected.title ?? 'Untitled'}</h3>
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

	<section class="left">
		<header class="left-head">
			<h1 class="left-title">{og.headline}</h1>

			<p class="left-subline">{og.sublineLead}</p>

			<p class="left-who">{og.whoLead}</p>
			<p class="left-for">{og.sublineFor}</p>

		</header>

		<footer class="site-footer">
			<a href="/docs" class="footer-link">{og.footerDocs}</a>
			<a href="/wiggling" class="footer-link">{og.footerCommunity}</a>
			<a href="/newsletter" class="footer-link">{og.footerNewsletter}</a>
			<a href="/legal" class="footer-link">{og.footerLegal}</a>
			{#if instagramUrl}<a href={instagramUrl} class="footer-link is-social" target="_blank" rel="noopener">Instagram</a>{/if}
			{#if blueskyUrl}<a href={blueskyUrl} class="footer-link is-social" target="_blank" rel="noopener">Bluesky &amp; Blacksky</a>{/if}
		</footer>
	</section>
</div>

<AuthDialog bind:this={authDialog} />

<style>
	:global(body) { margin: 0; overflow: hidden; }

	/* ── Shell — full-bleed photo behind everything. ── */
	.shell {
		--landing-bg: #faf8f3;              /* zine paper, matched exactly */
		/* Text over the photo is the paper colour, not ink — the type reads as
		   cut out of the background. This only works against something dark,
		   so .sky-scrim carries a wash and --ink-halo is a dark glow (both
		   below). Anywhere text sits ON the paper instead of over the photo
		   — the whole below-fold half of mobile — these are re-scoped back to
		   the dark values; see the mobile block. */
		/* Muted warm off-white, not the paper's full brightness — pure #faf8f3
		   over a photo reads as glowing rather than printed. */
		--landing-ink: #e4dfd3;
		--landing-ink-soft: rgba(228, 223, 211, 0.8);
		--landing-ink-muted: rgba(228, 223, 211, 0.58);
		--landing-ink-invert: #2a1f16;        /* dark text, for the light-filled CTA */
		--landing-hairline: rgba(250, 248, 243, 0.28);
		/* The dark bark brown, kept for paper-ground contexts. */
		--landing-ink-on-paper: #3b2a1d;
		--landing-card-bg: #fff;
		--landing-card-ink: #111;
		--landing-card-ink-soft: #555;
		--landing-card-ink-muted: #717171;
		/* The map sits almost the same tone as the paper ground, so it reads
		   as part of the page rather than a dark box dropped onto it. */
		--landing-map-surface: rgba(250, 248, 243, 0.92);
		--sky-fallback-gradient: linear-gradient(175deg, #dce4e2 0%, #eae6da 55%, #f3efe4 100%);
		/* Width of the right-hand map column. Used both to size .map-pane and
		   to cap .left so the two can never overlap — one value, one place. */
		--map-w: min(560px, 42vw);
		/* The wordmark's type, kept as tokens so the mobile actions can be
		   centred on its line box rather than on a guessed pixel offset. */
		--wordmark-size: clamp(1.1rem, 1.7vw, 1.45rem);
		--wordmark-leading: 1.15;
		/* Height of the top row: the Join pill is taller than the wordmark's
		   line box and is centred on it, so this is what anything below has to
		   clear. */
		--topbar-h: 44px;
		/* Type stacks shared with the newsletter (see (zine)/newsletter):
		   Futura for uppercase headings, system sans for uppercase kickers
		   and utility chrome, SangBleu (--font-serif, app.css) for prose. */
		--font-display: Futura, 'Futura PT', 'Avenir Next', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif;
		--font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		/* A single soft dark shadow for legibility over the photo — deliberately
		   not a second tight shadow, which is what made the type look like it
		   was lit from behind rather than sitting on the image. */
		--ink-halo: 0 1px 14px rgba(26, 21, 15, 0.42);
		--ink-halo-none: 0 0 0 rgba(0, 0, 0, 0);

		position: fixed;
		inset: 0;
		display: flex;
		background: var(--landing-bg);
		/* Less inset at the bottom than the other three sides — the hero text
		   sits lower, closer to the ground of the photo. */
		padding: var(--space-6) var(--space-6) var(--space-4);
		box-sizing: border-box;
	}

	/* ── Sky — the photo, with the gradient as its base layer (set as a
	   second background-image inline) so a 404 leaves a warm gradient
	   rather than a broken box. ── */
	.sky {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background-repeat: no-repeat, no-repeat;
		background-size: cover, cover;
		background-position: center, center;
	}
	/* Light type needs something to sit against. A flat wash would grey the
	   whole photo, so this is weighted to the edges where the text actually
	   is — bottom-left for the headline, top for the wordmark and map — and
	   stays clear through the middle of the image. */
	.sky-scrim {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(to top, rgba(26, 21, 15, 0.55) 0%, rgba(26, 21, 15, 0) 45%),
			linear-gradient(to bottom, rgba(26, 21, 15, 0.4) 0%, rgba(26, 21, 15, 0) 32%),
			rgba(26, 21, 15, 0.12);
	}

	/* ── Top-left: wordmark + toggle nav ── */
	.intro {
		position: absolute;
		top: var(--space-6);
		left: var(--space-6);
		z-index: 40;
	}

	.wordmark {
		font-family: var(--font-serif);
		font-size: var(--wordmark-size);
		font-weight: 700;
		letter-spacing: 0.06em;
		color: var(--landing-ink);
		text-decoration: none;
		line-height: var(--wordmark-leading);
		text-shadow: var(--ink-halo);
	}



	/* ── Bottom-left: headline + footer ── */
	.left {
		position: relative;
		z-index: 20;
		/* Sizing reference for the headline: the column's width is capped and
		   also reduced by the map, so it is not a fixed fraction of the
		   viewport — vw would guess wrong. cqw measures the real thing. */
		container-type: inline-size;
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		/* Two caps, whichever is smaller. 880px is the measure we want; the
		   calc is the guard that keeps this column clear of the map, which is
		   absolutely positioned at the right edge. Derived from --map-w rather
		   than a guessed number so the two cannot drift apart. Without it the
		   text sits beneath the map from ~769px to ~1300px. */
		max-width: min(880px, calc(100% - var(--map-w) - var(--space-8)));
		margin-top: auto;
		box-sizing: border-box;
	}

	.left-head { position: relative; margin-top: auto; margin-bottom: 0; }

	.left-title {
		font-family: var(--font-serif);
		/* One row. ~5.1% of the column per character-width keeps all 40
		   characters on a single line; the cap stops it growing past a
		   comfortable display size on wide screens. The clamp above it is the
		   fallback for engines without container query units. */
		font-size: clamp(1.6rem, 2.4vw, 2.6rem);
		font-size: min(2.6rem, 5.1cqw);
		white-space: nowrap;
		font-weight: 700;
		/* A step softer than the body ink: at this size the headline carries by
		   scale, and full-strength here is what read as glare. */
		color: var(--landing-ink-soft);
		margin: 0 0 var(--space-5);
		line-height: 1.24;
		letter-spacing: -0.015em;
		text-align: left;
		text-wrap: pretty;
		/* The shared dark halo, not the light glow this used to carry — that was
		   left over from when the ink was dark brown, and behind light type it
		   lit the letters from behind. */
		text-shadow: var(--ink-halo);
	}

	/* Under the headline: what dyad is and who it is for, as one paragraph.
	   Set at caption scale rather than as a second headline, so the display
	   line above keeps the weight. */
	/* Everything under the headline shares one treatment, so the block reads as
	   a single voice rather than three tiers of importance. */
	.left-subline,
	.left-who,
	.left-for {
		position: relative;
		font-family: var(--font-serif);
		font-size: clamp(0.88rem, 1.4vw, 1.02rem);
		font-weight: 400;
		line-height: 1.55;
		color: var(--landing-ink-soft);
		max-width: none;
		margin: 0 0 var(--space-4);
		text-shadow: var(--ink-halo);
	}
	.left-subline { margin-top: var(--space-5); }





	/* The actions sit at the top right on every size, above the map, opposite
	   the wordmark and centred on its line box. Fixed rather than absolute so
	   they hold that corner over the collapsed map, which carries its own
	   stacking context. Expanded, they drop behind it; see .behind-map below.
	   Height and top come from the wordmark's own type tokens, so the two stay
	   optically centred on one line without a measured offset. */
	.left-links {
		display: flex;
		gap: var(--space-4);
		align-items: center;
		position: fixed;
		top: var(--space-6);
		right: var(--space-6);
		height: calc(var(--wordmark-size) * var(--wordmark-leading));
		z-index: 210;
		transition: opacity var(--duration-fast, 180ms) var(--ease-ink, ease);
	}

	/* Zoomed in, the map owns the viewport, so the actions drop behind it
	   rather than floating over the atlas. visibility, not just opacity, so
	   they also leave the tab order while they are covered. */
	.left-links.behind-map {
		z-index: 1;
		opacity: 0;
		visibility: hidden;
	}

	/* Primary action: a dark pill on the bright hero, sitting last in the row
	   so it holds the outer edge. Sign in stays a quiet text link beside it. */
	.btn-join {
		display: inline-flex;
		align-items: center;
		background: var(--landing-ink);
		color: var(--landing-ink-invert);
		font-family: var(--font-ui);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		text-decoration: none;
		padding: 11px 24px;
		border: none;
		border-radius: var(--radius-pill);
		cursor: pointer;
		transition: opacity 0.15s;
	}
	.btn-join:hover { opacity: 0.82; }

	.text-link {
		background: none;
		border: none;
		cursor: pointer;
		font-family: var(--font-ui);
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--landing-ink-muted);
		padding: 0;
		text-decoration: none;
		letter-spacing: 0.08em;
		transition: color 0.15s;
	}
	.text-link:hover { color: var(--landing-ink); }

	/* ── Footer ── */
	/* Even distribution: equal space *between* each link rather than a fixed
	   gap, so the row reads as evenly spaced despite the labels differing in
	   width. The gap is the floor, for when the row is too narrow to spread. */
	.site-footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		column-gap: var(--space-4);
		row-gap: var(--space-2);
		/* The copy sits directly on the footer rule; the rule's own breathing
		   room is the only separation. */
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--landing-hairline);
	}

	.footer-link {
		font-family: var(--font-ui);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--landing-ink);
		text-decoration: none;
		white-space: nowrap;
		transition: opacity 0.15s;
		opacity: 0.85;
	}
	.footer-link:hover { opacity: 1; }

	/* ── Map — smaller than the old half-page pane; a card on the right. ── */
	.map-pane {
		position: absolute;
		right: var(--space-6);
		/* Clears the actions row rather than starting level with it, so Join
		   and Sign in are never behind the map. */
		top: calc(var(--space-6) + var(--topbar-h));
		z-index: 30;
		width: var(--map-w);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		transition: bottom var(--duration-slow, 400ms) var(--ease-ink, ease);
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
	   so it opens *over* the about text beneath rather than shrinking to
	   share the space with it. The frame is opaque, so nothing shows
	   through; the text is untouched underneath and returns on collapse. */
	.map-pane.expanded .map-frame {
		position: absolute;
		inset: 0;
		z-index: 2;
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
		text-transform: uppercase;
		/* Dark ink, not --landing-ink: that token is the light off-white used
		   for type over the photograph, and this label sits on a paper pill. */
		color: var(--landing-ink-on-paper);
		background: rgba(250, 248, 243, 0.9);
		border: 1px solid rgba(59, 42, 29, 0.14);
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
		border: 1px solid rgba(59, 42, 29, 0.14);
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


	/* ── Desktop ── */
	/* ── Mobile ──
	   The page scrolls: a full-height photo hero (wordmark + headline + CTA),
	   then everything below it sits on the plain paper ground — the map and
	   the about card. Every child here needs position:relative, because .sky
	   is absolutely positioned and positioned elements paint above
	   non-positioned siblings regardless of DOM order; a static child would
	   render underneath the photo. */
	@media (max-width: 768px) {
		:global(body) { overflow: auto; }
		.shell {
			position: relative;
			inset: auto;
			min-height: 100vh;
			flex-direction: column;
			padding: 0;
			/* Paper ground for everything past the hero. */
			background: var(--landing-bg);
		}

		/* The photo covers the first screen, then dissolves into the paper
		   ground rather than ending on a hard edge. It runs past the fold so
		   the fade happens *below* the headline, and the mask makes the image
		   itself go transparent — so what it fades into is the shell's paper
		   background, whatever that is, with no gradient colour to keep in
		   sync. */
		.sky {
			bottom: auto;
			height: 124vh;
			-webkit-mask-image: linear-gradient(to bottom, #000 74%, rgba(0, 0, 0, 0.55) 88%, transparent 100%);
			mask-image: linear-gradient(to bottom, #000 74%, rgba(0, 0, 0, 0.55) 88%, transparent 100%);
		}

		.intro {
			position: relative;
			top: auto;
			left: auto;
			z-index: 1;
			order: 1;
			padding: var(--space-5) var(--space-5) 0;
		}

		/* display:contents lets the headline and the footer be ordered
		   independently around the map — the headline belongs to the hero
		   screen, the footer to the very bottom of the page. */
		.left { display: contents; }

		/* The actions sit opposite the wordmark on one line. Anchored to
		   .shell, and offset up from the wordmark's own top padding by half
		   the difference in their heights, so the two are centred on the same
		   horizontal line rather than merely sharing a corner. */
		/* Same treatment, at the phone's narrower inset. */
		.left-links {
			top: var(--space-5);
			right: var(--space-5);
		}

		/* One row would put a 40-character line below body-copy size on a
		   phone, so it wraps here and keeps the display scale instead. */
		.left-title {
			white-space: normal;
			font-size: clamp(2.1rem, 10.5vw, 3rem);
		}

		.left-head {
			/* Static, so the actions below can anchor to .shell and share the
			   wordmark's line rather than this block's top edge. z-index still
			   applies: this is a flex item of .shell, and flex items honour
			   z-index without being positioned. */
			position: static;
			z-index: 1;
			order: 2;
			/* The headline and the three paragraphs have to sit inside the
			   first screen, so the block is capped at the viewport less the
			   wordmark row above it, and can scroll internally on a short
			   phone rather than pushing the map down the page. */
			min-height: calc(100vh - 92px);
			max-height: calc(100vh - 92px);
			overflow-y: auto;
			/* Starts the copy below the wordmark row with room to breathe,
			   rather than immediately under it. The block scrolls internally
			   if the copy runs past the screen. */
			padding-top: calc(var(--space-10) + var(--space-6));
			display: flex;
			flex-direction: column;
			justify-content: flex-end;
			margin: 0;
			padding-right: var(--space-5);
			padding-bottom: var(--space-6);
			padding-left: var(--space-5);
			box-sizing: border-box;
		}

		/* Below the fold everything sits on the paper ground, not the photo —
		   so the ink tokens flip back to the dark brown and the halo goes
		   away. Re-scoping the custom properties on the containers means
		   every child picks it up; no per-element colour overrides. */
		.map-pane,
		.site-footer {
			--landing-ink: var(--landing-ink-on-paper);
			--landing-ink-soft: rgba(59, 42, 29, 0.72);
			--landing-ink-muted: rgba(59, 42, 29, 0.48);
			--landing-hairline: rgba(59, 42, 29, 0.14);
			--ink-halo: var(--ink-halo-none);
		}

		.map-pane {
			position: relative;
			right: auto;
			top: auto;
			bottom: auto;
			width: auto;
			order: 3;
			padding: var(--space-8) var(--space-5) 0;
		}
		/* Taller than the desktop card: on a narrow column a 16/9 strip leaves
		   too little of the city to read. Expanding still earns its keep here,
		   growing to a portrait crop so pins can be picked apart. */
		.map-frame { aspect-ratio: 4 / 3; }

		/* Zoomed in is full-viewport here too, so the base rules already
		   cover it — only the collapsed card needs a mobile ratio. */

		/* The pin card leads with the conversation itself — cover, title, and
		   a couple of lines — rather than an ask. Joining is already the
		   headline CTA further down the page. */
		.map-card-cta { display: none; }

		/* On a scrolling page the card shouldn't scroll inside itself. */
		.site-footer {
			position: relative;
			z-index: 1;
			order: 4;
			margin: var(--space-8) var(--space-5) 0;
			padding: var(--space-4) 0 var(--space-6);
		}

		/* No hover on touch: the panel opens on tap and sits in normal flow,
		   so it pushes the CTA down instead of covering it. Overlaying would
		   trap the tap target underneath on a small screen. */
		/* Keep the mobile footer to the four site sections; the social links
		   would wrap onto a second row for little benefit. */
		.footer-link.is-social { display: none; }
	}

	@media (prefers-reduced-motion: reduce) {
		.map-pane { transition: none; }
	}
</style>
