<script lang="ts">
	import type { PageData } from './$types';
	import { copy } from '$lib/copy';
	import FeatureFeedbackToggle from '$lib/components/FeatureFeedbackToggle.svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{copy.feedbackArea.title} · dyad.social</title>
</svelte:head>

<div class="content">
	<a href="/profile" class="back-link">{copy.feedbackArea.backToProfile}</a>
	<h1 class="page-title">{copy.feedbackArea.title}</h1>

	{#if data.receivedFeedback.length > 0}
		<section class="events">
			<p class="section-label">{copy.preferences.feedbackHeading}</p>
			{#each data.receivedFeedback as fb (fb.signalId)}
				<div class="feedback-item">
					<FeatureFeedbackToggle signalId={fb.signalId} initialVisible={fb.visible} compact>
						<span class="feedback-quote-compact">
							{#if fb.quote}“{fb.quote}”{/if}
							{#if fb.tags.length > 0}<em class="feedback-tags-compact">{fb.tags.join(', ')}</em>{/if}
						</span>
					</FeatureFeedbackToggle>
				</div>
			{/each}
			<p class="prefs-note">{copy.preferences.feedbackHint}</p>
		</section>
	{:else}
		<p class="prefs-note">{copy.feedbackArea.empty}</p>
	{/if}
</div>

<style>
	.content {
		width: 100%;
		max-width: var(--content-standard);
		padding-bottom: var(--nav-clearance);
	}

	.back-link {
		display: inline-block;
		margin-top: var(--space-6);
		font-size: var(--text-sm);
		color: var(--text-muted);
		text-decoration: underline;
		text-decoration-color: transparent;
	}
	.back-link:hover {
		color: var(--text-primary);
	}

	.page-title {
		font-size: var(--text-xl);
		font-weight: 500;
		margin: var(--space-4) 0 var(--space-6);
	}

	.prefs-note {
		margin: var(--space-4) 0 0;
		max-width: 360px;
		font-size: var(--text-sm);
		color: var(--text-muted);
		line-height: var(--leading-relaxed);
	}

	.events {
		margin-top: var(--space-2);
	}

	.section-label {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin: 0 0 var(--space-3);
	}

	.feedback-item + .feedback-item {
		margin-top: var(--space-3);
	}

	.feedback-quote-compact {
		font-size: var(--text-sm);
		color: var(--text-primary);
		line-height: var(--leading-relaxed);
	}

	.feedback-tags-compact {
		display: block;
		font-style: normal;
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin-top: 2px;
	}
</style>
