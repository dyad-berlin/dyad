<script lang="ts">
	import { onMount } from 'svelte';
	import ImpressumContent from '$lib/components/legal/ImpressumContent.svelte';
	import AgbContent from '$lib/components/legal/AgbContent.svelte';
	import DatenschutzContent from '$lib/components/legal/DatenschutzContent.svelte';

	const DOCS = ['impressum', 'agb', 'datenschutz'] as const;
	type DocId = (typeof DOCS)[number];
	const LABELS: Record<DocId, string> = { impressum: 'Impressum', agb: 'AGB', datenschutz: 'Privacy' };

	let active = $state<DocId>('impressum');

	function fromHash() {
		const h = (location.hash || '').replace('#', '');
		active = (DOCS as readonly string[]).includes(h) ? (h as DocId) : 'impressum';
	}

	function select(id: DocId) {
		active = id;
		// Keep the URL shareable without triggering the browser's own scroll-to-id.
		history.replaceState(null, '', '#' + id);
	}

	onMount(fromHash);
</script>

<svelte:window onhashchange={fromHash} />

<svelte:head>
	<title>legal · dyad. cultivating a culture of conversation</title>
</svelte:head>

<main class="legal-page">
	<h1 class="legal-title">Legal</h1>

	<nav class="legal-tabs" role="group" aria-label="Legal document">
		{#each DOCS as id (id)}
			<button type="button" class:active={active === id} aria-pressed={active === id} onclick={() => select(id)}>
				{LABELS[id]}
			</button>
		{/each}
	</nav>

	{#if active === 'impressum'}
		<ImpressumContent />
	{:else if active === 'agb'}
		<AgbContent />
	{:else}
		<DatenschutzContent />
	{/if}
</main>

<style>
	:global(body) {
		overflow: auto !important;
	}

	.legal-page {
		max-width: var(--content-narrow);
		margin: 0 auto;
		padding: 80px var(--space-6) 120px;
	}

	.back-link {
		display: inline-block;
		margin-bottom: 48px;
		font-size: var(--text-base);
		color: var(--text-muted);
		text-decoration: none;
		transition: color 0.2s;
	}

	.back-link:hover {
		color: var(--text-primary);
	}

	.legal-title {
		font-size: var(--text-3xl);
		font-weight: normal;
		color: var(--text-primary);
		margin: 0 0 var(--space-6);
	}

	/* Same tab treatment as each document's own DE/EN toggle. */
	.legal-tabs {
		display: flex;
		gap: var(--space-1);
		margin-bottom: var(--space-10);
	}

	.legal-tabs button {
		font: inherit;
		font-size: var(--text-base);
		padding: var(--space-1) var(--space-3);
		border: 1px solid currentColor;
		border-radius: var(--radius-input);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.2s, border-color 0.2s;
	}

	.legal-tabs button.active {
		color: var(--text-primary);
		border-color: var(--text-primary);
	}
</style>
