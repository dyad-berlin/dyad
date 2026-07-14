<!-- Shared zine footer — used by the (zine) layout and the /why page. -->
<script lang="ts">
	import { copy } from '$lib/copy';
</script>

<footer class="zine-footer">
	<div class="footer-inner">
		<div class="footer-grid">
			<div class="footer-col">
				<p class="footer-col-head">Community</p>
				<a href="/community" class="footer-link">Who dyad is for</a>
				<a href="/community#belonging" class="footer-link">Belonging &amp; membership</a>
				<a href="/community-care#approach" class="footer-link">Trust, safety &amp; care</a>
				<a href="/community-care#moderation" class="footer-link">Moderation</a>
			</div>
			<div class="footer-col">
				<p class="footer-col-head">Participatory Governance</p>
				<a href="/governance#practice" class="footer-link">How we practice</a>
				<a href="/governance#flow" class="footer-link">How a decision is made</a>
				<a href="/governance#who-decides" class="footer-link">Who decides what</a>
				<a href="/governance#documents" class="footer-link">The documents</a>
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
		padding: 64px 48px 48px;
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
		.zine-footer {
			padding: 40px 20px 40px;
		}
		.footer-grid {
			grid-template-columns: 1fr 1fr;
			gap: 32px;
		}
	}
</style>
