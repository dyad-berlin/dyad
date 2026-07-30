<script lang="ts">
	// Reverted to YouTube embeds — the full episodes only exist on YouTube
	// right now (no self-hosted master uploaded yet), so a native <video> had
	// nothing to point at. youtube-nocookie.com is YouTube's privacy-enhanced
	// embed domain: fewer identifying cookies than youtube.com, same player.
	// Once real files are compressed + uploaded to Supabase Storage, swap
	// this back to a plain <video src=...> (see git history on this file for
	// that version) to drop the YouTube chrome.
	const videos = [
		{
			id: 'yaChHM7iIIo',
			name: 'Pauline Gwet',
			href: 'https://www.youtube.com/watch?v=yaChHM7iIIo'
		},
		{
			id: '48hVieSCBbo',
			name: 'Ali Nezamolmaleki',
			href: 'https://www.youtube.com/watch?v=48hVieSCBbo'
		}
	];

	// Photo slots reference static files that don't exist in the repo yet —
	// drop the real images into static/images/wiggling/ using these exact
	// names and they'll render; until then the onerror handler swaps in a
	// muted placeholder instead of a broken-image icon.
	function onImgError(e: Event) {
		(e.currentTarget as HTMLElement).closest('.photo-slot')?.classList.add('missing');
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

		<div class="videos">
			{#each videos as v}
				<figure class="video-card">
					<div class="video-frame">
						<iframe
							src={`https://www.youtube-nocookie.com/embed/${v.id}`}
							title={v.name}
							loading="lazy"
							allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
							allowfullscreen
						></iframe>
					</div>
					<figcaption>
						<span class="video-name">{v.name}</span>
						<a class="video-link" href={v.href} target="_blank" rel="noopener">Watch on YouTube ↗</a>
					</figcaption>
				</figure>
			{/each}
		</div>
	</section>

	<section id="principles" class="principles">
		<p class="principles-standfirst">What holds a conversation like this together, before it even begins — the same practice we've carried for three years, at Brafe Space and here.</p>

		<div class="prose principles-prose">
			<div class="principle">
				<p class="principle-name">Complexity &amp; Ambiguity</p>
				<p>We envision a world where we all can live safe, fulfilled, and free. There is not one answer or path to it. We have to navigate the complexity and ambiguity of the simultaneity of various (contradicting) possibilities.</p>
			</div>

			<div class="photo-row cols-2">
				<figure class="photo-slot">
					<img src="/images/wiggling/brafe-camp-2024-236.jpg" alt="Brafe Space Camp, 2024" loading="lazy" onerror={onImgError} />
				</figure>
				<figure class="photo-slot">
					<img src="/images/wiggling/brafe-camp-2024-220.jpg" alt="Brafe Space Camp, 2024" loading="lazy" onerror={onImgError} />
				</figure>
			</div>

			<div class="principle">
				<p class="principle-name">No Outcome</p>
				<p>We do not manifest nor do we pursue a certain outcome. We want to create space in which the manifestors of the future gain support, connection, perspectives, and evolve.</p>
			</div>

			<div class="principle">
				<p class="principle-name">Unfolding</p>
				<p>We work with the hypothesis that change comes from within and have chosen a path of inner development — to be able to connect more to ourselves, each other, and our environment. If you want to be part of it, you have to be willing to explore your inner self and face your blank spots.</p>
			</div>

			<div class="principle">
				<p class="principle-name">Empathy &amp; Compassion</p>
				<p>This process might bring us to the edges of our meaning-making and question our identity. We are aware this is painful and therefore face this process with empathy and compassion rather than intellectual rigidity.</p>
			</div>

			<div class="principle">
				<p class="principle-name">Subjective Experience</p>
				<p>The focus of our space will be on the process of sharing subjective experiences of how we individually perceive and feel the world. In this we avoid sharing and judging opinions or detaching from ourselves when speaking about topics.</p>
			</div>

			<div class="photo-row cols-2">
				<figure class="photo-slot">
					<img src="/images/wiggling/brafe-camp-2022-screenshot.png" alt="Brafe Space, 2022" loading="lazy" onerror={onImgError} />
				</figure>
				<figure class="photo-slot">
					<img src="/images/wiggling/brafe-camp-2024-112.jpg" alt="Brafe Space Camp, 2024" loading="lazy" onerror={onImgError} />
				</figure>
			</div>

			<div class="principle">
				<p class="principle-name">Bravery</p>
				<p>Still, we will constantly try to find a balance between creating a safe enough environment, and at the same time being brave enough in the stretch, that we create through our shared diverse perspectives.</p>
			</div>

			<div class="principle">
				<p class="principle-name">Lightheartedness</p>
				<p>While an emergent process like this might feel hard and heavy at times, given the depths, relevance, and felt urgency of inner and outer topics, we strive for a loving experience, in which we can acknowledge our limitations and do not take ourselves too seriously.</p>
			</div>

			<div class="principle">
				<p class="principle-name">Multiperspectivity</p>
				<p>We are not promoting one or the other world view but giving different perspectives room is part of the journey. We commit to being truly diverse in the viewpoints that we share over time.</p>
			</div>

			<div class="principle">
				<p class="principle-name">Safe-enoughness</p>
				<p>We want to build a relational space for a heterogeneous group to connect deeply. This requires all of us to nurture a space in which everybody finds the confidence and safety to share, and to be honest with their own boundaries. For such a diverse community this includes the awareness and acknowledgement of intersectional experiences of relative privilege and discrimination.</p>
			</div>

			<div class="photo-row cols-1">
				<figure class="photo-slot">
					<img src="/images/wiggling/brafe-camp-2024-093.jpg" alt="Brafe Space Camp, 2024" loading="lazy" onerror={onImgError} />
				</figure>
			</div>
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
	   sits on. Second card sits lower — a small, deliberate stagger, echoing
	   the page's own "life doesn't move in straight lines" line. ── */
	.videos {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 64px 40px;
		margin-top: 64px;
	}

	.video-card { margin: 0; min-width: 0; }
	.video-card:nth-child(2) { margin-top: 64px; }

	.video-frame {
		position: relative;
		aspect-ratio: 16 / 9;
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

	.video-frame iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
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

	.principle-name {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 1.3rem;
		font-weight: 400;
		color: var(--zine-ink-strong, rgba(27, 28, 30, 0.9));
		margin: 0 0 10px;
		letter-spacing: -0.005em;
	}

	/* Photos break the reading column's rhythm — wider than the 640px prose
	   measure, same treatment the community-care photo grids use elsewhere:
	   a plain rectangle, no shadow (unlike the videos above, these sit flush
	   with the page rather than "floating" — texture, not spectacle). */
	.photo-row {
		display: grid;
		gap: 20px;
		margin: 48px 0;
		width: min(100%, 860px);
		margin-left: calc(50% - min(100%, 860px) / 2);
	}
	.photo-row.cols-2 { grid-template-columns: 1fr 1fr; }
	.photo-row.cols-1 { grid-template-columns: 1fr; width: min(100%, 560px); margin-left: calc(50% - min(100%, 560px) / 2); }

	.photo-slot {
		position: relative;
		aspect-ratio: 4 / 3;
		border-radius: 14px;
		overflow: hidden;
		margin: 0;
		background: linear-gradient(155deg, rgba(27, 28, 30, 0.05), rgba(27, 28, 30, 0.09));
	}
	.photo-slot img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.photo-slot.missing img { display: none; }
	.photo-slot.missing::after {
		content: 'Photo pending';
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(27, 28, 30, 0.25);
	}

	@media (max-width: 640px) {
		.videos { grid-template-columns: 1fr; gap: 40px; }
		.video-card:nth-child(2) { margin-top: 0; }
		.photo-row.cols-2 { grid-template-columns: 1fr; }
	}

	@media (prefers-reduced-motion: reduce) {
		.video-frame { transition: none; }
		.video-card:hover .video-frame { transform: none; }
	}
</style>
