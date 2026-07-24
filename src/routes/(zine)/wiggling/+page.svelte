<script lang="ts">
	import { env } from '$env/dynamic/public';

	// Reel sources: prefer PUBLIC_VIDEO_BASE_URL (sovereign host), else the public
	// videos bucket. In local dev the default Supabase URL is the LOCAL stack (no
	// videos bucket), so the reels wouldn't play; this base defaults to the public
	// bucket in every env. Files still live under the videos/voices/ prefix.
	const videoBase =
		env.PUBLIC_VIDEO_BASE_URL ??
		'https://iwdjpuyuznzukhowxjhk.supabase.co/storage/v1/object/public/videos';

	// Kaspar and Ali archived per review — Pauline only, for now.
	// { src: `${videoBase}/voices/kaspar.mp4`, name: 'Kaspar' },
	// { src: `${videoBase}/voices/ali.mp4`, name: 'Ali' }
	const voices = [{ src: `${videoBase}/voices/pauline.mp4`, name: 'Pauline' }];

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
	<title>Wiggling · dyad.</title>
	<meta name="description" content="Wiggling is our conversation series with members of our community." />
</svelte:head>

<div class="page">
	<div class="page-intro">
		<p class="section-label">Conversations</p>
		<h1 class="page-title">Wiggling</h1>
		<p class="page-description">Life rarely moves in straight lines, and neither do good conversations. Inspired by Alan Watts, Wiggling is our conversation series with members of our community, making room for thoughts still forming, lives in motion, and what emerges between us.</p>
	</div>

	<div class="voices-grid">
		{#each voices as v}
			<figure class="voice-card">
				<!-- svelte-ignore a11y_media_has_caption -->
				<!-- #t=0.1 makes the browser render a real frame as the poster; without
				     it, preload="metadata" leaves the element black until playback. -->
				<video src={`${v.src}#t=0.1`} preload="metadata" playsinline onclick={toggle}></video>
				<figcaption>{v.name}</figcaption>
			</figure>
		{/each}
	</div>
</div>

<style>
	/* Shared zine page chrome lives in the (zine) +layout.svelte. Section
	   label + description mirror /newsletter's archive-head treatment
	   (sans-serif uppercase label, italic serif standfirst, wide column). */
	.section-label {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--zine-ink-muted, rgba(27, 28, 30, 0.35));
		margin: 0 0 22px;
	}

	.page-title {
		font-family: var(--font-serif);
		font-size: clamp(1.5rem, 3vw, 2.4rem);
		font-weight: 400;
		color: var(--zine-ink-strong, rgba(27, 28, 30, 0.9));
		margin: 0 0 16px;
		line-height: 1.3;
		letter-spacing: -0.01em;
		font-style: italic;
	}

	.page-description {
		font-family: var(--font-serif);
		font-size: 0.95rem;
		font-weight: 400;
		font-style: italic;
		line-height: 1.5;
		color: var(--zine-ink, rgba(27, 28, 30, 0.8));
		margin: 0;
		max-width: 80ch;
		letter-spacing: -0.005em;
	}

	/* Card row: grid like every other zine card group — the grid defines
	   widths, no arbitrary max-widths (see dyad.berlin layout conventions).
	   One voice today (Kaspar/Ali archived); a single narrow column reads
	   better than a lone card stretched across three. */
	.voices-grid {
		display: grid;
		grid-template-columns: minmax(0, 280px);
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
		color: var(--zine-ink-muted, rgba(27, 28, 30, 0.35));
		margin-top: 12px;
	}
</style>
