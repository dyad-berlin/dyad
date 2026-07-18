<script lang="ts">
	import { storageUrl } from '$lib/utils/storage-url';

	const voices = [
		{ src: storageUrl('videos', 'voices/pauline.mp4'), name: 'Pauline' },
		{ src: storageUrl('videos', 'voices/kaspar.mp4'), name: 'Kaspar' },
		{ src: storageUrl('videos', 'voices/ali.mp4'), name: 'Ali' }
	];

	function toggle(e: Event) {
		const el = e.currentTarget as HTMLVideoElement;
		if (el.paused) {
			// Pause the others so two voices never talk over each other.
			for (const v of document.querySelectorAll('video')) if (v !== el) v.pause();
			el.muted = false;
			void el.play();
		} else {
			el.pause();
		}
	}
</script>

<svelte:head>
	<title>Community · dyad.</title>
	<meta name="description" content="The Wiggling Series." />
</svelte:head>

<div class="page">
	<div class="page-intro">
		<p class="section-label">Community</p>
		<h1 class="page-title">The Wiggling Series</h1>
		<p class="page-attr">One voice, one video. If you're looking for who dyad is for, how to join, or how membership works, that's now in <a href="/docs#process-joining">the documentation</a>.</p>
	</div>

	<div class="voices-grid">
		{#each voices as v}
			<figure class="voice-card">
				<!-- svelte-ignore a11y_media_has_caption -->
				<video src={v.src} preload="metadata" playsinline onclick={toggle}></video>
				<figcaption>{v.name}</figcaption>
			</figure>
		{/each}
	</div>
</div>

<style>
	/* Shared zine page chrome lives in the (zine) +layout.svelte. */
	.page-title {
		font-family: var(--font-serif);
		font-size: clamp(1.5rem, 3vw, 2.4rem);
		font-weight: 400;
		color: rgba(240, 236, 230, 0.88);
		margin: 0 0 16px;
		line-height: 1.3;
		letter-spacing: -0.01em;
		font-style: italic;
	}

	.page-attr a {
		color: rgba(240, 236, 230, 0.7);
		text-decoration: underline;
	}

	/* Card row: grid like every other zine card group — the grid defines
	   widths, no arbitrary max-widths (see dyad.berlin layout conventions). */
	.voices-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 28px;
		margin-top: 40px;
	}

	.voice-card { margin: 0; min-width: 0; }

	.voice-card video {
		display: block;
		width: 100%;
		aspect-ratio: 9 / 16;
		object-fit: cover;
		border-radius: 8px;
		background: #000;
		cursor: pointer;
	}

	.voice-card figcaption {
		font-size: var(--text-sm, 0.8rem);
		color: var(--zine-ink-muted, rgba(240, 236, 230, 0.35));
		margin-top: 12px;
	}

	@media (max-width: 760px) {
		.voices-grid { grid-template-columns: 1fr; }
	}
</style>
