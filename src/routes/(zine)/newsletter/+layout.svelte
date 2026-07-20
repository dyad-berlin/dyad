<script lang="ts">
	let { children } = $props();
</script>

<!-- Unfolding reads as paper against the site's moss-black shell: an
     opaque, warm off-white surface with its own grain, laid over the dark
     ambient background for exactly this subtree. Header and footer (shared
     zine chrome) stay dark; only the reading surface changes. -->
<div class="paper">
	{@render children()}
</div>

<style>
	.paper {
		--paper-bg: #faf8f3;
		--paper-ink: #1b1c1e;
		--paper-ink-soft: #5c5d61;
		--paper-ink-faint: #8c8d90;
		--paper-line: rgba(20, 20, 20, 0.1);
		--paper-accent: #4a5d3f;

		position: relative;
		background: var(--paper-bg);
		color: var(--paper-ink);
		min-height: 60vh;
	}

	.paper::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0.05;
		mix-blend-mode: multiply;
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='5'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
	}

	.paper::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0.06;
		mix-blend-mode: multiply;
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='900' height='900'><filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.006' numOctaves='4' seed='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='900' height='900' filter='url(%23p)'/></svg>");
		background-size: 900px 900px;
	}
</style>
