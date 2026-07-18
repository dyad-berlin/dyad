<!-- Shared zine footer — used by the (zine) layout and the /why page. -->
<script lang="ts">
	import { copy } from '$lib/copy';
	import { env } from '$env/dynamic/public';

	// Social/blog links render only when configured, following the repo's
	// env-gating pattern (cf. zine payment links). Set in the Pages env:
	// PUBLIC_BLOG_URL, PUBLIC_INSTAGRAM_URL, PUBLIC_YOUTUBE_URL.
	const blogUrl = (env.PUBLIC_BLOG_URL ?? '').trim();
	const instagramUrl = (env.PUBLIC_INSTAGRAM_URL ?? '').trim();
	const youtubeUrl = (env.PUBLIC_YOUTUBE_URL ?? '').trim();
</script>

<footer class="zine-footer">
	<!-- Inner wrapper mirrors the .page geometry (1080px + 48px side padding) so the
	     footer columns align with the page content grid; the top hairline stays full-bleed. -->
	<div class="footer-inner">
		<div class="footer-grid">
			<div class="footer-col">
				<p class="footer-col-head">Community</p>
				<a href="/join" class="footer-link">Become a member</a>
				<a href="/voices" class="footer-link">Voices</a>
				<span class="footer-link footer-soon">Forum (in the making)</span>
				{#if blogUrl}<a href={blogUrl} class="footer-link" target="_blank" rel="noopener">Blog</a>{/if}
				{#if instagramUrl}<a href={instagramUrl} class="footer-link" target="_blank" rel="noopener">Instagram</a>{/if}
				{#if youtubeUrl}<a href={youtubeUrl} class="footer-link" target="_blank" rel="noopener">YouTube</a>{/if}
			</div>
			<div class="footer-col">
				<p class="footer-col-head">Participatory Governance</p>
				<a href="/governance#documents" class="footer-link">Bylaws, agreements &amp; standards</a>
				<a href="/governance#practice" class="footer-link">How we practice</a>
				<a href="/governance#flow" class="footer-link">How a decision is made</a>
				<a href="/governance#who-decides" class="footer-link">Who decides what</a>
			</div>
			<div class="footer-col">
				<p class="footer-col-head">Dyad</p>
				<a href="/why" class="footer-link">About</a>
				<a href="/join" class="footer-link">Join</a>
				<a href="/impressum" class="footer-link">Impressum</a>
				<a href="/datenschutz" class="footer-link">Privacy</a>
			</div>
		</div>
		<p class="footer-colophon">{copy.landing.zineColophon}</p>
	</div>
</footer>

<style>
	.zine-footer {
		border-top: 1px solid rgba(240, 236, 230, 0.06);
	}

	/* Same box geometry as .zine-main .page: content and footer share columns. */
	.footer-inner {
		max-width: 1080px;
		margin: 0 auto;
		padding: 64px 48px 48px;
		box-sizing: border-box;
	}

	/* Footer content aligns to the same 1080px column as the page content
	   (see .zine-main .page in the (zine) layout). */
	.footer-inner {
		max-width: 1080px;
		margin: 0 auto;
	}

	.footer-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 40px;
		margin-bottom: 56px;
	}

	.footer-col-head {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 500;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgba(240, 236, 230, 0.5);
		margin: 0 0 16px;
	}

	.footer-link {
		display: block;
		font-family: var(--font-serif);
		font-size: 0.85rem;
		font-weight: 300;
		color: rgba(240, 236, 230, 0.4);
		text-decoration: none;
		margin-bottom: 10px;
		line-height: 1.4;
		transition: color 0.15s;
	}

	.footer-link:hover {
		color: rgba(240, 236, 230, 0.85);
	}

	/* Not yet a destination — quieter than the live links, not interactive. */
	.footer-soon {
		color: rgba(240, 236, 230, 0.25);
		cursor: default;
	}
	.footer-soon:hover {
		color: rgba(240, 236, 230, 0.25);
	}

	.footer-colophon {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		letter-spacing: 0.06em;
		color: rgba(240, 236, 230, 0.15);
		margin: 0;
		border-top: 1px solid rgba(240, 236, 230, 0.04);
		padding-top: 24px;
	}

	@media (max-width: 640px) {
		.footer-inner {
			padding: 40px 20px 40px;
		}
		.footer-grid {
			grid-template-columns: 1fr 1fr;
			gap: 32px;
		}
	}
</style>
