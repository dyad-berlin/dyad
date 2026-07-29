<script lang="ts">
	import type { PageData } from './$types';
	import type { PromptSummary, TimeSlot } from '$lib/domain/types';
	import { goto, pushState, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { onMount, untrack } from 'svelte';
	import MapView from '$lib/components/MapView.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import MapPreviewCard from '$lib/components/MapPreviewCard.svelte';
	import FloatingNav from '$lib/components/FloatingNav.svelte';
	import SearchOverlay from '$lib/components/SearchOverlay.svelte';
	import ConversationCard from '$lib/components/ConversationCard.svelte';

	function slotDates(slots: { start_time: string }[]): string {
		const dates = new Set<string>();
		for (const s of slots) {
			const d = new Date(s.start_time);
			dates.add(d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }));
		}
		return [...dates].join(' · ');
	}

	function uniqueAreas(slots: { general_area: string }[]): string {
		return slots
			.map((s) => s.general_area)
			.filter((v, i, a) => a.indexOf(v) === i)
			.join(', ');
	}
	import OnboardingModal from '$lib/components/OnboardingModal.svelte';
	import { getWeekDates } from '$lib/utils/dates';
	import type { Snapshot } from './$types';
	import { copy } from '$lib/copy';

	let { data }: { data: PageData } = $props();

	const ONBOARDING_KEY = 'dyad_onboarding_done';
	// Set once the DB write (profiles.onboarded) has been confirmed, so we don't
	// re-POST on every visit and we know whether a retry is still owed.
	const ONBOARDING_SYNCED_KEY = 'dyad_onboarding_synced';
	const isWelcome = browser && new URLSearchParams(window.location.search).get('welcome') === '1';
	// Guests (corner-exclusive members) skip the commons onboarding — its
	// framing is written for the Berlin commons, not a conference corner.
	//
	// Gate on the per-user durable flag (data.onboarded, from profiles.onboarded
	// via the layout loader), NOT the browser-global localStorage flag: the
	// latter is set once per browser, so a second account on the same browser
	// would be wrongly treated as already onboarded and never see ?welcome=1.
	let showOnboarding = $state(isWelcome && !data.isGuest && !data.onboarded);

	// Persist onboarding completion to the DB (profiles.onboarded = true) — the
	// durable signal downstream consumers key off. Not fire-and-forget: a dropped
	// request would leave the member un-onboarded forever, so success sets a synced
	// flag and any failure is retried on the next discover visit (see onMount).
	async function persistOnboarding() {
		if (!browser) return;
		try {
			const res = await fetch('/api/onboarding/complete', { method: 'POST' });
			if (res.ok) {
				localStorage.setItem(ONBOARDING_SYNCED_KEY, '1');
			} else {
				console.error('[onboarding] persist failed:', res.status);
			}
		} catch (err) {
			console.error('[onboarding] persist request failed:', err);
		}
	}

	onMount(() => {
		// Self-heal a previously dropped persistence call: the member finished
		// onboarding (UI flag set) but the DB write was never confirmed.
		if (
			!data.isGuest &&
			localStorage.getItem(ONBOARDING_KEY) &&
			!localStorage.getItem(ONBOARDING_SYNCED_KEY)
		) {
			void persistOnboarding();
		}
	});

	function finishOnboarding() {
		if (browser) localStorage.setItem(ONBOARDING_KEY, '1');
		showOnboarding = false;
		void persistOnboarding();
		// Clean up the ?welcome=1 param from the URL without a page reload
		const url = new URL(window.location.href);
		url.searchParams.delete('welcome');
		window.history.replaceState({}, '', url);
		// E4: a newcomer who isn't a member yet meets the pricing page right after onboarding.
		if (!data.membership?.active) {
			void goto('/membership');
		}
	}
	// Two views, not three: 'split' pairs the map with the list (desktop) or
	// shows the map full-bleed (mobile, where the list pane hides); 'list' is
	// the full-width list on both. The old map-only mode collapsed into
	// 'split' — on desktop it was near-identical to split, and on mobile
	// split previously hid the map, which made the third mode load-bearing
	// for the wrong reason.
	let viewMode = $state<'list' | 'split'>('split');
	let mapCenter = $state<[number, number] | null>(null);
	let mapZoom = $state<number | null>(null);

	// Persist the list/map choice alongside map position so returning from a
	// conversation restores the view the member was using, not the map default.
	// Old snapshots may still carry 'map' — restore it as 'split'.
	export const snapshot: Snapshot<{ center: [number, number] | null; zoom: number | null; view?: 'list' | 'map' | 'split' }> = {
		capture: () => ({ center: mapCenter, zoom: mapZoom, view: viewMode }),
		restore: (value) => {
			mapCenter = value.center;
			mapZoom = value.zoom;
			if (value.view) viewMode = value.view === 'map' ? 'split' : value.view;
		}
	};
	let searchOpen = $state(false);
	let selectedPinItems = $state<Array<{ prompt: PromptSummary; slots: TimeSlot[] }>>([]);
	// Desktop preview state ("one preview, two doors"): which conversation the
	// card shows, and which slot(s) it corresponds to — the door pin's slots,
	// or the single hopped slot after a time hop. Mobile ignores these beyond
	// the pin ring; the BottomSheet keeps its own flow there.
	let previewPromptId = $state<string | null>(null);
	let previewSlotIds = $state<string[]>([]);
	// The active pin's container point, streamed by MapView through map
	// moves — the preview card anchors beside it and rides along.
	let previewAnchor = $state<{ x: number; y: number } | null>(null);
	// Pan behavior for the next active-slot change: pin clicks nudge ('ensure'
	// — the pin is already under the cursor), sidebar opens and cross-location
	// hops center the pin+card composition.
	let previewPanMode = $state<'ensure' | 'center'>('ensure');

	// ── Preview ↔ URL sync ───────────────────────────────────────────────────
	// The open preview lives in ?preview=<slotId> so browser back restores it:
	// back from a conversation detail returns to the same card, and back while
	// a card is open closes it. Shallow routing — no load rerun.
	let previewPushed = false;

	function writePreviewParam(slotId: string) {
		const url = new URL(page.url);
		const fresh = !url.searchParams.has('preview');
		url.searchParams.set('preview', slotId);
		// The slot id rides in both the URL param (survives hard loads and
		// shared links) and the shallow page.state (survives back/forward,
		// where SvelteKit restores state but not necessarily the shallow
		// entry's URL params). First open pushes a history entry (back =
		// close); subsequent hops and switches replace it, so back never
		// steps through every hop.
		if (fresh) {
			pushState(url, { previewSlot: slotId });
			previewPushed = true;
		} else {
			replaceState(url, { previewSlot: slotId });
		}
	}

	function clearPreviewParam() {
		if (!page.url.searchParams.has('preview')) return;
		if (previewPushed) {
			// We own the history entry — pop it, so back after closing doesn't
			// reopen the card.
			previewPushed = false;
			history.back();
		} else {
			// Restored from a URL we didn't push (back-navigation or direct
			// link): strip the param in place.
			const url = new URL(page.url);
			url.searchParams.delete('preview');
			replaceState(url, {});
		}
	}

	/** Open the preview from a slot ID alone (URL restore). The cluster and
	 *  pan-to-pin follow from MapView's active-pin reporting. */
	function openPreviewBySlotId(slotId: string) {
		const prompt = data.prompts.find((p) => p.available_slots.some((s) => s.id === slotId));
		if (!prompt) {
			// Stale param (slot expired or filtered out of the feed).
			const url = new URL(page.url);
			url.searchParams.delete('preview');
			replaceState(url, {});
			return;
		}
		const slot = prompt.available_slots.find((s) => s.id === slotId)!;
		previewPanMode = 'center';
		selectedPinItems = [{ prompt, slots: [slot] }];
		previewPromptId = prompt.id;
		previewSlotIds = [slotId];
	}

	// URL → state, for changes we didn't make ourselves (popstate, initial
	// load with ?preview). Tracks only the URL; preview state is read
	// untracked so our own handlers (which write both in the same tick)
	// don't retrigger it.
	$effect(() => {
		const param = page.state.previewSlot ?? page.url.searchParams.get('preview');
		untrack(() => {
			if (param && param !== (previewSlotIds[0] ?? null)) {
				openPreviewBySlotId(param);
			} else if (!param && (previewSlotIds.length > 0 || selectedPinItems.length > 0)) {
				// Back past the open-entry: close without touching history.
				previewPushed = false;
				selectedPinItems = [];
				previewPromptId = null;
				previewSlotIds = [];
			}
		});
	});
	// The pan inset only applies where the preview card actually covers the
	// map (desktop); on mobile the card is display:none and the map must not
	// dodge a phantom overlay.
	let isDesktop = $state(false);
	onMount(() => {
		// Same query the stylesheet uses (max-width: 768px), negated — a
		// min-width: 769px twin leaves a fractional-pixel dead zone where the
		// script and CSS disagree about which surface is visible.
		const mq = window.matchMedia('(max-width: 768px)');
		isDesktop = !mq.matches;
		const onChange = (e: MediaQueryListEvent) => (isDesktop = !e.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	function handlePinSelect(items: Array<{ prompt: PromptSummary; slots: TimeSlot[] }>, _area: string) {
		previewPanMode = 'ensure';
		selectedPinItems = items;
		const first = items[0];
		previewPromptId = first?.prompt.id ?? null;
		previewSlotIds = (first?.slots?.length ? first.slots : first?.prompt.available_slots.slice(0, 1) ?? []).map((s) => s.id);
		if (previewSlotIds[0]) writePreviewParam(previewSlotIds[0]);
	}

	/** MapView reports the active pin's cluster whenever the active slot or
	 *  pin set changes. Adopting it keeps the stacked-pin switcher truthful
	 *  to the pin the card is anchored to — after a cross-location time hop
	 *  the old pin's neighbors would otherwise linger — and fills in the
	 *  cluster on URL-restored opens. */
	function adoptActivePinItems(items: Array<{ prompt: PromptSummary; slots: TimeSlot[] }> | null) {
		if (!items || items.length === 0) return;
		selectedPinItems = items;
		if (previewPromptId && !items.some((i) => i.prompt.id === previewPromptId)) {
			previewPromptId = items[0].prompt.id;
		}
	}

	// Whether a slot has a pin on the current map: it carries coordinates and
	// passes the active slot filters (buildPins skips anything else). Both the
	// sidebar door and the card's time-hop rows use this, so a door can never
	// point at a pin that doesn't exist.
	function slotIsPinnable(slot: TimeSlot): boolean {
		if (slot.general_area_lat == null || slot.general_area_lng == null) return false;
		if (!slot.general_area) return false;
		return mapSlotFilter ? mapSlotFilter(slot) : true;
	}

	// The sidebar door: same preview, opened from a list card in the split
	// view. Highlights the soonest PINNABLE time so the map has something to
	// ring and pan to; falls back to the soonest slot when none are pinnable.
	function openPreviewFromList(prompt: PromptSummary) {
		const soonest = prompt.available_slots.find(slotIsPinnable) ?? prompt.available_slots[0];
		previewPanMode = 'center';
		selectedPinItems = [{ prompt, slots: soonest ? [soonest] : [] }];
		previewPromptId = prompt.id;
		previewSlotIds = soonest ? [soonest.id] : [];
		if (soonest) writePreviewParam(soonest.id);
	}

	// Split-view card click: intercept only the plain primary click for the
	// preview; modified clicks (cmd/ctrl/shift/middle) keep real link behavior.
	function interceptCardClick(e: MouseEvent, prompt: PromptSummary) {
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
		e.preventDefault();
		openPreviewFromList(prompt);
	}

	function switchPreviewConvo(promptId: string) {
		previewPanMode = 'ensure';
		previewPromptId = promptId;
		const item = selectedPinItems.find((i) => i.prompt.id === promptId);
		previewSlotIds = (item?.slots?.length ? item.slots : item?.prompt.available_slots.slice(0, 1) ?? []).map((s) => s.id);
		if (previewSlotIds[0]) writePreviewParam(previewSlotIds[0]);
	}

	function hopPreviewSlot(slot: TimeSlot) {
		// A hop can land at another location entirely — center it like a
		// sidebar open rather than nudging.
		previewPanMode = 'center';
		previewSlotIds = [slot.id];
		writePreviewParam(slot.id);
	}

	function closeSheet() {
		const wasOpen = selectedPinItems.length > 0 || previewSlotIds.length > 0;
		selectedPinItems = [];
		previewPromptId = null;
		previewSlotIds = [];
		// Only touch history when something was actually open — this also runs
		// from the filter-change effect on mount, before a URL restore.
		if (wasOpen) clearPreviewParam();
	}

	const weekDates = getWeekDates();

	// Collect unique neighbourhoods from all prompts' slots. The instance's
	// own city is excluded: a "Berlin" option on the Berlin instance means
	// "Anywhere", which the filter already offers.
	const availableAreas = $derived.by(() => {
		const areas = new Set<string>();
		for (const p of data.prompts) {
			for (const s of p.available_slots) {
				if (s.general_area) areas.add(s.general_area);
			}
		}
		const city = (data.regionCity ?? '').toLowerCase();
		return [...areas].filter((a) => a.toLowerCase() !== city).sort();
	});

	// Filter state
	let selectedDates = $state<Set<string>>(new Set());
	// Where filter — single neighbourhood (dropdown), null = anywhere.
	let selectedArea = $state<string | null>(null);
	// Type filter — toggles, like the day cells. Empty = any. 1-on-1 = capacity 1;
	// group = capacity null (legacy) or >= 2.
	let selectedTypes = $state<Set<'1on1' | 'group'>>(new Set());
	// Corner (scope) filter — toggles too. Empty = all corners.
	let selectedScopes = $state<Set<string>>(new Set());

	// Distinct corner names present in the feed (commons prompts carry no name).
	const availableScopes = $derived.by(() => {
		const names = new Set<string>();
		for (const p of data.prompts) if (p.audience_scope_name) names.add(p.audience_scope_name);
		return [...names].sort();
	});

	let hasFilters = $derived(
		selectedDates.size > 0 || selectedArea !== null || selectedTypes.size > 0 || selectedScopes.size > 0
	);

	/** Prompt-level: match a toggled type (none toggled = any). */
	function promptMatchesMode(p: PromptSummary): boolean {
		if (selectedTypes.size === 0) return true;
		return selectedTypes.has(p.capacity === 1 ? '1on1' : 'group');
	}

	/** Prompt-level: match a toggled corner (none toggled = all corners). */
	function promptMatchesScope(p: PromptSummary): boolean {
		if (selectedScopes.size === 0) return true;
		return p.audience_scope_name !== null && selectedScopes.has(p.audience_scope_name);
	}

	/** Check if a slot falls on one of the selected dates */
	function slotMatchesDate(slot: TimeSlot, dates: Set<string>): boolean {
		if (dates.size === 0) return true;
		const slotDate = new Date(slot.start_time).toLocaleDateString('sv-SE');
		return dates.has(slotDate);
	}

	/** Check if a slot is in the selected neighbourhood (null = anywhere). */
	function slotMatchesArea(slot: TimeSlot, area: string | null): boolean {
		return area === null || slot.general_area === area;
	}

	let filteredPrompts = $derived.by(() => {
		if (!hasFilters) return data.prompts;
		return data.prompts.filter(
			(p) =>
				promptMatchesMode(p) &&
				promptMatchesScope(p) &&
				p.available_slots.some(
					(s) => slotMatchesDate(s, selectedDates) && slotMatchesArea(s, selectedArea)
				)
		);
	});

	// Slot-level predicate for the map: a Wednesday-only filter should drop the
	// Tuesday-Mitte pin even on conversations that have a Wednesday slot
	// elsewhere. `filteredPrompts` already narrows the conversation list; this
	// narrows the pin set within each conversation.
	let mapSlotFilter = $derived(
		hasFilters
			? (slot: TimeSlot) => slotMatchesDate(slot, selectedDates) && slotMatchesArea(slot, selectedArea)
			: undefined
	);

	function toggleDate(date: string) {
		const next = new Set(selectedDates);
		if (next.has(date)) next.delete(date);
		else next.add(date);
		selectedDates = next;
	}

	function setArea(area: string | null) {
		selectedArea = area;
	}

	function toggleType(type: '1on1' | 'group') {
		const next = new Set(selectedTypes);
		if (next.has(type)) next.delete(type);
		else next.add(type);
		selectedTypes = next;
	}

	function toggleScope(scope: string) {
		const next = new Set(selectedScopes);
		if (next.has(scope)) next.delete(scope);
		else next.add(scope);
		selectedScopes = next;
	}

	function clearFilters() {
		selectedDates = new Set();
		selectedArea = null;
		selectedTypes = new Set();
		selectedScopes = new Set();
	}

	// Reset the BottomSheet selection whenever the filter state changes — otherwise
	// the sheet keeps displaying conversations that are no longer on the filtered
	// map. Per-slot pins make this gap more visible because clicks pull more items
	// into the sheet. Reading the Sets directly tracks identity reassignment
	// (toggleDate/clearFilters create new Set instances each time).
	let filterEffectSeeded = false;
	$effect(() => {
		if (selectedDates && selectedTypes && selectedScopes && selectedArea !== undefined) {
			// Skip the mount run — it fires before/around the ?preview URL
			// restore and would close the just-restored card. Only actual
			// filter changes should close the preview.
			if (!filterEffectSeeded) {
				filterEffectSeeded = true;
				return;
			}
			// Clear ALL preview state, not just the sheet items — leaving
			// previewSlotIds set would strand the active-pin ring after a
			// filter change removes the previewed conversation. closeSheet
			// reads none of the filter state, so no reactive cycle.
			closeSheet();
		}
	});

	/** Format slot dates for display, e.g. "Fri 28 · Sat 29" */
	/** Format a single slot's time, e.g. "7:30 PM" */
	function formatSlotTime(slot: TimeSlot): string {
		return new Date(slot.start_time).toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

</script>

<svelte:head>
	<title>Discover · dyad.social</title>
</svelte:head>

{#snippet mapBlock()}
	<MapView
		prompts={filteredPrompts}
		slotFilter={mapSlotFilter}
		fitKey={selectedArea}
		activeSlotId={previewSlotIds[0] ?? null}
		panToActive={isDesktop}
		activePanMode={previewPanMode}
		onActivePinPoint={(p) => (previewAnchor = p)}
		onActivePinItems={adoptActivePinItems}
		onSelectPin={handlePinSelect}
		onMapClick={closeSheet}
		initialCenter={mapCenter ?? data.mapCenter}
		initialZoom={mapZoom}
		onMoveEnd={(c, z) => { mapCenter = c; mapZoom = z; }}
	/>
{/snippet}

{#snippet listBlock()}
	{#if data.prompts.length === 0}
		<div class="empty-state">
			<p>{copy.discover.noConversations}</p>
			<p class="empty-hint">{copy.discover.checkBackSoon}</p>
			<a href="/conversations/new" class="btn-primary btn-primary--sm" style="margin-top: var(--space-4); display: inline-block; text-decoration: none;">{copy.discover.startConversation}</a>
		</div>
	{:else if filteredPrompts.length === 0}
		<div class="empty-state">
			<p>{copy.discover.noMatchingFilters}</p>
			<button class="clear-filters-link" onclick={clearFilters}>{copy.common.clearFilters}</button>
		</div>
	{:else}
		<div class="prompt-list">
			{#each filteredPrompts as prompt}
				<!-- Always a real link (cmd/middle-click and open-in-new-tab keep
				     working). In the split view the plain primary click is
				     intercepted to open the preview instead — the second door;
				     in the list view, where there is no map to preview over, it
				     navigates as before. -->
				<ConversationCard
					title={prompt.title ?? copy.common.untitled}
					coverUrl={prompt.cover_image_url}
					snippet={prompt.body_snippet}
					metaLeft={slotDates(prompt.available_slots)}
					metaRight={uniqueAreas(prompt.available_slots)}
					conversationType={prompt.capacity === 1 ? '1on1' : 'group'}
					href={`/conversations/${prompt.id}`}
					onclick={viewMode === 'split' ? (e: MouseEvent) => interceptCardClick(e, prompt) : undefined}
					audienceScopeName={prompt.audience_scope_name}
				/>
			{/each}
		</div>
	{/if}
{/snippet}

{#if viewMode === 'split'}
	<div class="split">
		<aside class="list-pane">
			<div class="list-head">
				<span class="list-title">Conversations</span>
			</div>
			<div class="list-scroll">
				{@render listBlock()}
			</div>
		</aside>
		<div class="map-pane map-pane--split">
			{@render mapBlock()}
			{#if selectedPinItems.length > 0 && previewPromptId}
				<!-- Desktop: the preview card in its constant frame over the map.
				     Hidden on mobile (media query below), where the BottomSheet
				     keeps this role. -->
				<div class="preview-host">
					<MapPreviewCard
						items={selectedPinItems}
						activePromptId={previewPromptId}
						activeSlotIds={previewSlotIds}
						onSwitchConvo={switchPreviewConvo}
						onHopSlot={hopPreviewSlot}
						onClose={closeSheet}
						isPinnable={slotIsPinnable}
						anchor={previewAnchor}
					/>
				</div>
			{/if}
		</div>
	</div>
	{#if selectedPinItems.length > 0}
		<div class="sheet-host">
			<BottomSheet items={selectedPinItems} />
		</div>
	{/if}
{:else}
	<!-- No in-page view switch: the nav pill's map/list toggle is the single
	     control for split ↔ list, so nothing here duplicates it. -->
	<div class="content list-full">
		{@render listBlock()}
	</div>
{/if}

<div class="floating-nav-wrapper">
	<FloatingNav
		variant="discover"
		active={viewMode === 'split' ? 'map' : ''}
		attentionCount={data.attentionCount ?? 0}
		onMapClick={() => viewMode = viewMode === 'split' ? 'list' : 'split'}
		{weekDates}
		monthAhead={true}
		selectedDays={selectedDates}
		onToggleDay={toggleDate}
		onReplaceDays={(next) => (selectedDates = next)}
		{availableAreas}
		{selectedArea}
		onSetArea={setArea}
		{selectedTypes}
		onToggleType={toggleType}
		{availableScopes}
		{selectedScopes}
		onToggleScope={toggleScope}
		showFilters={true}
		filtersActive={hasFilters}
		onClearFilters={clearFilters}
		onSearchClick={() => searchOpen = true}
	/>
</div>

{#if searchOpen}
	<SearchOverlay
		prompts={data.searchCorpus}
		onClose={() => searchOpen = false}
		onSelect={(id) => { searchOpen = false; goto(`/conversations/${id}`); }}
	/>
{/if}

{#if showOnboarding}
	<OnboardingModal onDone={finishOnboarding} username={data.username} />
{/if}

<style>
	.floating-nav-wrapper { display: block; }
	/* .map-pane's old standalone fixed-position rule died with the map-only
	   view mode; the class now only ever appears as .map-pane.map-pane--split,
	   which owns its own positioning. */

	.content {
		width: 100%;
		max-width: var(--content-wide);
		padding-bottom: var(--nav-clearance);
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		color: var(--text-muted);
	}

	.empty-state p {
		margin: 0.5rem 0;
	}

	.empty-hint {
		font-size: var(--text-base);
	}

	.clear-filters-link {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: var(--text-base);
		font-family: inherit;
		cursor: pointer;
		text-decoration: underline;
	}

	.clear-filters-link:hover { color: var(--text-primary); }

	/* === Prompt list === */
	.prompt-list {
		display: flex;
		flex-direction: column;
		gap: 0;
		margin-top: 2rem;
		margin-bottom: 3rem;
	}

	/* .btn-primary / .btn-primary--sm live in shared.css; see ConversationCard.svelte for list items. */

	/* === Split: conversation list (left) + map (right) === */
	.split {
		position: fixed;
		inset: 0;
		display: flex;
	}
	.list-pane {
		width: 26rem;
		max-width: 44vw;
		display: flex;
		flex-direction: column;
		background: var(--bg-canvas);
		border-right: 1px solid var(--border-link);
		z-index: 1;
	}
	.list-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-4) var(--space-2);
	}
	.list-title {
		font-size: var(--text-lg);
		font-weight: 500;
		color: var(--text-primary);
	}
	.list-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 0 var(--space-4) var(--nav-clearance);
	}
	.list-scroll .prompt-list { margin-top: var(--space-2); margin-bottom: 0; }
	.map-pane--split {
		position: relative;
		inset: auto;
		flex: 1;
	}
	.list-full { margin: 0 auto; }

	/* Preview card (desktop) vs BottomSheet (mobile): both render behind these
	   hosts; the breakpoint decides which one shows. */
	.preview-host { display: contents; }
	.sheet-host { display: none; }

	/* Narrow screens: the split view IS the map — the list pane (and its
	   expand button) hides, and the nav toggle switches map ↔ list. This
	   replaces the old third view mode (map-only) rather than hiding the map. */
	@media (max-width: 768px) {
		.list-pane { display: none; }
		.preview-host { display: none; }
		.sheet-host { display: contents; }
	}
</style>
