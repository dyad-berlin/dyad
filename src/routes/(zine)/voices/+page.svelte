<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { copy } from '$lib/copy';

	// Voices — community members on film. Inherits the zine shell:
	// header, footer, and the .page frame (max-width + margins) come from the layout.
	// Reels live in the dedicated public `videos` bucket (web-optimized 720p);
	// PUBLIC_VIDEO_BASE_URL overrides the origin, mirroring PUBLIC_ASSET_BASE_URL.
	const videoBase =
		env.PUBLIC_VIDEO_BASE_URL ??
		'https://iwdjpuyuznzukhowxjhk.supabase.co/storage/v1/object/public/videos';

	const voices = [
		{ src: `${videoBase}/voices/pauline.mp4`, name: 'Pauline' },
		{ src: `${videoBase}/voices/kaspar.mp4`, name: 'Kaspar' },
		{ src: `${videoBase}/voices/ali.mp4`, name: 'Ali' }
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
	<title>{copy.voices.sectionLabel} · dyad.social</title>
	<meta name="description" content={copy.voices.metaDescription} />
</svelte:head>

<div class="page">
	<div class="page-intro">
		<p class="section-label">{copy.voices.sectionLabel}</p>
		<h1 class="page-title">{copy.voices.title}</h1>
		<p class="page-attr">{copy.voices.sub}</p>
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
	/* Card row: grid like every other zine card group — the grid defines
	   widths, no arbitrary max-widths (see dyad.berlin layout conventions). */
	.voices-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 28px;
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
