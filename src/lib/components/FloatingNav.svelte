<script lang="ts">
	import { onMount } from 'svelte';
	import { copy } from '$lib/copy';
	import type { WeekDate } from '$lib/utils/dates';

	export interface FloatingNavAction {
		label: string;
		href?: string;
		onclick?: () => void;
		danger?: boolean;
	}

	/**
	 * FloatingNav is composed of a shared CORE TRIPLET (always rendered on
	 * authenticated variants):
	 *
	 *   [discover-or-map-toggle]  [+]  [profile]
	 *
	 * Variants add optional extras on either side of the triplet. Prefer
	 * symmetry (+1 each side) where it reads well, but don't force it.
	 *
	 *   discover  : [date-filter?] → core → [search]
	 *                (core's discover slot renders as map/list toggle)
	 *   detail    : [back] → core → [kebab?]
	 *                (used on conversation/meeting detail pages)
	 *   profile   : just the core triplet, with profile marked active
	 *   default   : just the core triplet (user detail pages, etc.)
	 *   landing   : special — map/list toggle alone, no auth-gated actions
	 */
	let {
		variant = 'default',
		position = 'bottom',
		active = '',
		attentionCount = 0,
		onMapClick,
		weekDates = [],
		selectedDays = new Set<string>(),
		onToggleDay,
		availableAreas = [],
		selectedArea = null,
		onSetArea,
		selectedTypes = new Set<string>(),
		onToggleType,
		availableScopes = [],
		selectedScopes = new Set<string>(),
		onToggleScope,
		showFilters = false,
		filtersActive = false,
		onClearFilters,
		onSearchClick,
		// Detail variant controls (conversations/[id], meetings/[id])
		onBackClick,
		actions = [],
	}: {
		variant?: 'discover' | 'default' | 'profile' | 'landing' | 'detail';
		position?: 'top' | 'bottom';
		active?: string;
		attentionCount?: number;
		onMapClick?: () => void;
		weekDates?: WeekDate[];
		selectedDays?: Set<string>;
		onToggleDay?: (date: string) => void;
		availableAreas?: string[];
		selectedArea?: string | null;
		onSetArea?: (area: string | null) => void;
		selectedTypes?: Set<string>;
		onToggleType?: (type: '1on1' | 'group') => void;
		availableScopes?: string[];
		selectedScopes?: Set<string>;
		onToggleScope?: (scope: string) => void;
		showFilters?: boolean;
		filtersActive?: boolean;
		onClearFilters?: () => void;
		onSearchClick?: () => void;
		onBackClick?: () => void;
		actions?: FloatingNavAction[];
	} = $props();

	let filterOpen = $state(false);
	let actionsDropdownOpen = $state(false);
	let actionsDropdownRef: HTMLElement | undefined = $state();

	// Close dropdown on click outside
	onMount(() => {
		function handleClickOutside(e: MouseEvent) {
			if (actionsDropdownOpen && actionsDropdownRef && !actionsDropdownRef.contains(e.target as Node)) {
				actionsDropdownOpen = false;
			}
		}
		document.addEventListener('click', handleClickOutside, true);
		return () => document.removeEventListener('click', handleClickOutside, true);
	});

	function defaultBackHandler() {
		if (typeof window === 'undefined') return;
		if (window.history.length > 1) window.history.back();
		else window.location.href = '/discover';
	}
</script>

<!-- ── Core triplet: rendered the same way across every authenticated variant ── -->
{#snippet coreDiscover(asToggle: boolean, mapActive: boolean)}
	{#if asToggle}
		<!-- On the discover variant the button is a map/list toggle. It's the
		     current page, so the icon stays accented in both states — the
		     icon swap (map ↔ list) carries the mode, the tint carries "you
		     are here". -->
		<button
			class="nav-btn active-icon"
			onclick={onMapClick}
			aria-label={mapActive ? 'List view' : 'Map view'}
		>
			{#if mapActive}
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
					<path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
				</svg>
			{:else}
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
					<path d="M1 4l5 2 6-2 6 2v12l-6-2-6 2-5-2V4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
					<path d="M6 6v12M12 4v12" stroke="currentColor" stroke-width="1.6"/>
				</svg>
			{/if}
		</button>
	{:else}
		<a href="/discover" class="nav-btn" aria-label="Discover">
			<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
				<path d="M1 4l5 2 6-2 6 2v12l-6-2-6 2-5-2V4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
				<path d="M6 6v12M12 4v12" stroke="currentColor" stroke-width="1.6"/>
			</svg>
		</a>
	{/if}
{/snippet}

{#snippet corePlus()}
	<a href="/conversations/new" class="plus-btn" aria-label="Start a conversation">
		<svg width="22" height="22" viewBox="0 0 20 20" fill="none">
			<path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
		</svg>
	</a>
{/snippet}

{#snippet coreProfile(profileActive: boolean)}
	<a
		href="/profile"
		class="nav-btn"
		class:active-icon={profileActive}
		aria-label="Profile"
		aria-current={profileActive ? 'page' : undefined}
	>
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
			<circle cx="10" cy="7" r="3.5" stroke="currentColor" stroke-width="1.6"/>
			<path d="M3 18c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
		</svg>
		{#if attentionCount > 0}<span class="badge-dot"><span class="sr-only">{attentionCount} notifications</span></span>{/if}
	</a>
{/snippet}

<div class="floating-nav-anchor" class:top={position === 'top'} class:bottom={position === 'bottom'} class:wide={variant === 'discover'}>
	<nav class="floating-nav" aria-label="Navigation">

		{#if variant === 'landing'}
			<!-- Landing (anonymous): map/list toggle alone; no auth-gated buttons. -->
			{@render coreDiscover(true, active === 'map')}

		{:else}
			<!-- LEFT EXTRAS -->
			{#if variant === 'detail'}
				<button class="nav-btn" onclick={onBackClick ?? defaultBackHandler} aria-label="Back">
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<path d="M12 15l-5-5 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</button>
			{/if}

			{#if variant === 'discover' && showFilters}
				<button
					class="nav-btn"
					class:active-icon={filtersActive || filterOpen}
					onclick={() => (filterOpen = !filterOpen)}
					aria-label="Filter conversations"
					aria-expanded={filterOpen}
				>
					<!-- Funnel: the unambiguous filter glyph — distinct from the list/map lines. -->
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<path d="M3 4.5h14l-5.3 6.4v4.4l-3.4 1.7v-6.1L3 4.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
					</svg>
					{#if filtersActive}<span class="badge-dot"><span class="sr-only">filters active</span></span>{/if}
				</button>
			{/if}

			<!-- CORE TRIPLET -->
			{@render coreDiscover(variant === 'discover', active === 'map')}
			{@render corePlus()}
			{@render coreProfile(variant === 'profile')}

			<!-- RIGHT EXTRAS -->
			{#if variant === 'discover'}
				<button class="nav-btn" aria-label="Search" onclick={onSearchClick}>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.6"/>
						<path d="M14 14l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
					</svg>
				</button>
			{/if}

			{#if variant === 'detail'}
				{#if actions.length > 0}
					<div class="actions-wrapper" bind:this={actionsDropdownRef}>
						<button
							class="nav-btn"
							onclick={() => (actionsDropdownOpen = !actionsDropdownOpen)}
							aria-label="Actions"
							aria-haspopup="true"
							aria-expanded={actionsDropdownOpen}
						>
							<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
								<circle cx="5" cy="10" r="1.5" fill="currentColor"/>
								<circle cx="10" cy="10" r="1.5" fill="currentColor"/>
								<circle cx="15" cy="10" r="1.5" fill="currentColor"/>
							</svg>
						</button>
						{#if actionsDropdownOpen}
							<div class="actions-dropdown" role="menu">
								{#each actions as action}
									{#if action.href}
										<a
											href={action.href}
											class="dropdown-item"
											class:dropdown-item--danger={action.danger}
											role="menuitem"
											onclick={() => { actionsDropdownOpen = false; action.onclick?.(); }}
										>
											{action.label}
										</a>
									{:else}
										<button
											class="dropdown-item"
											class:dropdown-item--danger={action.danger}
											role="menuitem"
											onclick={() => { actionsDropdownOpen = false; action.onclick?.(); }}
										>
											{action.label}
										</button>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				{:else}
					<!-- Invisible placeholder to keep the + centred when no kebab. -->
					<span class="nav-btn-placeholder" aria-hidden="true"></span>
				{/if}
			{/if}
		{/if}

	</nav>
</div>

<!-- Unified filter sheet (discover variant only): When · Type · Corner -->
{#if variant === 'discover' && showFilters && filterOpen}
	<div class="filter-sheet" class:filter-sheet-top={position === 'top'} class:filter-sheet-bottom={position === 'bottom'} role="dialog" aria-label="Filters">
		<section class="filter-section">
			<div class="filter-eyebrow">{copy.discover.filterWhenLabel}</div>
			<div class="day-row">
				{#each weekDates as day}
					<button
						class="day-cell"
						class:selected={selectedDays.has(day.date)}
						aria-pressed={selectedDays.has(day.date)}
						onclick={() => onToggleDay?.(day.date)}
					>
						<span class="day-name">{day.dayShort}</span>
						<span class="day-num">{day.dayNum}</span>
					</button>
				{/each}
			</div>
		</section>

		{#if availableAreas.length > 0}
			<section class="filter-section">
				<div class="filter-eyebrow">{copy.discover.filterWhereLabel}</div>
				<div class="filter-select-wrap">
					<select
						class="filter-select"
						aria-label={copy.discover.filterWhereLabel}
						value={selectedArea ?? ''}
						onchange={(e) => onSetArea?.(e.currentTarget.value || null)}
					>
						<option value="">{copy.discover.filterAnywhere}</option>
						{#each availableAreas as area}
							<option value={area}>{area}</option>
						{/each}
					</select>
					<svg class="filter-select-chevron" width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
						<path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
				</div>
			</section>
		{/if}

		<section class="filter-section">
			<div class="filter-eyebrow">{copy.discover.filterTypeLabel}</div>
			<div class="seg" role="group" aria-label={copy.discover.filterTypeLabel}>
				<button class="seg-btn" class:selected={selectedTypes.has('1on1')} aria-pressed={selectedTypes.has('1on1')} onclick={() => onToggleType?.('1on1')}>{copy.discover.filterOneOnOne}</button>
				<button class="seg-btn" class:selected={selectedTypes.has('group')} aria-pressed={selectedTypes.has('group')} onclick={() => onToggleType?.('group')}>{copy.discover.filterGroup}</button>
			</div>
		</section>

		{#if availableScopes.length > 0}
			<section class="filter-section">
				<div class="filter-eyebrow">{copy.discover.filterCornerLabel}</div>
				<div class="seg seg-wrap" role="group" aria-label={copy.discover.filterCornerLabel}>
					{#each availableScopes as scope}
						<button class="seg-btn" class:selected={selectedScopes.has(scope)} aria-pressed={selectedScopes.has(scope)} onclick={() => onToggleScope?.(scope)}>{scope}</button>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Always rendered so toggling active state never reflows the sheet. -->
		<button
			class="filter-clear"
			class:is-hidden={!filtersActive}
			tabindex={filtersActive ? 0 : -1}
			aria-hidden={!filtersActive}
			onclick={() => onClearFilters?.()}
		>{copy.discover.filterClearAll}</button>
	</div>
{/if}

<style>
	/* Wrapper */
	.floating-nav-anchor {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		width: auto;
		max-width: calc(100% - 40px);
		z-index: 800;
		pointer-events: none;
	}
	.floating-nav-anchor.top { top: calc(var(--space-4) + env(safe-area-inset-top, 0px)); }
	.floating-nav-anchor.bottom { bottom: calc(var(--space-5) + env(safe-area-inset-bottom, 0px)); }
	.floating-nav-anchor.wide { width: auto; }

	/* Nav pill */
	.floating-nav {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
		background: var(--bg-glass);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-radius: var(--radius-pill);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
		padding: var(--space-2) var(--space-3);
		gap: var(--space-2);
		pointer-events: auto;
	}

	.nav-btn {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		color: var(--text-primary);
		text-decoration: none;
		flex-shrink: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		transition: background 0.15s;
	}
	.nav-btn:hover, .nav-btn.active-icon {
		background: color-mix(in srgb, var(--text-primary) 7%, transparent);
	}

	.plus-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--text-primary);
		color: var(--bg-canvas);
		text-decoration: none;
		flex-shrink: 0;
		transition: opacity 0.15s;
	}
	.plus-btn:hover { opacity: var(--opacity-hover-btn); }

	/* Placeholder matching a nav-btn's footprint — keeps the + centred when a
	 * variant's right-side slot is conditional (e.g. detail without kebab). */
	.nav-btn-placeholder {
		display: block;
		width: 44px;
		height: 44px;
		flex-shrink: 0;
	}

	.badge-dot {
		position: absolute;
		top: 6px;
		right: 6px;
		width: 8px;
		height: 8px;
		background: var(--color-danger);
		border-radius: 50%;
		border: 2px solid var(--bg-glass);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}

	/* Detail-variant kebab dropdown */
	.actions-wrapper { position: relative; }
	.actions-dropdown {
		position: absolute;
		bottom: calc(100% + var(--space-2));
		right: 0;
		background: var(--bg-canvas);
		border-radius: var(--radius-card);
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
		min-width: 180px;
		overflow: hidden;
		z-index: 810;
	}
	.dropdown-item {
		display: block;
		width: 100%;
		text-align: left;
		padding: var(--space-3) var(--space-5);
		background: none;
		border: none;
		border-bottom: 1px solid var(--border-link);
		font-size: var(--text-md);
		font-family: inherit;
		color: var(--text-primary);
		text-decoration: none;
		cursor: pointer;
		white-space: nowrap;
		transition: background 0.1s;
	}
	.dropdown-item:last-child { border-bottom: none; }
	.dropdown-item:hover, .dropdown-item:focus { background: color-mix(in srgb, var(--text-primary) 4%, transparent); outline: none; }
	.dropdown-item--danger { color: var(--color-danger); }
	.dropdown-item--danger:hover { background: color-mix(in srgb, var(--color-danger) 6%, transparent); }

	/* Unified filter sheet: one calm card, three labelled sections. */
	.filter-sheet {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		width: calc(100% - 40px);
		max-width: 360px;
		background: var(--bg-glass);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-radius: var(--radius-card);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.22);
		padding: var(--space-4);
		z-index: 799;
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.filter-sheet-top { top: 76px; }
	.filter-sheet-bottom { bottom: 88px; }

	.filter-section { display: flex; flex-direction: column; gap: var(--space-2); }
	/* Mono eyebrow — dyad's existing editorial label idiom, reused for cohesion. */
	.filter-eyebrow {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-muted);
	}

	.day-row { display: flex; gap: var(--space-1); justify-content: space-between; }
	.day-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		min-height: 2.75rem;
		padding: var(--space-2) 0;
		flex: 1;
		background: color-mix(in srgb, var(--text-primary) 6%, transparent);
		border: none;
		border-radius: var(--radius-input);
		cursor: pointer;
		font-family: inherit;
		color: var(--text-primary);
		transition: background 0.15s, color 0.15s;
	}
	.day-cell.selected { background: var(--text-primary); color: var(--bg-canvas); }
	.day-name { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
	.day-num { font-size: var(--text-base); font-weight: 600; line-height: 1; }

	/* Segmented control — shared by Type and Corner so selection reads identically. */
	.seg { display: flex; gap: var(--space-1); }
	.seg-wrap { flex-wrap: wrap; }
	.seg-btn {
		flex: 1 1 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		padding: var(--space-2) var(--space-3);
		background: color-mix(in srgb, var(--text-primary) 6%, transparent);
		border: none;
		border-radius: var(--radius-input);
		cursor: pointer;
		font-family: inherit;
		font-size: var(--text-sm);
		white-space: nowrap;
		color: var(--text-primary);
		transition: background 0.15s, color 0.15s;
	}
	.seg-btn.selected { background: var(--text-primary); color: var(--bg-canvas); }

	/* Where dropdown — native select styled to match the sheet's calm surface. */
	.filter-select-wrap { position: relative; display: flex; }
	.filter-select {
		appearance: none;
		-webkit-appearance: none;
		width: 100%;
		padding: var(--space-2) var(--space-6) var(--space-2) var(--space-3);
		background: color-mix(in srgb, var(--text-primary) 6%, transparent);
		border: none;
		border-radius: var(--radius-input);
		font-family: inherit;
		font-size: var(--text-sm);
		color: var(--text-primary);
		cursor: pointer;
	}
	.filter-select:focus-visible { outline: 2px solid var(--text-primary); outline-offset: 1px; }
	/* The native option popup ignores the translucent control bg — give it a
	   solid, theme-correct pair so the open list is readable (not light-on-white). */
	.filter-select option { background: var(--bg-canvas); color: var(--text-primary); }
	.filter-select-chevron {
		position: absolute;
		right: var(--space-3);
		top: 50%;
		transform: translateY(-50%);
		color: var(--text-muted);
		pointer-events: none;
	}

	.filter-clear {
		align-self: flex-start;
		margin-top: calc(-1 * var(--space-1));
		padding: 0;
		background: none;
		border: none;
		font-family: inherit;
		font-size: var(--text-sm);
		color: var(--text-muted);
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}
	.filter-clear:hover { color: var(--text-primary); }
	/* Reserve the box so appearing/disappearing never reflows the sheet. */
	.filter-clear.is-hidden { visibility: hidden; pointer-events: none; }

	.clear-dates {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		background: none;
		border: none;
		font-family: inherit;
		font-size: var(--text-sm);
		color: var(--text-muted);
		cursor: pointer;
		padding: var(--space-1) var(--space-2);
		z-index: 799;
	}
	.clear-dates-top { top: 140px; }
	.clear-dates-bottom { bottom: 148px; }
</style>
