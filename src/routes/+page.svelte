<script lang="ts">
	import type { PageData } from './$types';
	import AuthDialog from '$lib/components/AuthDialog.svelte';
	import LandingMap from '$lib/components/LandingMap.svelte';
	import { copy } from '$lib/copy';
	import { env } from '$env/dynamic/public';
	import { storageUrl } from '$lib/utils/storage-url';
	import { lock, unlock } from '$lib/utils/scroll-lock';

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
	// the whole viewport. MapView watches its own container with a
	// ResizeObserver, so Leaflet reflows on the transition without this
	// component signalling anything.
	let mapExpanded = $state(false);

	// A full-screen map is a modal surface: hold the page still behind it. The
	// ref-counted helper keeps the lock honest when the auth dialog opens over
	// the expanded map — whichever closes second still releases cleanly.
	$effect(() => {
		if (!mapExpanded) return;
		lock();
		return unlock;
	});

	// Bubble phase on purpose: the auth dialog owns Escape in the capture
	// phase and stops propagation, so an Escape that closed the dialog never
	// reaches this handler — only the next one collapses the map.
	function onWindowKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && mapExpanded) mapExpanded = false;
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

<svelte:window onkeydown={onWindowKey} />

<!-- ── Hero over a static photo ──
     Deliberately theme-independent, like the (zine) pages: its own local
     --landing-* custom properties, not the global light/dark tokens, so it
     always reads bright regardless of the app's own theme toggle. -->
<div class="shell" class:map-expanded={mapExpanded}>
	<!-- Static pastoral backdrop. The gradient is the base layer; the photo
	     sits on top of it as a second background-image layer, so a 404 just
	     leaves the gradient showing — no broken-image glitch, no JS needed. -->
	<div class="sky" style:background-image={`url(${bgImageUrl}), var(--sky-fallback-gradient)`} aria-hidden="true">
		<div class="sky-scrim"></div>
	</div>

	<!-- Top-left: wordmark. -->
	<div class="intro">
		<a href="/" class="wordmark" aria-label={og.wordmarkLabel}>{og.wordmark}</a>
	</div>

	<!-- A direct child of .shell, not of .left. .left carries its own z-index,
	     which would trap these below the map however high their own z-index
	     went; a stacking context cannot be escaped from the inside. -->
	<div class="left-links">
		<!-- href fallback so this action degrades without JS -->
		<a href="/login" class="text-link" onclick={(e) => { e.preventDefault(); openLogin(); }}>{og.logIn}</a>
		<a href="/waitlist" class="btn-join" data-testid="join-cta">{og.joinWaitlist}</a>
	</div>

	<!-- Top-right: a small map of live conversations, expandable to the full
	     viewport. -->
	<LandingMap prompts={data.mapPrompts ?? []} initialCenter={data.mapCenter} bind:expanded={mapExpanded} />

	<!-- Bottom-left: headline + footer. -->
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
		   below).
		   Muted warm off-white, not the paper's full brightness — pure #faf8f3
		   over a photo reads as glowing rather than printed. */
		--landing-ink: #e4dfd3;
		--landing-ink-soft: rgba(228, 223, 211, 0.8);
		--landing-ink-muted: rgba(228, 223, 211, 0.58);
		--landing-ink-invert: #2a1f16;        /* dark text, for the light-filled CTA */
		--landing-hairline: rgba(250, 248, 243, 0.28);
		/* The dark bark brown and its hairline, for paper-ground contexts:
		   the map chrome, and everything below the mobile fold. */
		--landing-ink-on-paper: #3b2a1d;
		--landing-hairline-on-paper: rgba(59, 42, 29, 0.14);
		--sky-fallback-gradient: linear-gradient(175deg, #dce4e2 0%, #eae6da 55%, #f3efe4 100%);
		/* Width of the right-hand map column. Used both to size the map pane
		   (LandingMap) and to cap .left so the two can never overlap — one
		   value, one place. */
		--map-w: min(560px, 42vw);
		/* The wordmark's type, kept as tokens so the actions row can be
		   centred on its line box rather than on a guessed pixel offset. */
		--wordmark-size: clamp(1.1rem, 1.7vw, 1.45rem);
		--wordmark-leading: 1.15;
		/* Height of the top row: the Join pill is taller than the wordmark's
		   line box and is centred on it, so this is what anything below has to
		   clear. */
		--topbar-h: 44px;
		/* System sans for utility chrome (CTAs, footer links, map chrome);
		   SangBleu (--font-serif, app.css) for prose. */
		--font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		/* A single soft dark shadow for legibility over the photo — deliberately
		   not a second tight shadow, which is what made the type look like it
		   was lit from behind rather than sitting on the image. */
		--ink-halo: 0 1px 14px rgba(26, 21, 15, 0.42);

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

	/* ── Top-left: wordmark ── */
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
		/* The column scrolls rather than clipping: at landscape-phone heights
		   or 150% zoom the copy runs past the viewport, and margin-top: auto
		   on .left-head (not justify-content) keeps the start reachable. */
		overflow-y: auto;
		/* Two caps, whichever is smaller. 880px is the measure we want; the
		   calc is the guard that keeps this column clear of the map, which is
		   absolutely positioned at the right edge. Derived from --map-w rather
		   than a guessed number so the two cannot drift apart. Without it the
		   text sits beneath the map from ~769px to ~1300px. */
		max-width: min(880px, calc(100% - var(--map-w) - var(--space-8)));
		box-sizing: border-box;
	}

	.left-head { position: relative; margin-top: auto; margin-bottom: 0; }

	.left-title {
		font-family: var(--font-serif);
		/* Sized to one row: ~5.1% of the column per character-width keeps all
		   40 characters on a single line; the cap stops it growing past a
		   comfortable display size on wide screens. The clamp above it is the
		   fallback for engines without container query units. If the sizing
		   ever misses, the line wraps gracefully rather than clipping. */
		font-size: clamp(1.6rem, 2.4vw, 2.6rem);
		font-size: min(2.6rem, 5.1cqw);
		font-weight: 700;
		/* A step softer than the body ink: at this size the headline carries by
		   scale, and full-strength here is what read as glare. */
		color: var(--landing-ink-soft);
		margin: 0 0 var(--space-5);
		line-height: 1.24;
		letter-spacing: -0.015em;
		text-align: left;
		text-wrap: pretty;
		text-shadow: var(--ink-halo);
	}

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
	   stacking context. Expanded, they drop behind it; see below.
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
		transition: opacity var(--duration-fast) var(--ease-ink);
	}

	/* Zoomed in, the map owns the viewport, so the actions drop behind it
	   rather than floating over the atlas — the collapse control sits in the
	   same corner and on touch must not end up under the Join pill.
	   visibility, not just opacity, so they also leave the tab order while
	   they are covered. */
	.shell.map-expanded .left-links {
		z-index: 1;
		opacity: 0;
		visibility: hidden;
	}

	/* Primary action: a light pill on the photo, sitting last in the row so it
	   holds the outer edge. Sign in stays a quiet text link beside it. */
	.btn-join {
		display: inline-flex;
		align-items: center;
		background: var(--landing-ink);
		color: var(--landing-ink-invert);
		font-family: var(--font-ui);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.08em;
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
		color: var(--landing-ink);
		text-decoration: none;
		white-space: nowrap;
		transition: opacity 0.15s;
		opacity: 0.85;
	}
	.footer-link:hover { opacity: 1; }

	/* ── Mobile ──
	   The page scrolls: a full-height photo hero (wordmark + headline + CTA),
	   then everything below it sits on the plain paper ground — the map and
	   the footer. Every child here needs position:relative, because .sky
	   is absolutely positioned and positioned elements paint above
	   non-positioned siblings regardless of DOM order; a static child would
	   render underneath the photo. */
	@media (max-width: 768px) {
		:global(body) { overflow: auto; }
		.shell {
			position: relative;
			inset: auto;
			min-height: 100svh;
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
			height: 124svh;
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

		/* Anchored in the hero rather than fixed: the light ink only reads
		   over the photo, so the actions scroll away with it instead of
		   floating on, invisible, over the paper ground below the fold. */
		.left-links {
			position: absolute;
			top: var(--space-5);
			right: var(--space-5);
		}

		/* One row would put a 40-character line below body-copy size on a
		   phone, so the sizing here lets it wrap and keeps the display scale
		   instead. */
		.left-title {
			font-size: clamp(2.1rem, 10.5vw, 3rem);
			/* Bottom-seated copy whose start stays reachable: the auto margin
			   collapses to zero once the block overflows and scrolls, where
			   justify-content: flex-end would push the overflow off the top. */
			margin-top: auto;
		}

		.left-head {
			/* Static, so the actions above can anchor to .shell and share the
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
			min-height: calc(100svh - 92px);
			max-height: calc(100svh - 92px);
			overflow-y: auto;
			/* Starts the copy below the wordmark row with room to breathe,
			   rather than immediately under it. */
			padding-top: calc(var(--space-10) + var(--space-6));
			display: flex;
			flex-direction: column;
			margin: 0;
			padding-right: var(--space-5);
			padding-bottom: var(--space-6);
			padding-left: var(--space-5);
			box-sizing: border-box;
		}

		/* Below the fold the footer sits on the paper ground, not the photo —
		   its ink flips to the dark brown and its rule to the paper hairline. */
		.site-footer {
			--landing-ink: var(--landing-ink-on-paper);
			--landing-hairline: var(--landing-hairline-on-paper);
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
</style>
