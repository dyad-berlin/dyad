<script lang="ts">
	import type { PageData } from './$types';
	import FloatingNav from '$lib/components/FloatingNav.svelte';
	import { copy } from '$lib/copy';

	let { data }: { data: PageData } = $props();

	// Featured feedback shows one at a time. A grid of them read as a wall of
	// praise; one quote at a time gives each its own moment, and the count
	// tells the visitor there are more without showing them all at once.
	let featuredIndex = $state(0);
	const featured = $derived(data.featuredFeedback);
	const currentFeedback = $derived(featured[featuredIndex]);

	// Wraps, so neither arrow is ever a dead control.
	function stepFeedback(delta: number) {
		featuredIndex = (featuredIndex + delta + featured.length) % featured.length;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function formatMonthYear(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	}
</script>

<div class="content">
	<div class="profile-header">
		{#if data.profile.display_name}
			<h1 class="display-name">{data.profile.display_name}</h1>
			<p class="username">@{data.profile.username}</p>
		{:else}
			<h1 class="display-name">@{data.profile.username}</h1>
		{/if}
		{#if data.completedCount > 0}
			<p class="completed-count">{copy.publicProfile.completedCount(data.completedCount)}</p>
		{/if}
	</div>

	{#if data.featuredFeedback.length > 0}
		<section class="featured-section">
			<div class="featured-head">
				<h2 class="section-title">{copy.publicProfile.featuredHeading}</h2>
				{#if featured.length > 1}
					<div class="feedback-nav">
						<button
							type="button"
							class="feedback-arrow"
							onclick={() => stepFeedback(-1)}
							aria-label={copy.publicProfile.featuredPrev}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
						</button>
						<span class="feedback-count"
							>{copy.publicProfile.featuredPosition(featuredIndex + 1, featured.length)}</span
						>
						<button
							type="button"
							class="feedback-arrow"
							onclick={() => stepFeedback(1)}
							aria-label={copy.publicProfile.featuredNext}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
						</button>
					</div>
				{/if}
			</div>

			<!-- aria-live so stepping through announces the new quote rather than
			     silently swapping it for anyone not watching the screen. -->
			<article class="feedback-card" aria-live="polite">
				<p class="feedback-date">{formatMonthYear(currentFeedback.created_at)}</p>
				{#if currentFeedback.quote}
					<p class="feedback-quote">{currentFeedback.quote}</p>
				{/if}
				{#if currentFeedback.tags.length > 0}
					<p class="feedback-tags">{currentFeedback.tags.join(' · ')}</p>
				{/if}
			</article>
		</section>
	{/if}

	{#if data.prompts.length === 0}
		<p class="empty">No conversations yet.</p>
	{:else}
		<div class="prompt-list">
			{#each data.prompts as prompt}
				<a href="/conversations/{prompt.id}" class="prompt-row">
					<div class="row-thumb">
						{#if prompt.cover_image_url}
							<img src={prompt.cover_image_url} alt="" class="thumb-img" />
						{:else}
							<div class="thumb-placeholder"></div>
						{/if}
					</div>
					<div class="row-body">
						<h3 class="row-title">{prompt.title ?? 'Untitled'}</h3>
						<span class="row-date">{formatDate(prompt.published_at)}</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>

<!-- Back lives in the nav pill (variant="detail"), like every detail surface. -->
<FloatingNav variant="detail" attentionCount={data.attentionCount ?? 0} />

<style>
	.content {
		width: 100%;
		max-width: var(--content-standard);
		padding-bottom: var(--nav-clearance);
	}

	.profile-header { margin-bottom: var(--space-8); }
	.display-name { font-size: var(--text-2xl); font-weight: normal; margin: 0 0 var(--space-1); }
	.username { font-family: var(--font-mono); font-size: var(--text-sm); color: var(--text-muted); margin: 0; }
	.completed-count { font-size: var(--text-sm); color: var(--text-muted); margin: var(--space-2) 0 0; }

	/* Featured feedback — borderless columns, review-listing style: date on
	   top, quote as plain text, tags as one muted line. Anonymous either way —
	   the person featuring this chose to show it, no reviewer identity
	   travels with the snapshot. */
	.featured-section { margin-bottom: var(--space-8); }

	/* The heading is heavier than the shared .section-title so the section
	   label reads as chrome and the quote below reads as the content. They
	   were the same weight, which flattened the two together. Overridden
	   here rather than in shared.css, which meetings and feedback also use. */
	.featured-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-4);
	}
	.featured-head .section-title {
		font-weight: 600;
		margin-bottom: var(--space-3);
	}

	.feedback-nav {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-shrink: 0;
	}

	.feedback-count {
		font-size: var(--text-sm);
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.feedback-arrow {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		transition: color 0.15s, background 0.15s;
	}
	.feedback-arrow:hover { color: var(--text-primary); background: var(--border-subtle); }
	.feedback-arrow svg {
		width: 17px;
		height: 17px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* min-height holds the block steady while stepping: quotes differ in
	   length, and without it the page jumps under the pointer as you click
	   through, moving the arrow you just pressed. */
	.feedback-card {
		min-width: 0;
		max-width: 46ch;
		min-height: 7.5rem;
	}

	.feedback-date {
		font-size: var(--text-sm);
		color: var(--text-muted);
		margin: 0 0 var(--space-2);
	}

	.feedback-quote {
		font-size: var(--text-md);
		line-height: var(--leading-relaxed);
		color: var(--text-primary);
		margin: 0;
	}

	.feedback-tags {
		font-size: var(--text-sm);
		color: var(--text-muted);
		margin: var(--space-2) 0 0;
	}

	.empty { color: var(--text-muted); font-size: var(--text-base); }

	.prompt-list { display: flex; flex-direction: column; }

	.prompt-row {
		display: flex;
		gap: var(--space-4);
		padding: var(--space-4) 0;
		border-bottom: 1px solid var(--border-link);
		text-decoration: none;
		color: inherit;
		transition: opacity 0.15s;
	}
	.prompt-row:last-child { border-bottom: none; }
	.prompt-row:hover { opacity: var(--opacity-hover-card); }

	.row-thumb {
		flex-shrink: 0;
		width: 72px;
		height: 72px;
		border-radius: var(--radius-input);
		overflow: hidden;
		position: relative;
	}
	.thumb-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
	.thumb-placeholder { position: absolute; inset: 0; background: var(--bg-control); border: 1px solid var(--border-link); border-radius: inherit; }

	.row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: var(--space-1); }
	.row-title { margin: 0; font-size: var(--text-md); font-weight: 500; }
	.row-date { font-size: var(--text-sm); color: var(--text-muted); }
</style>
