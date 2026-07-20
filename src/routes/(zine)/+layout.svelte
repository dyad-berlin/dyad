<script lang="ts">
	import { page } from '$app/stores';
	import ZineFooter from '$lib/components/ZineFooter.svelte';
	let { children } = $props();

	// The docs page is a self-contained reference surface; it carries neither
	// the zine header nor the footer (its own sidebar holds the wordmark).
	const isDocs = $derived($page.url.pathname.startsWith('/docs'));
	// Unfolding keeps the header (for nav) but reads as its own paper surface
	// (see its +layout.svelte), so the header drops its dark fill and floats
	// transparent over the hero/paper background instead.
	const isUnfolding = $derived($page.url.pathname.startsWith('/unfolding'));

	// Scroll-aware reveal (Atmos-style): dissolves on scroll down, reappears
	// on scroll up, always visible near the top. Scoped to /unfolding — the
	// only variant that's floated (position: fixed) over its content rather
	// than sitting in normal flow.
	let headerHidden = $state(false);
	let lastScrollY = 0;

	function onScroll() {
		if (!isUnfolding) return;
		const y = window.scrollY;
		if (y < 80) {
			headerHidden = false;
		} else if (y > lastScrollY) {
			headerHidden = true; // scrolling down
		} else if (y < lastScrollY) {
			headerHidden = false; // scrolling up
		}
		lastScrollY = y;
	}
</script>

<svelte:window onscroll={onScroll} />

<div class="zine-shell" data-theme="dark">
	{#if !isDocs}
	<header
		class="zine-header"
		class:zine-header-transparent={isUnfolding}
		class:zine-header-hidden={isUnfolding && headerHidden}
		class:zine-header-centered={isUnfolding}
	>
		{#if isUnfolding}
			<!-- Atmos-style: a Menu disclosure at left nests the section links,
			     DYAD sits centered, an empty spacer on the right balances the
			     grid so the wordmark centers regardless of the Menu button's
			     width. Wording/order under Menu matches the landing footer's
			     row: Documentation, Community, Newsletter. -->
			<details class="zine-menu">
				<summary class="zine-menu-toggle">Menu</summary>
				<nav class="zine-menu-panel">
					<a href="/docs" class="zine-nav-link">documentation</a>
					<a href="/community" class="zine-nav-link">community</a>
					<a href="/unfolding" class="zine-nav-link">newsletter</a>
				</nav>
			</details>
			<a href="/" class="zine-wordmark zine-wordmark-centered">DYAD</a>
			<span class="zine-header-spacer" aria-hidden="true"></span>
		{:else}
			<a href="/" class="zine-wordmark">DYAD</a>
			<nav class="zine-nav">
				<a href="/community" class="zine-nav-link">community</a>
				<a href="/governance" class="zine-nav-link">participatory governance</a>
				<a href="/unfolding" class="zine-nav-link">unfolding</a>
				<a href="/docs" class="zine-nav-link">docs</a>
			</nav>
			<!-- Mobile: the inline nav is hidden; this disclosure keeps the section
			     links reachable and in the a11y tree on small screens. -->
			<details class="zine-nav-mobile">
				<summary aria-label="Sections">Sections</summary>
				<nav class="zine-nav-mobile-links">
					<a href="/community" class="zine-nav-link">community</a>
					<a href="/governance" class="zine-nav-link">participatory governance</a>
					<a href="/unfolding" class="zine-nav-link">unfolding</a>
					<a href="/docs" class="zine-nav-link">docs</a>
				</nav>
			</details>
		{/if}
	</header>
	{/if}

	<main class="zine-main">
		{@render children()}
	</main>

	{#if !isDocs}
		<ZineFooter />
	{/if}
</div>

<style>
	:global(body) { margin: 0; overflow: auto; }
	:global(html) { scroll-behavior: smooth; }

	/* The zine is a dark surface. Named locals carry the few values that have
	   no clean app.css token; everything else maps onto the [data-theme="dark"]
	   tokens via the wrapper above. */
	.zine-shell {
		/* Moss-black family (see app.css dark theme) rather than neutral black. */
		--zine-bg: #0b0e0c;
		--zine-bg-translucent: rgba(11, 14, 12, 0.92);
		/* The parchment ink hue: one source, alpha steps layered on top. Changing
		   the hue here re-tints every zine surface at once. */
		--zine-ink-rgb: 240, 236, 230;
		--zine-ink: rgba(var(--zine-ink-rgb), 0.8);
		--zine-ink-strong: rgba(var(--zine-ink-rgb), 0.9);
		--zine-ink-muted: rgba(var(--zine-ink-rgb), 0.35);
		/* Extra ink steps consumed by the docs page's prose scale. */
		--zine-ink-body: rgba(var(--zine-ink-rgb), 0.62);
		--zine-ink-soft: rgba(var(--zine-ink-rgb), 0.5);
		--zine-hairline: rgba(var(--zine-ink-rgb), 0.05);

		min-height: 100vh;
		background: var(--zine-bg);
		color: var(--zine-ink);
		display: flex;
		flex-direction: column;
	}

	/* Apartment-wall texture — same grain + plaster mottle as the app's dark
	   theme (app.css); scoped here because the zine paints its own surface. */
	.zine-shell::before,
	.zine-shell::after {
		content: '';
		position: fixed;
		inset: 0;
		pointer-events: none;
	}
	.zine-shell::before {
		opacity: 0.07;
		mix-blend-mode: screen;
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='3'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
	}
	.zine-shell::after {
		opacity: 0.15;
		mix-blend-mode: soft-light;
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='900' height='900'><filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.006' numOctaves='4' seed='7' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='900' height='900' filter='url(%23p)'/></svg>");
		background-size: 900px 900px;
	}

	/* ── Header ── */
	/* The sticky header sits above the shell's fixed grain overlays, so it
	   carries its own moss tint and grain rather than reading as flat black. */
	.zine-header {
		position: sticky;
		top: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 48px;
		background: rgba(19, 26, 21, 0.92);
		backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--zine-hairline);
	}
	.zine-header::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0.09;
		mix-blend-mode: screen;
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='3'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
	}

	/* Unfolding's header sits in normal flow, like Atmos's own white bar:
	   solid fill matching the paper ground, pushing the hero image down
	   rather than floating over it, so there's real margin from the top. */
	.zine-header-transparent {
		background: #faf8f3;
		backdrop-filter: none;
		border-bottom: 1px solid rgba(20, 20, 20, 0.08);
		opacity: 1;
		transform: translateY(0);
		transition: opacity 0.35s var(--ease-ink, ease), transform 0.35s var(--ease-ink, ease);
	}
	.zine-header-transparent::before { display: none; }
	.zine-header-transparent .zine-wordmark,
	.zine-header-transparent .zine-nav-link,
	.zine-header-transparent .zine-nav-mobile summary,
	.zine-header-transparent .zine-menu-toggle {
		color: #1b1c1e;
	}
	.zine-header-transparent .zine-nav-link:hover { color: #4a5d3f; }

	/* Dissolves on scroll down, reappears on scroll up (see onScroll above). */
	.zine-header-hidden {
		opacity: 0;
		transform: translateY(-12px);
		pointer-events: none;
	}

	/* Atmos layout: Menu at left, DYAD centered, an empty spacer at right
	   balances the grid so the wordmark centers regardless of the Menu
	   button's own width — three equal-ish columns instead of the default
	   flex space-between. */
	.zine-header-centered {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
	}

	.zine-wordmark-centered {
		justify-self: center;
	}

	.zine-header-spacer {
		justify-self: end;
	}

	.zine-menu {
		justify-self: start;
		position: relative;
	}

	.zine-menu-toggle {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		color: var(--zine-ink-muted);
		cursor: pointer;
		list-style: none;
		user-select: none;
	}
	.zine-menu-toggle::-webkit-details-marker { display: none; }
	.zine-menu-toggle:hover { color: rgba(240, 236, 230, 0.85); }

	.zine-menu-panel {
		position: absolute;
		top: calc(100% + 16px);
		left: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px 20px;
		background: #faf8f3;
		border: 1px solid rgba(20, 20, 20, 0.08);
		border-radius: 4px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
		min-width: 160px;
	}
	.zine-menu-panel .zine-nav-link {
		color: #1b1c1e;
	}
	.zine-menu-panel .zine-nav-link:hover {
		color: #4a5d3f;
	}

	.zine-wordmark {
		font-family: var(--font-serif);
		font-size: 18px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--zine-ink-strong);
		text-decoration: none;
	}

	.zine-nav {
		display: flex;
		gap: 32px;
	}

	.zine-nav-link {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		color: var(--zine-ink-muted);
		text-decoration: none;
		transition: color 0.15s;
	}

	.zine-nav-link:hover {
		color: rgba(240, 236, 230, 0.85);
	}

	/* Mobile section disclosure — hidden on desktop. */
	.zine-nav-mobile {
		display: none;
	}

	.zine-nav-mobile summary {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		color: var(--zine-ink-muted);
		cursor: pointer;
		list-style: none;
	}

	.zine-nav-mobile summary::-webkit-details-marker { display: none; }

	.zine-nav-mobile-links {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-top: 12px;
	}

	/* ── Main ── */
	.zine-main {
		flex: 1;
	}

	/* ── Shared zine page chrome (hoisted from the 3 pages). The pages render
	   this markup inside <main>, so the selectors must be :global — scoped
	   layout styles do not reach slotted page content. Page-specific bits
	   (.page-title sizing, the various card grids) stay in each page. ── */
	:global(.zine-main .page) {
		max-width: 1080px;
		margin: 0 auto;
		padding: 80px 48px 120px;
	}

	:global(.zine-main .page-intro) {
		margin-bottom: 56px;
		padding-bottom: 48px;
		border-bottom: 1px solid rgba(240, 236, 230, 0.07);
	}

	:global(.zine-main .page-body) {
		display: grid;
		grid-template-columns: 160px 1fr;
		gap: 64px;
		align-items: start;
	}

	:global(.zine-main .section-label) {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(240, 236, 230, 0.28);
		margin: 0 0 20px;
	}

	:global(.zine-main .page-attr) {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.06em;
		color: rgba(240, 236, 230, 0.25);
		margin: 0;
	}

	/* ── Sticky TOC ── */
	:global(.zine-main .toc) {
		position: sticky;
		top: 80px;
		height: fit-content;
	}

	:global(.zine-main .toc-label) {
		font-family: var(--font-mono);
		font-size: 0.52rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(240, 236, 230, 0.2);
		margin: 0 0 14px;
	}

	:global(.zine-main .toc-list) {
		list-style: none;
		margin: 0;
		padding: 0;
		counter-reset: toc-counter;
	}

	:global(.zine-main .toc-list li) {
		display: flex;
		align-items: baseline;
		gap: 8px;
		counter-increment: toc-counter;
		padding: 7px 0;
		border-bottom: 1px solid rgba(240, 236, 230, 0.04);
	}

	:global(.zine-main .toc-list li:last-child) { border-bottom: none; }

	:global(.zine-main .toc-list li::before) {
		content: counter(toc-counter, decimal-leading-zero);
		font-family: var(--font-mono);
		font-size: 0.48rem;
		letter-spacing: 0.04em;
		color: rgba(240, 236, 230, 0.15);
		flex-shrink: 0;
		transition: color 0.15s;
	}

	:global(.zine-main .toc-list a) {
		font-family: var(--font-serif);
		font-size: 0.78rem;
		font-weight: 300;
		color: rgba(240, 236, 230, 0.38);
		text-decoration: none;
		line-height: 1.35;
		transition: color 0.15s;
	}

	:global(.zine-main .toc-list a:hover) { color: rgba(240, 236, 230, 0.75); }

	:global(.zine-main .toc-list a.active) {
		color: rgba(240, 236, 230, 0.88);
		font-weight: 400;
	}

	:global(.zine-main .toc-list li:has(a.active)::before) {
		color: rgba(240, 236, 230, 0.4);
	}

	:global(.zine-main .toc-list a.past) {
		color: rgba(240, 236, 230, 0.18);
	}

	/* ── Prose ── */
	:global(.zine-main .prose section) {
		padding: 56px 0;
		border-bottom: 1px solid rgba(240, 236, 230, 0.05);
	}

	:global(.zine-main .prose section:first-child) { padding-top: 0; }
	:global(.zine-main .prose section:last-child) { border-bottom: none; }

	:global(.zine-main .section-h2) {
		font-family: var(--font-serif);
		font-size: clamp(1.3rem, 2.5vw, 1.75rem);
		font-weight: 400;
		color: rgba(240, 236, 230, 0.88);
		margin: 0 0 28px;
		line-height: 1.2;
	}

	:global(.zine-main .prose p) {
		font-family: var(--font-serif);
		font-size: 1rem;
		font-weight: 300;
		color: rgba(240, 236, 230, 0.6);
		line-height: 1.8;
		margin: 0 0 20px;
	}

	:global(.zine-main .prose strong) {
		color: rgba(240, 236, 230, 0.85);
		font-weight: 400;
	}

	/* ── Mobile ── */
	@media (max-width: 640px) {
		.zine-header {
			padding: 16px 20px;
			flex-wrap: wrap;
		}

		.zine-nav {
			display: none;
		}

		.zine-nav-mobile {
			display: block;
		}
	}

	@media (max-width: 760px) {
		:global(.zine-main .page) { padding: 40px 20px 80px; }
		:global(.zine-main .page-body) { grid-template-columns: 1fr; gap: 0; }
		:global(.zine-main .toc) {
			position: static;
			margin-bottom: 40px;
			border-bottom: 1px solid rgba(240, 236, 230, 0.07);
			padding-bottom: 32px;
		}
	}
</style>
