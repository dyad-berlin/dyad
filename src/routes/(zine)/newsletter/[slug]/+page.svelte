<script lang="ts">
	import { formatEditorialDate } from '$lib/utils/dates';
	import { storageUrl } from '$lib/utils/storage-url';
	import MembershipInvite from '$lib/components/MembershipInvite.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const entry = $derived(data.entry);
</script>

<svelte:head>
	<title>{entry.title} · Unfolding · dyad.</title>
	<meta name="description" content={entry.quote} />
</svelte:head>

<article class="essay">
	<div class="hero">
		{#if entry.heroImage}
			<img class="hero-inner" src={storageUrl('newsletter assets', entry.heroImage)} alt="" />
		{:else}
			<div class="hero-inner" aria-hidden="true"></div>
		{/if}
		{#if entry.heroCredit}
			<p class="hero-credit">{entry.heroCredit}</p>
		{/if}
	</div>

	<div class="essay-content">
		<header class="essay-head">
			<p class="essay-kicker">Unfolding</p>
			<h1 class="essay-title">{entry.title}</h1>
			{#if entry.dek}<p class="essay-dek">{entry.dek}</p>{/if}
			<hr />
			<p class="essay-date-row">{formatEditorialDate(entry.date)}</p>
			<p class="essay-byline">words by Luna</p>
		</header>

		<div class="essay-body">
			<blockquote class="lede-quote">
				“{entry.quote}”
				{#if entry.quoteAttr}<cite>— {entry.quoteAttr}</cite>{/if}
			</blockquote>

			{#each entry.paragraphs as paragraph}
				<p>{paragraph}</p>
			{/each}
		</div>

		<MembershipInvite />
	</div>
</article>

<style>
	.essay-content {
		max-width: 1080px;
		margin: 0 auto;
		padding: 0 0 140px;
	}

	/* Hero: a warm textured panel standing in for photography until the
	   essay has a commissioned image. Inset to the same 1080px/24px measure
	   as the membership-invite section below, so both share one edge. */
	.hero {
		max-width: 1080px;
		margin: 0 auto 64px;
		padding: 0 24px;
	}
	.hero-inner {
		width: 100%;
		border-radius: 3px;
		position: relative;
		display: block;
	}
	/* Real photographs keep their natural aspect ratio, uncropped — height
	   follows the file, never object-fit: cover (cf. Atmos essay heroes). */
	img.hero-inner {
		height: auto;
	}
	/* Placeholder only — real photos (heroImage set) skip the gradient and
	   grain; they're an <img>, not a div, so these rules can't touch them.
	   The fixed height exists only here, where there is no file to size to. */
	div.hero-inner {
		height: clamp(220px, 38vw, 420px);
		background: linear-gradient(155deg, #e8e2d4 0%, #d8cfba 100%);
	}
	div.hero-inner::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 3px;
		opacity: 0.1;
		mix-blend-mode: multiply;
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='900' height='900'><filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.008' numOctaves='4' seed='11' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='900' height='900' filter='url(%23p)'/></svg>");
		background-size: 700px 700px;
	}

	.hero-credit {
		margin: 8px 0 0;
		text-align: right;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.72rem;
		color: var(--paper-ink-faint);
	}

	.essay-head {
		max-width: 640px;
		margin: 0 auto;
		padding: 0 24px;
		text-align: center;
	}

	/* Eyebrow — small, sans, wide-tracked, muted; Atmos runs its category
	   label the same way above the headline. */
	.essay-kicker {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--paper-accent);
		margin: 0 0 22px;
	}

	/* Headline — a heavy geometric sans, not the same family as the body copy:
	   Futura carries that poster-bold, Adobe Express-style weight natively on
	   Mac without pulling an external font (the site self-hosts every face by
	   policy — see CLAUDE.md — so no Google Fonts / CDN swap here). */
	.essay-title {
		font-family: Futura, 'Futura PT', 'Avenir Next', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: clamp(1.26rem, 3.24vw, 2.04rem);
		font-weight: 800;
		line-height: 1.28;
		color: var(--paper-ink);
		margin: 0 0 20px;
		letter-spacing: 0.015em;
		text-transform: uppercase;
	}

	.essay-dek {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 1.2rem;
		color: var(--paper-ink-soft);
		margin: 0 0 28px;
	}

	.essay-head hr {
		width: 44px;
		height: 1px;
		border: none;
		background: var(--paper-line);
		margin: 0 auto 22px;
	}

	.essay-date-row {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.82rem;
		color: var(--paper-ink-faint);
		margin: 0 0 6px;
	}

	.essay-byline {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.85rem;
		color: var(--paper-ink-soft);
		margin: 0 0 28px;
	}

	/* Reading column — SangBleu Sunrise throughout, matching /docs; the sans
	   stack stays reserved for the headline and the small meta chrome. */
	.essay-body {
		max-width: 640px;
		margin: 0 auto;
		padding: 0 24px;
	}

	.essay-body p {
		font-family: var(--font-serif);
		font-size: 1rem;
		font-weight: 400;
		line-height: 1.55;
		color: var(--paper-ink);
		margin: 0 0 34px;
	}

	/* .membership-invite and its children now live in
	   $lib/components/MembershipInvite.svelte (shared with the docs
	   "Become a member" section). */

	/* Epigraph — same size as body, not a pull-quote: Atmos sets its opening
	   quote at essentially body scale, italic, with the attribution folded
	   directly beneath in the same voice. */
	.lede-quote {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 1rem;
		font-weight: 400;
		line-height: 1.55;
		color: var(--paper-ink);
		margin: 0 0 34px;
	}

	.lede-quote cite {
		display: block;
		font-family: inherit;
		font-style: italic;
		font-size: 1rem;
		color: var(--paper-ink);
		margin-top: 2px;
	}

</style>
