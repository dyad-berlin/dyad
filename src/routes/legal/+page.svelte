<script lang="ts">
	import ImpressumContent from '$lib/components/legal/ImpressumContent.svelte';
	import AgbContent from '$lib/components/legal/AgbContent.svelte';
	import DatenschutzContent from '$lib/components/legal/DatenschutzContent.svelte';
</script>

<svelte:head>
	<title>legal · dyad. cultivating a culture of conversation</title>
</svelte:head>

<main class="legal-page">
	<a href="/" class="back-link">
		<svg width="16" height="16" viewBox="0 0 20 20" fill="none" style="vertical-align:middle;margin-right:4px"><path d="M12 15l-5-5 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
		dyad.berlin
	</a>

	<h1 class="legal-title">Legal</h1>

	<nav class="legal-jump" aria-label="Jump to document">
		<a href="#impressum">Impressum</a>
		<a href="#agb">AGB</a>
		<a href="#datenschutz">Privacy</a>
	</nav>

	<section id="impressum" class="legal-section">
		<ImpressumContent />
	</section>

	<hr class="legal-divider" />

	<section id="agb" class="legal-section">
		<AgbContent />
	</section>

	<hr class="legal-divider" />

	<section id="datenschutz" class="legal-section">
		<DatenschutzContent />
	</section>
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

	.legal-jump {
		display: flex;
		gap: var(--space-4);
		margin-bottom: var(--space-10);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border-subtle);
	}

	.legal-jump a {
		font-size: var(--text-sm);
		color: var(--text-muted);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.legal-jump a:hover {
		color: var(--text-primary);
	}

	.legal-section {
		scroll-margin-top: var(--space-8);
	}

	.legal-divider {
		border: none;
		border-top: 1px solid var(--border-subtle);
		margin: var(--space-10) 0;
	}
</style>
