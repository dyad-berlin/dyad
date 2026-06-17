<script lang="ts">
	import ZineFooter from '$lib/components/ZineFooter.svelte';
	let { children } = $props();
</script>

<div class="zine-shell">
	<header class="zine-header">
		<a href="/" class="zine-wordmark">DYAD</a>
		<nav class="zine-nav">
			<a href="/steward-ownership" class="zine-nav-link">steward ownership</a>
			<a href="/governance" class="zine-nav-link">participatory governance</a>
			<a href="/community-care" class="zine-nav-link">trust, safety &amp; community care</a>
		</nav>
	</header>

	<main class="zine-main">
		{@render children()}
	</main>

	<ZineFooter />
</div>

<style>
	:global(body) { margin: 0; overflow: auto; }
	:global(html) { scroll-behavior: smooth; }

	.zine-shell {
		min-height: 100vh;
		background: #080808;
		color: rgba(240, 236, 230, 0.8);
		display: flex;
		flex-direction: column;
	}

	/* ── Header ── */
	.zine-header {
		position: sticky;
		top: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 48px;
		background: rgba(8, 8, 8, 0.92);
		backdrop-filter: blur(12px);
		border-bottom: 1px solid rgba(240, 236, 230, 0.05);
	}

	.zine-wordmark {
		font-family: 'SangBleu Sunrise', Georgia, 'Times New Roman', serif;
		font-size: 18px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: rgba(240, 236, 230, 0.9);
		text-decoration: none;
	}

	.zine-nav {
		display: flex;
		gap: 32px;
	}

	.zine-nav-link {
		font-family: 'SF Mono', 'Fira Code', Menlo, monospace;
		font-size: 0.65rem;
		letter-spacing: 0.06em;
		color: rgba(240, 236, 230, 0.35);
		text-decoration: none;
		transition: color 0.15s;
	}

	.zine-nav-link:hover {
		color: rgba(240, 236, 230, 0.85);
	}

	/* ── Main ── */
	.zine-main {
		flex: 1;
	}

	/* ── Mobile ── */
	@media (max-width: 640px) {
		.zine-header {
			padding: 16px 20px;
		}

		.zine-nav {
			display: none;
		}
	}
</style>
