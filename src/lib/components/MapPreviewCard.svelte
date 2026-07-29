<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { PromptSummary, TimeSlot } from '$lib/domain/types';
	import { formatShortDate, formatSlotTimeRange } from '$lib/utils/dates';
	import { copy } from '$lib/copy';

	// Desktop preview card — "one preview, two doors, one place" (design note
	// rev 3.2). Floats in a constant frame over the map pane; opened by a pin
	// click or a sidebar card click. The BottomSheet keeps this role on mobile,
	// where there is no map+list surface. Contract highlights:
	//  - constant frame: switching conversations (cluster chips) or hopping
	//    times swaps the body inside an unmoving container;
	//  - fixed-height header strip: the cluster switcher appearing/vanishing
	//    never shifts the body;
	//  - times render in chronological order; the slot(s) this card corresponds
	//    to are subtly highlighted in place, the rest fold behind "n more
	//    times" — and expanded rows are doors to THEIR pins (onHopSlot).
	export interface PreviewItem {
		prompt: PromptSummary;
		/** The slots at the door pin for this prompt (highlight targets). */
		slots?: TimeSlot[];
	}

	interface Props {
		items: PreviewItem[];
		activePromptId: string;
		/** Slot ids the card currently corresponds to (the active pin's slots,
		 *  or the single hopped slot). */
		activeSlotIds: string[];
		onSwitchConvo: (promptId: string) => void;
		onHopSlot: (slot: TimeSlot) => void;
		onClose: () => void;
		/** Whether a slot has a pin on the current map (has coordinates and
		 *  passes the active filters). Slots without one render as plain rows —
		 *  a time-hop door must never point at a pin that doesn't exist. */
		isPinnable?: (slot: TimeSlot) => boolean;
		/** The active pin's container point within the map pane. The card
		 *  anchors beside it — right of the pin, flipping left at the edge —
		 *  and rides along as the map pans. Null falls back to the top-left. */
		anchor?: { x: number; y: number } | null;
	}

	let { items, activePromptId, activeSlotIds, onSwitchConvo, onHopSlot, onClose, isPinnable, anchor = null }: Props = $props();

	// ── Anchored positioning ────────────────────────────────────────────
	// Content-proportioned card next to its pin. Measured sizes (own + the
	// map pane's) feed a clamped placement: prefer the pin's right, flip to
	// the left when the right edge can't fit it, keep clear of the pane's
	// margins and the FloatingNav zone at the bottom.
	const PIN_CLEARANCE = 40; // pin radius (22) + breathing room
	const EDGE = 12;
	const NAV_ZONE = 104; // --nav-clearance (92px) + breathing room
	let cardEl: HTMLDivElement | undefined = $state();
	let cardW = $state(0);
	let cardH = $state(0);
	const position = $derived.by(() => {
		// offsetParent, not parentElement: the card mounts behind a
		// display:contents host, whose client box is 0×0 — the positioned
		// ancestor (the map pane) is the box the math needs.
		const pane = cardEl?.offsetParent as HTMLElement | null | undefined;
		if (!anchor || !pane) return { left: EDGE, top: EDGE };
		const paneW = pane.clientWidth;
		const paneH = pane.clientHeight;
		let left = anchor.x + PIN_CLEARANCE;
		if (left + cardW + EDGE > paneW) left = anchor.x - PIN_CLEARANCE - cardW;
		left = Math.max(EDGE, Math.min(left, paneW - cardW - EDGE));
		let top = anchor.y - Math.min(cardH / 3, 96);
		top = Math.max(EDGE, Math.min(top, paneH - NAV_ZONE - cardH));
		return { left, top: Math.max(EDGE, top) };
	});

	const active = $derived(items.find((i) => i.prompt.id === activePromptId) ?? items[0]);
	const slots = $derived(active?.prompt.available_slots ?? []);
	const activeIds = $derived(new Set(activeSlotIds));

	let timesExpanded = $state(false);
	// Fold the times again when the previewed conversation changes; keep the
	// expansion when hopping times within one conversation.
	let lastPromptId = $state<string | null>(null);
	$effect(() => {
		if (active && active.prompt.id !== lastPromptId) {
			lastPromptId = active.prompt.id;
			timesExpanded = false;
		}
	});

	const foldedCount = $derived(slots.filter((s) => !activeIds.has(s.id)).length);

	function areaOf(slot: TimeSlot): string {
		return slot.general_area ?? '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
	});
	onDestroy(() => {
		document.removeEventListener('keydown', handleKeydown);
	});
</script>

{#if active}
	<div
		bind:this={cardEl}
		bind:clientWidth={cardW}
		bind:clientHeight={cardH}
		class="preview-card"
		style="left: {position.left}px; top: {position.top}px;"
		role="dialog"
		aria-label={active.prompt.title ?? copy.common.untitled}
	>
		<button type="button" class="preview-close" onclick={onClose} aria-label={copy.common.close}>&times;</button>
		{#if items.length > 1}
			<!-- Co-located conversations on one pin: a compact switcher,
			     never a second list. -->
			<div class="cluster" role="tablist">
				{#each items as item (item.prompt.id)}
					<button
						type="button"
						class="cluster-chip"
						class:active={item.prompt.id === active.prompt.id}
						role="tab"
						aria-selected={item.prompt.id === active.prompt.id}
						onclick={() => onSwitchConvo(item.prompt.id)}
					>{item.prompt.title ?? copy.common.untitled}</button>
				{/each}
			</div>
		{/if}

		<div class="preview-body">
			{#if active.prompt.cover_image_url}
				<img class="preview-cover" src={active.prompt.cover_image_url} alt="" />
			{:else}
				<div class="preview-cover preview-cover--placeholder">{(active.prompt.title ?? '?')[0]}</div>
			{/if}
			<h3 class="preview-title">{active.prompt.title ?? copy.common.untitled}</h3>
			{#if active.prompt.author_username}
				<p class="preview-byline">@{active.prompt.author_username}</p>
			{/if}
			<div class="preview-tags">
				<span class="tag">{active.prompt.capacity === 1 ? copy.discover.filterOneOnOne : copy.discover.filterGroup}</span>
			</div>
			{#if active.prompt.body_snippet}
				<p class="preview-snippet">{active.prompt.body_snippet}</p>
			{/if}

			<div class="preview-times">
				{#each slots as slot (slot.id)}
					{#if activeIds.has(slot.id)}
						<div class="slot-row current">
							<span>{formatShortDate(slot.start_time)} · {formatSlotTimeRange(slot.start_time, slot.duration_minutes)}</span>
							<span class="slot-area">{areaOf(slot)}</span>
						</div>
					{:else if timesExpanded && (isPinnable?.(slot) ?? true)}
						<!-- A door to ITS pin: selects the slot, rings and pans to
						     its pin — same logic as clicking that pin. -->
						<button type="button" class="slot-row slot-jump" onclick={() => onHopSlot(slot)}>
							<span>{formatShortDate(slot.start_time)} · {formatSlotTimeRange(slot.start_time, slot.duration_minutes)}</span>
							<span class="slot-area">{areaOf(slot)}</span>
						</button>
					{:else if timesExpanded}
						<!-- No pin for this time on the current map (filtered out or
						     no coordinates) — informational row, not a door. -->
						<div class="slot-row">
							<span>{formatShortDate(slot.start_time)} · {formatSlotTimeRange(slot.start_time, slot.duration_minutes)}</span>
							<span class="slot-area">{areaOf(slot)}</span>
						</div>
					{/if}
				{/each}
				{#if !timesExpanded && foldedCount > 0}
					<button type="button" class="more-times" onclick={() => (timesExpanded = true)}>
						{copy.discover.previewMoreTimes(foldedCount)}
					</button>
				{/if}
			</div>

			<a class="preview-cta" href={`/conversations/${active.prompt.id}`}>{copy.discover.previewOpenCta}</a>
		</div>
	</div>
{/if}

<style>
	.preview-card {
		position: absolute;
		width: 20rem;
		/* Content-proportioned, anchored beside its pin (left/top from the
		   placement math). Capped so it never runs under the FloatingNav
		   zone; the body scrolls when content exceeds the cap. */
		max-height: calc(100% - var(--nav-clearance) - var(--space-4));
		display: flex;
		flex-direction: column;
		background: var(--bg-canvas);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-card);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.22);
		z-index: 500; /* over the map panes; under the nav (800) and sheets (900) */
		padding-top: var(--space-3);
	}
	.preview-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0 var(--space-4) var(--space-4);
	}
	.preview-close {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		font-size: var(--text-xl);
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		line-height: 1;
		padding: var(--space-1);
		z-index: 1;
	}
	.preview-close:hover { color: var(--text-primary); }

	.cluster {
		display: flex;
		gap: var(--space-1);
		min-width: 0;
		padding: 0 var(--space-6) var(--space-2) var(--space-4);
	}
	.cluster-chip {
		flex: 1;
		min-width: 0;
		font-size: var(--text-xs);
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-input);
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		font-family: inherit;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.cluster-chip.active { border-color: var(--text-primary); color: var(--text-primary); }

	.preview-cover {
		width: 100%;
		height: 108px;
		border-radius: var(--radius-input);
		object-fit: cover;
		display: block;
	}
	.preview-cover--placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.6rem;
		color: var(--text-muted);
		background: var(--bg-control);
	}
	.preview-title {
		font-size: var(--text-lg);
		font-weight: 500;
		margin: var(--space-3) 0 0;
		line-height: var(--leading-tight);
	}
	.preview-byline { font-size: var(--text-sm); color: var(--text-muted); margin: 2px 0 0; }
	.preview-tags { display: flex; gap: var(--space-2); margin-top: var(--space-2); }
	.tag {
		font-size: var(--text-xs);
		padding: 2px var(--space-2);
		border-radius: 999px;
		background: var(--bg-control);
		color: var(--text-muted);
	}
	.preview-snippet {
		font-size: var(--text-sm);
		color: var(--text-muted);
		line-height: var(--leading-relaxed);
		margin: var(--space-3) 0 0;
	}

	.preview-times { margin-top: var(--space-3); display: flex; flex-direction: column; gap: var(--space-1); }
	.slot-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-input);
		font-size: var(--text-sm);
	}
	/* Subtle in-place highlight for the slot(s) this card corresponds to —
	   chronological order is never disturbed. */
	.slot-row.current { background: var(--bg-control); border-color: var(--border-link); }
	.slot-jump {
		width: 100%;
		text-align: left;
		background: none;
		font-family: inherit;
		color: inherit;
		cursor: pointer;
		transition: border-color 0.15s;
	}
	.slot-jump:hover { border-color: var(--border-link-hover); }
	.slot-area { color: var(--text-muted); font-size: var(--text-xs); flex-shrink: 0; }
	.more-times {
		text-align: left;
		font-size: var(--text-xs);
		color: var(--text-muted);
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
		padding: var(--space-1) var(--space-3);
	}
	.more-times:hover { color: var(--text-primary); }

	.preview-cta {
		display: block;
		margin-top: var(--space-4);
		padding: var(--space-3);
		border: 1px solid var(--text-primary);
		border-radius: var(--radius-input);
		background: var(--text-primary);
		color: var(--bg-canvas);
		font-size: var(--text-sm);
		text-align: center;
		text-decoration: none;
	}
</style>
