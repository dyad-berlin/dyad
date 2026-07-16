<script lang="ts">
	import { unfoldingEntries } from '$lib/content/unfolding';
	import { formatEditorialDate } from '$lib/utils/dates';

	const [featured, ...rest] = unfoldingEntries;
</script>

<svelte:head>
	<title>Unfolding · dyad.</title>
	<meta
		name="description"
		content="Unfolding is our weekly meditations on building a collectively owned and governed social technology company."
	/>
</svelte:head>

<div class="archive">
	<header class="archive-head">
		<p class="section-label">Unfolding</p>
		<h1 class="archive-title">Unfolding is our weekly meditations on building a collectively owned and governed social technology company.</h1>
	</header>

	{#if featured}
		<a href="/unfolding/{featured.slug}" class="featured">
			<div class="featured-hero" aria-hidden="true"></div>
			<div class="featured-text">
				<p class="entry-kicker">Unfolding</p>
				<h2 class="featured-title">{featured.title}</h2>
				{#if featured.dek}<p class="featured-dek">{featured.dek}</p>{/if}
				<p class="entry-date">{formatEditorialDate(featured.date)}</p>
			</div>
		</a>
	{/if}

	<div class="grid">
		{#each rest as entry}
			<a href="/unfolding/{entry.slug}" class="card">
				<div class="card-hero" aria-hidden="true"></div>
				<p class="entry-kicker">Unfolding</p>
				<h3 class="card-title">{entry.title}</h3>
				<p class="entry-date">{formatEditorialDate(entry.date)}</p>
			</a>
		{/each}
	</div>
</div>

<style>
	.archive {
		max-width: 1080px;
		margin: 0 auto;
		padding: 88px 48px 140px;
	}

	.archive-head {
		margin: 0 0 72px;
	}

	.section-label {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--paper-accent);
		margin: 0 0 22px;
	}

	.archive-title {
		font-family: var(--font-serif);
		font-size: clamp(1.4rem, 2.7vw, 1.9rem);
		font-weight: 400;
		font-style: italic;
		line-height: 1.4;
		color: var(--paper-ink);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.entry-kicker {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--paper-ink-faint);
		margin: 0 0 12px;
	}

	.entry-date {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.78rem;
		color: var(--paper-ink-faint);
		margin: 10px 0 0;
	}

	/* ── Featured (most recent) ── */
	.featured {
		display: grid;
		grid-template-columns: 1.1fr 1fr;
		gap: 48px;
		align-items: center;
		text-decoration: none;
		margin-bottom: 96px;
		padding-bottom: 80px;
		border-bottom: 1px solid var(--paper-line);
	}

	.featured-hero {
		width: 100%;
		aspect-ratio: 4 / 3;
		border-radius: 3px;
		background: linear-gradient(155deg, #e8e2d4 0%, #d8cfba 100%);
		position: relative;
	}
	.featured-hero::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 3px;
		opacity: 0.1;
		mix-blend-mode: multiply;
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='700' height='700'><filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.009' numOctaves='4' seed='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='700' height='700' filter='url(%23p)'/></svg>");
	}

	.featured-title {
		font-family: Futura, 'Futura PT', 'Avenir Next', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: clamp(1.3rem, 2.6vw, 1.75rem);
		font-weight: 800;
		line-height: 1.25;
		letter-spacing: 0.01em;
		text-transform: uppercase;
		color: var(--paper-ink);
		margin: 0 0 14px;
		transition: color 0.15s;
	}

	.featured:hover .featured-title { color: var(--paper-accent); }

	.featured-dek {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 1.05rem;
		color: var(--paper-ink-soft);
		margin: 0;
	}

	/* ── Grid of the rest ── */
	.grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 48px 36px;
	}

	.card {
		text-decoration: none;
	}

	.card-hero {
		width: 100%;
		aspect-ratio: 4 / 3;
		border-radius: 3px;
		margin-bottom: 22px;
		background: linear-gradient(155deg, #e8e2d4 0%, #d8cfba 100%);
		position: relative;
	}
	.card-hero::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 3px;
		opacity: 0.08;
		mix-blend-mode: multiply;
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='700' height='700'><filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.01' numOctaves='4' seed='9' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='700' height='700' filter='url(%23p)'/></svg>");
	}

	.card-title {
		font-family: Futura, 'Futura PT', 'Avenir Next', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif;
		font-size: 1rem;
		font-weight: 800;
		line-height: 1.3;
		letter-spacing: 0.01em;
		text-transform: uppercase;
		color: var(--paper-ink);
		margin: 0;
		transition: color 0.15s;
	}

	.card:hover .card-title { color: var(--paper-accent); }

	@media (max-width: 760px) {
		.archive { padding: 48px 20px 90px; }
		.featured { grid-template-columns: 1fr; }
		.grid { grid-template-columns: 1fr 1fr; gap: 36px 24px; }
	}

	@media (max-width: 480px) {
		.grid { grid-template-columns: 1fr; }
	}
</style>
