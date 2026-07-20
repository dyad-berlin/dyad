<script lang="ts">
	import { onMount } from 'svelte';
	import { docSections, sectionIds } from './docs-nav';

	// Master–detail: the sidebar picks a topic, the pane shows only that topic.
	// The hash carries the selection so every topic stays deep-linkable. The
	// topics themselves are declared once in ./docs-nav.
	const topItems = docSections.filter((s) => s.group === 'top');
	const about = docSections.filter((s) => s.group === 'about');
	const community = docSections.filter((s) => s.group === 'community');
	const governance = docSections.filter((s) => s.group === 'governance');

	const DEFAULT_ID = 'support-us';
	let active = $state(DEFAULT_ID);
	let pane = $state<HTMLElement | undefined>();

	const current = $derived(docSections.find((s) => s.id === active) ?? docSections[0]);

	function fromHash() {
		const h = (location.hash || '').replace('#', '');
		active = sectionIds.has(h) ? h : DEFAULT_ID;
	}

	function select(id: string) {
		active = id;
		// Keep the URL shareable without triggering the browser's own scroll-to-id
		// (the target only renders after this assignment anyway).
		history.replaceState(null, '', '#' + id);
		pane?.scrollIntoView({ block: 'start' });
	}

	onMount(fromHash);
</script>

<svelte:window onhashchange={fromHash} />

<svelte:head>
	<title>Documentation · dyad.</title>
	<meta
		name="description"
		content="Everything that defines dyad as an organization: the governing documents, the processes, and practical guides for members."
	/>
</svelte:head>

<div class="docs">
	<aside class="side">
		<nav aria-label="Documentation">
			{#each topItems as item (item.id)}
				<button class="side-link side-top" class:active={active === item.id} onclick={() => select(item.id)}>{item.title}</button>
			{/each}

			<p class="side-head">About Us</p>
			{#each about as item (item.id)}
				<button class="side-link" class:active={active === item.id} onclick={() => select(item.id)}>{item.title}</button>
			{/each}

			<p class="side-head">Community</p>
			{#each community as item (item.id)}
				<button class="side-link" class:side-sub={item.sub} class:active={active === item.id} onclick={() => select(item.id)}>{item.title}</button>
			{/each}

			<p class="side-head">Governance</p>
			{#each governance as item (item.id)}
				<button class="side-link" class:side-sub={item.sub} class:active={active === item.id} onclick={() => select(item.id)}>{item.title}</button>
			{/each}
		</nav>
	</aside>

	<main class="body" bind:this={pane}>
		{#key current.id}
			{@const Section = current.component}
			<Section {select} />
		{/key}
	</main>
</div>

<style>
	.docs {
		display: grid;
		grid-template-columns: 240px 1fr;
		gap: 56px;
		max-width: 1080px;
		margin: 0 auto;
		padding: 48px 48px 96px;
	}

	/* ── Sidebar ── */
	.side {
		border-right: 1px solid rgba(var(--zine-ink-rgb), 0.08);
		padding-right: 32px;
	}
	.side-wordmark {
		display: block;
		font-family: var(--font-serif);
		font-size: 18px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--zine-ink-strong);
		text-decoration: none;
		margin: 0 0 28px;
	}
	.side nav {
		position: sticky;
		top: 32px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}
	.side-top {
		font-weight: 500;
		color: rgba(var(--zine-ink-rgb), 0.85) !important;
		margin-bottom: 8px;
	}
	.side-head {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--zine-ink-muted);
		margin: 20px 0 6px;
	}
	.side-link {
		font-family: var(--font-serif);
		font-size: 0.85rem;
		font-weight: 300;
		color: var(--zine-ink-soft);
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		padding: 3px 0;
		line-height: 1.4;
		transition: color 0.15s;
	}
	.side-link:hover { color: var(--zine-ink-strong); }
	.side-sub { padding-left: 14px; font-size: 0.8rem; }
	.side-link.active { color: rgba(var(--zine-ink-rgb), 0.95); }

	/* ── Body ── */
	/* The detail panes render as child components, so the prose styling reaches
	   into them via `.body :global(...)` rather than plain scoped selectors. */
	.body { min-width: 0; scroll-margin-top: 88px; }
	.body :global(section) { padding: 8px 0 40px; }

	.body :global(h1) {
		font-family: var(--font-serif);
		font-size: 2rem;
		font-weight: 500;
		color: var(--zine-ink-strong);
		margin: 0 0 20px;
	}
	.body :global(h2) {
		font-family: var(--font-serif);
		font-size: 1.4rem;
		font-weight: 400;
		color: rgba(var(--zine-ink-rgb), 0.88);
		margin: 0 0 16px;
	}
	.body :global(h3) {
		font-family: var(--font-serif);
		font-size: 1rem;
		font-weight: 500;
		color: var(--zine-ink);
		margin: 28px 0 8px;
	}
	.body :global(.doc-kicker) {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--zine-ink-muted);
		margin: 0 0 10px;
	}
	.body :global(.doc-note) {
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 300;
		color: var(--zine-ink-soft);
		border-left: 2px solid rgba(var(--zine-ink-rgb), 0.12);
		padding: 4px 0 4px 20px;
		margin: 0 0 8px;
		line-height: 1.65;
		max-width: 62ch;
	}
	.body :global(p),
	.body :global(li),
	.body :global(dd) {
		font-family: var(--font-serif);
		font-size: 0.92rem;
		font-weight: 300;
		color: var(--zine-ink-body);
		line-height: 1.7;
		max-width: 65ch;
	}
	.body :global(p) { margin: 0 0 14px; }
	.body :global(ul),
	.body :global(ol) { padding-left: 22px; margin: 0 0 14px; }
	.body :global(li) { margin-bottom: 8px; }
	.body :global(li strong),
	.body :global(p strong) { color: var(--zine-ink); font-weight: 500; }
	.body :global(a) { color: var(--zine-ink); text-decoration: underline; text-underline-offset: 3px; }
	.body :global(a:hover) { color: rgba(var(--zine-ink-rgb), 1); }
	.body :global(.inline-link) {
		font-family: inherit;
		font-size: inherit;
		font-weight: inherit;
		color: var(--zine-ink);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.body :global(.inline-link:hover) { color: rgba(var(--zine-ink-rgb), 1); }
	.body :global(.deeper) { margin-top: 24px; }
	.body :global(dl) { margin: 0; max-width: 65ch; }
	.body :global(dt) {
		font-family: var(--font-serif);
		font-weight: 500;
		color: var(--zine-ink);
		margin-top: 12px;
	}
	.body :global(dd) { margin: 2px 0 0; }

	@media (max-width: 860px) {
		.docs { grid-template-columns: 1fr; gap: 24px; padding: 24px 20px 64px; }
		.side { border-right: none; border-bottom: 1px solid rgba(var(--zine-ink-rgb), 0.08); padding: 0 0 20px; }
		.side nav { position: static; }
	}
</style>
