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

	// The three about sections, shown in full — no longer collapsible.
	const heroItems: Array<{ label: string; body: string[] }> = [
		{ label: og.toggleLabelWeAre, body: [og.subcopy] },
		{
			label: og.toggleLabelWeDo,
			body: [`${og.subcopyHighlightPre} ${og.subcopyHighlight}`, og.subcopyClosing]
		},
		{ label: og.toggleLabelWhy, body: [og.subcopyWhy] }
	];
	// Collapsed, the map is a card in the top-right corner; expanded, it takes
	// the right half of the page as it used to. MapView watches its own
	// container with a ResizeObserver, so Leaflet reflows on the transition
	// without this component signalling anything.
	let mapExpanded = $state(false);

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

	<!-- Top-right: a small map of live conversations, expandable to the right
	     half of the page. -->
	<aside class="map-pane" class:expanded={mapExpanded}>
		<div class="map-frame">
			<span class="map-banner">{og.mapBanner}</span>

			<button
				type="button"
				class="map-expand"
				aria-expanded={mapExpanded}
				onclick={() => (mapExpanded = !mapExpanded)}
			>
				{mapExpanded ? 'Close map' : 'Expand map'}
			</button>

			<div class="map-inner">
				{#await import('$lib/components/MapView.svelte')}
					<div class="map-placeholder"></div>
				{:then { default: MapView }}
					<MapView
						prompts={conversations}
						initialCenter={data.mapCenter}
						initialZoom={11}
						onSelectPin={handlePinSelect}
						onMapClick={closeConversation}
						scrollWheelZoom={false}
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
					<div class="map-card-body">
						<h3 class="map-card-title">{selected.title ?? 'Untitled'}</h3>
						<div class="map-card-meta">
							{#if areaOf(selected)}<span>{areaOf(selected)}</span>{/if}
							{#if selected.soonest_slot}<span>{formatDate(selected.soonest_slot)}</span>{/if}
						</div>
						<a href="/waitlist" class="map-card-cta">{og.mapCardCta}</a>
					</div>
				</div>
			{/if}
		</div>

		<!-- Nested under the map. Every section is shown in full — no longer
		     collapsible, so these are plain headings rather than buttons. -->
		<section class="hero-card" aria-label="About dyad">
			{#each heroItems as item}
				<div class="hero-toggle-item">
					<h2 class="hero-toggle-label">{item.label}</h2>
					{#each item.body as paragraph}
						<p class="hero-toggle-body">{paragraph}</p>
					{/each}
				</div>
			{/each}
		</section>
	</aside>

	<section class="left">
		<header class="left-head">
			<h1 class="left-title">{og.headlineLine1}<br />{og.headlineLine2}<br />{og.headlineLine3}</h1>
			<div class="left-links">
				<a href="/waitlist" class="btn-join" data-testid="join-cta">{og.joinWaitlist}</a>
				<!-- href fallback so this action degrades without JS -->
				<a href="/login" class="text-link" onclick={(e) => { e.preventDefault(); openLogin(); }}>{og.logIn}</a>
			</div>
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
		--landing-ink: #3b2a1d;              /* dark bark brown — matched to the trees in the photo */
		--landing-ink-soft: rgba(59, 42, 29, 0.72);
		--landing-ink-muted: rgba(59, 42, 29, 0.48);
		--landing-ink-invert: #faf8f3;        /* light text, for the dark-filled CTA */
		--landing-hairline: rgba(59, 42, 29, 0.14);
		--landing-card-bg: #fff;
		--landing-card-ink: #111;
		--landing-card-ink-muted: #717171;
		/* The map sits almost the same tone as the paper ground, so it reads
		   as part of the page rather than a dark box dropped onto it. */
		--landing-map-surface: rgba(250, 248, 243, 0.92);
		--sky-fallback-gradient: linear-gradient(175deg, #dce4e2 0%, #eae6da 55%, #f3efe4 100%);
		/* Type stacks shared with the newsletter (see (zine)/newsletter):
		   Futura for uppercase headings, system sans for uppercase kickers
		   and utility chrome, SangBleu (--font-serif, app.css) for prose. */
		--font-display: Futura, 'Futura PT', 'Avenir Next', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif;
		--font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		/* Light halo behind dark ink — the main legibility aid over the photo,
		   so the scrim can stay faint and the image reads close to as-shot. */
		--ink-halo: 0 1px 16px rgba(250, 248, 243, 0.78), 0 0 2px rgba(250, 248, 243, 0.6);

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
	.sky-scrim {
		position: absolute;
		inset: 0;
		background: rgba(250, 248, 243, 0.12);
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
		font-size: clamp(1.1rem, 1.7vw, 1.45rem);
		font-weight: 700;
		letter-spacing: 0.06em;
		color: var(--landing-ink);
		text-decoration: none;
		line-height: 1.15;
		text-shadow: var(--ink-halo);
	}

	/* No surface of its own — the text sits straight on the photo, carried by
	   the ink halo on each line (see --ink-halo). Still its own scroll area:
	   every section keeps a visible preview, and opening one scrolls rather
	   than pushing the block off-screen. */
	.hero-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-1) 0 0;
		max-height: 38vh;
		overflow-y: auto;
	}

	.hero-toggle-item {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}

	/* Section headings — the newsletter's card-title treatment: Futura,
	   uppercase, heavy. See (zine)/newsletter/+page.svelte. */
	.hero-toggle-label {
		font-family: var(--font-display);
		font-size: 1rem;
		font-weight: 800;
		letter-spacing: 0.01em;
		text-transform: uppercase;
		color: var(--landing-ink);
		margin: 0;
		text-shadow: var(--ink-halo);
	}

	/* Prose — matched to the newsletter essay body (.essay-body p in
	   (zine)/newsletter/[slug]): SangBleu, 1rem, 400, 1.55, upright. The
	   34px trailing margin there separates paragraphs; here the section gap
	   does that, so only paragraphs after the first carry it. */
	.hero-toggle-body {
		font-family: var(--font-serif);
		font-size: 1rem;
		font-weight: 400;
		line-height: 1.55;
		color: var(--landing-ink);
		margin: var(--space-2) 0 0;
		text-shadow: var(--ink-halo);
	}
	.hero-toggle-body + .hero-toggle-body { margin-top: 22px; }

	/* ── Bottom-left: headline + footer ── */
	.left {
		position: relative;
		z-index: 20;
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		max-width: var(--content-standard, 700px);
		margin-top: auto;
		box-sizing: border-box;
	}

	.left-head { margin-top: auto; margin-bottom: var(--space-6); }

	.left-title {
		font-family: var(--font-serif);
		font-size: clamp(2rem, 4.4vw, 3rem);
		font-weight: 700;
		color: var(--landing-ink);
		margin: 0 0 var(--space-5);
		line-height: 1.05;
		letter-spacing: -0.015em;
		text-shadow: 0 2px 24px rgba(250, 248, 243, 0.7), 0 1px 3px rgba(250, 248, 243, 0.5);
	}

	.left-links { display: flex; gap: var(--space-4); align-items: center; }

	/* Primary action: a dark pill on the bright hero so Join is unmistakably
	   the first thing to do. Log in stays a quiet text link beside it. */
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
		margin-top: var(--space-5);
		padding-top: var(--space-4);
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
		top: var(--space-6);
		z-index: 30;
		width: min(560px, 42vw);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		transition: width var(--duration-slow, 400ms) var(--ease-ink, ease),
		            bottom var(--duration-slow, 400ms) var(--ease-ink, ease);
	}

	/* Expanded: the right half of the page, as the map pane used to be. It
	   floats over the headline/footer beneath rather than reflowing them —
	   z-index above .left, and the frame is opaque so nothing shows through. */
	.map-pane.expanded {
		width: min(52vw, 820px);
		bottom: var(--space-4);
		z-index: 60;
	}
	.map-pane.expanded .map-frame {
		aspect-ratio: auto;
		flex: 1;
		min-height: 0;
	}

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
		color: var(--landing-ink);
		background: rgba(250, 248, 243, 0.9);
		border: 1px solid var(--landing-hairline);
		border-radius: var(--radius-pill);
		padding: 5px 12px;
	}

	.map-expand {
		position: absolute;
		top: var(--space-3);
		right: var(--space-3);
		z-index: 1200;
		font-family: var(--font-ui);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--landing-ink);
		background: rgba(250, 248, 243, 0.9);
		border: 1px solid var(--landing-hairline);
		border-radius: var(--radius-pill);
		padding: 5px 12px;
		cursor: pointer;
		transition: background 0.15s;
	}
	.map-expand:hover { background: rgba(250, 248, 243, 1); }

	.map-frame {
		position: relative;
		width: 100%;
		aspect-ratio: 4 / 3;
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
	@media (min-width: 769px) {
		/* A half-transparent panel behind the about text so it reads clearly
		   over the photo — the image still shows through it. Mobile doesn't
		   need this: that text sits on the plain paper ground below the fold. */
		.hero-card {
			background: rgba(250, 248, 243, 0.55);
			backdrop-filter: blur(10px);
			border: 1px solid rgba(250, 248, 243, 0.5);
			border-radius: var(--radius-card);
			padding: var(--space-5);
		}
	}

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

		.left-head {
			position: relative;
			z-index: 1;
			order: 2;
			/* Fills out the rest of the first screen so the headline lands at
			   the fold, with the wordmark row above accounted for. */
			min-height: calc(100vh - 92px);
			display: flex;
			flex-direction: column;
			justify-content: flex-end;
			margin: 0;
			padding: 0 var(--space-5) var(--space-6);
			box-sizing: border-box;
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
		/* Expanding is a desktop affordance — on mobile the card is already
		   full-width, so the control has nothing to do. */
		.map-expand { display: none; }

		/* On a scrolling page the card shouldn't scroll inside itself. */
		.hero-card { max-height: none; overflow: visible; }

		.site-footer {
			position: relative;
			z-index: 1;
			order: 4;
			margin: var(--space-8) var(--space-5) 0;
			padding: var(--space-4) 0 var(--space-6);
		}

		/* Keep the mobile footer to the four site sections; the social links
		   would wrap onto a second row for little benefit. */
		.footer-link.is-social { display: none; }
	}

	@media (prefers-reduced-motion: reduce) {
		.map-pane { transition: none; }
	}
</style>
