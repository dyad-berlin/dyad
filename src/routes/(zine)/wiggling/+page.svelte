<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { episodeLinkLabel, principles, principlesStandfirst } from './content';

	// Reel sources: prefer PUBLIC_VIDEO_BASE_URL (sovereign host), else the public
	// videos bucket. In local dev the default Supabase URL is the LOCAL stack (no
	// videos bucket), so the reels wouldn't play; this base defaults to the public
	// bucket in every env. Files still live under the videos/voices/ prefix.
	const videoBase =
		env.PUBLIC_VIDEO_BASE_URL ??
		'https://iwdjpuyuznzukhowxjhk.supabase.co/storage/v1/object/public/videos';

	// The reels are self-hosted excerpts; the full episodes live on YouTube.
	// `episode` is an outbound link only — no embeds (consent-free constraint).
	// Kaspar stays archived per review — no kaspar.mp4 in the bucket to serve.
	// { src: `${videoBase}/voices/kaspar.mp4`, name: 'Kaspar' },
	const voices = [
		{
			src: `${videoBase}/voices/pauline.mp4`,
			name: 'Pauline',
			episode: 'https://www.youtube.com/watch?v=yaChHM7iIIo'
		},
		{
			src: `${videoBase}/voices/ali.mp4`,
			name: 'Ali',
			episode: 'https://www.youtube.com/watch?v=48hVieSCBbo'
		}
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
	<title>Wiggling · dyad.</title>
	<meta name="description" content="Wiggling is our conversation series with members of our community." />
</svelte:head>

<div class="page">
	<section id="conversations">
		<div class="page-intro">
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
					<figcaption>
						<span class="voice-name">{v.name}</span>
						<a class="episode-link" href={v.episode} target="_blank" rel="noopener">{episodeLinkLabel}</a>
					</figcaption>
				</figure>
			{/each}
		</div>
	</section>

	<section id="principles" class="principles">
		<p class="principles-standfirst">{principlesStandfirst}</p>

		<div class="prose principles-prose">
			{#each principles as principle}
				<div class="principle">
					<p class="principle-name">{principle.name}</p>
					<p>{principle.body}</p>
				</div>
			{/each}
		</div>
	</section>
</div>

<style>
	/* Shared zine page chrome lives in the (zine) +layout.svelte. */
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
		margin-top: 12px;
		display: flex;
		align-items: baseline;
		gap: 14px;
		flex-wrap: wrap;
	}

	.voice-name {
		font-size: var(--text-sm, 0.8rem);
		color: var(--zine-ink-muted, rgba(27, 28, 30, 0.35));
	}

	.episode-link {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.75rem;
		letter-spacing: 0.02em;
		color: var(--zine-ink-muted, rgba(27, 28, 30, 0.35));
		text-decoration: none;
		transition: color var(--duration-fast, 150ms);
	}
	.episode-link:hover { color: rgba(27, 28, 30, 0.7); }

	/* ── Principles ── */
	.principles {
		margin-top: 96px;
		padding-top: 64px;
		border-top: 1px solid rgba(27, 28, 30, 0.07);
	}

	.principles-standfirst {
		font-family: var(--font-serif);
		font-style: italic;
		font-weight: 300;
		font-size: clamp(1.3rem, 2.6vw, 1.9rem);
		line-height: 1.4;
		color: var(--zine-ink-strong, rgba(27, 28, 30, 0.9));
		max-width: 34ch;
		margin: 0 0 56px;
	}

	.principles-prose { max-width: 640px; }

	.principle { margin: 0 0 44px; }
	.principle:last-of-type { margin-bottom: 0; }

	/* Extra ancestor keeps this ahead of the layout's :global(.zine-main
	   .prose p) rules, which otherwise outweigh a lone class selector. */
	.principles-prose .principle-name {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 1.3rem;
		font-weight: 400;
		color: var(--zine-ink-strong, rgba(27, 28, 30, 0.9));
		margin: 0 0 10px;
		letter-spacing: -0.005em;
	}
</style>
