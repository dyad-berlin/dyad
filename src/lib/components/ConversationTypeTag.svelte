<script lang="ts">
	import { copy } from '$lib/copy';

	/** Quiet mono 1-on-1 / group indicator with a person(s) glyph. Shared by
	 *  ConversationCard's meta rows and the map preview card, so the two
	 *  surfaces can never drift apart. */
	let { type }: { type: '1on1' | 'group' } = $props();
</script>

<span class="type-tag" title={type === 'group' ? copy.discover.filterGroup : copy.discover.filterOneOnOne}>
	{#if type === 'group'}
		<svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
			<circle cx="7" cy="7.5" r="2.4" stroke="currentColor" stroke-width="1.6"/>
			<circle cx="13.5" cy="8.5" r="1.9" stroke="currentColor" stroke-width="1.6"/>
			<path d="M2.5 15.5c0-2.2 2-3.6 4.5-3.6s4.5 1.4 4.5 3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
			<path d="M13 12c2.1 0 3.9 1.2 3.9 3.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
		</svg>
	{:else}
		<svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
			<circle cx="10" cy="7" r="2.7" stroke="currentColor" stroke-width="1.6"/>
			<path d="M4 16c0-2.6 2.7-4.3 6-4.3s6 1.7 6 4.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
		</svg>
	{/if}
	<span>{type === 'group' ? copy.discover.filterGroup : copy.discover.filterOneOnOne}</span>
</span>

<style>
	.type-tag {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}
	.type-tag svg { flex-shrink: 0; }
</style>
