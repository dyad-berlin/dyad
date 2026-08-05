<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { storageUrl } from '$lib/utils/storage-url';

	// Reel sources: prefer PUBLIC_VIDEO_BASE_URL (sovereign host), else the public
	// videos bucket. In local dev the default Supabase URL is the LOCAL stack (no
	// videos bucket), so the reels wouldn't play; this base defaults to the public
	// bucket in every env. Files still live under the videos/voices/ prefix.
	const videoBase =
		env.PUBLIC_VIDEO_BASE_URL ??
		'https://iwdjpuyuznzukhowxjhk.supabase.co/storage/v1/object/public/videos';

	// The reel plays here, self-hosted. The full episode is a plain outbound
	// link, NOT an embed: an iframe (even youtube-nocookie.com) contacts Google
	// on page load and discloses every visitor's IP before anyone presses play,
	// which is the drift CLAUDE.md § Data Collection and Values rules out. A
	// link makes the visitor's relationship with YouTube their own — the same
	// move as pointing newsletter signups at Substack rather than collecting
	// addresses here.
	//
	// Once compressed masters are in the videos bucket under episodes/, the full
	// conversation can play on the page as a second <video> and the outbound
	// link can go. Kaspar stays archived — no kaspar.mp4 in the bucket to serve.
	// { src: `${videoBase}/voices/kaspar.mp4`, name: 'Kaspar' },
	// Poster frames live in the 'newsletter assets' bucket, not videos/: that
	// one accepts video mime types only. Served as webp — the source PNGs were
	// 1.8-3.2MB each and a poster loads before anyone presses play, so three of
	// them would have cost ~8MB on arrival. These are 41-69kB.
	//
	// Built with storageUrl() rather than a hand-written base: it encodes the
	// space in the bucket name and resolves the host through
	// PUBLIC_STORAGE_BASE_URL, so these follow the assets everywhere else on
	// the site if they ever move to a sovereign host. A literal base string
	// would have kept pointing at Supabase after such a move, and shown up
	// only as three broken thumbnails.
	const poster = (name: string) => storageUrl('newsletter assets', `voices/${name}.webp`);

	const voices = [
		{
			src: `${videoBase}/voices/pauline.mp4`,
			poster: poster('pauline'),
			name: 'Pauline Gwet',
			episode: 'https://www.youtube.com/watch?v=yaChHM7iIIo'
		},
		{
			src: `${videoBase}/voices/ali.mp4`,
			poster: poster('ali'),
			name: 'Ali Nezamolmaleki',
			episode: 'https://www.youtube.com/watch?v=48hVieSCBbo'
		},
		{
			src: `${videoBase}/voices/sude.mp4`,
			poster: poster('sude'),
			name: 'Sude Elverdi',
			episode: 'https://www.youtube.com/watch?v=bqX0Mx_YmfY'
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

	<section>
		<div class="page-intro">
			<h1 class="page-title">Wiggling</h1>
			<p class="page-description">Life rarely moves in straight lines, and neither do good conversations. Inspired by Alan Watts, Wiggling is our conversation series with members of our community, making room for thoughts still forming, lives in motion, and what emerges between us.</p>
		</div>

		<div class="videos">
			{#each voices as v}
				<figure class="video-card">
					<div class="video-frame">
						<!-- svelte-ignore a11y_media_has_caption -->
						<!-- A real poster means preload="none": no part of the reel is fetched
						     until someone presses play. Replaces the #t=0.1 first-frame trick,
						     which only existed because there was no thumbnail to show. -->
						<video src={v.src} poster={v.poster} preload="none" playsinline onclick={toggle}
						></video>
					</div>
					<figcaption>
						<span class="video-name">{v.name}</span>
						<a class="video-link" href={v.episode} target="_blank" rel="noopener noreferrer"
							>Watch the full conversation on YouTube ↗</a
						>
					</figcaption>
				</figure>
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

	/* ── Video cards — floating media, On Being style: no border, a soft warm
	   shadow doing all the work of separating the card from the paper it
	   sits on.
	   Columns are capped rather than 1fr: the reels are portrait (9/16), so a
	   half-page column would render them absurdly tall on a wide viewport.
	   The cards share a baseline. An earlier revision dropped the second one
	   64px as a deliberate stagger, which read as a broken grid rather than an
	   editorial one once the frames went from 16/9 to portrait — at that
	   height the offset looks like a layout bug. ── */
	.videos {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 300px));
		gap: 64px 40px;
		margin-top: 64px;
		align-items: start;
	}

	.video-card { margin: 0; min-width: 0; }

	.video-frame {
		position: relative;
		aspect-ratio: 9 / 16;
		border-radius: 16px;
		overflow: hidden;
		background: #000;
		box-shadow:
			0 50px 90px -35px rgba(43, 36, 26, 0.28),
			0 14px 30px -12px rgba(43, 36, 26, 0.14);
		transition: transform var(--duration-slow, 400ms) var(--ease-ink, ease),
		            box-shadow var(--duration-slow, 400ms) var(--ease-ink, ease);
	}
	.video-card:hover .video-frame {
		transform: translateY(-4px);
		box-shadow:
			0 60px 110px -35px rgba(43, 36, 26, 0.32),
			0 18px 36px -12px rgba(43, 36, 26, 0.16);
	}

	.video-frame video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		cursor: pointer;
	}

	.video-card figcaption {
		margin-top: 22px;
		display: flex;
		align-items: baseline;
		gap: 14px;
		flex-wrap: wrap;
	}

	.video-name {
		font-family: var(--font-serif);
		font-size: 1.05rem;
		color: var(--zine-ink-strong, rgba(27, 28, 30, 0.9));
	}

	.video-link {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.75rem;
		letter-spacing: 0.02em;
		color: var(--zine-ink-muted, rgba(27, 28, 30, 0.35));
		text-decoration: none;
		transition: color var(--duration-fast, 150ms);
	}
	.video-link:hover { color: rgba(27, 28, 30, 0.7); }

	/* Three across needs ~1000px with the 40px gutters; below that two, then
	   one. Wide query first: both match on a phone, and at equal specificity
	   the later rule wins. */
	@media (max-width: 1040px) {
		.videos { grid-template-columns: repeat(2, minmax(0, 300px)); }
	}

	@media (max-width: 640px) {
		.videos { grid-template-columns: minmax(0, 300px); gap: 40px; }
	}

	@media (prefers-reduced-motion: reduce) {
		.video-frame { transition: none; }
		.video-card:hover .video-frame { transform: none; }
	}
</style>
