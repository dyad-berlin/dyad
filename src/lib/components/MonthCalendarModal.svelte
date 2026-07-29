<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { getUpcomingDates, SCHEDULING_HORIZON_DAYS, type WeekDate } from '$lib/utils/dates';
	import { copy } from '$lib/copy';

	// Calendar picker modal for days beyond the visible week — opened by the
	// round calendar button at the end of the day rail (publish sheet and the
	// discover When filter share this one component so the two pickers can't
	// drift). A real calendar: Monday-start weekday header, month sections,
	// circular day cells. Each month renders only its selectable span — the
	// current month starts at today, the last month ends at the horizon — so
	// there are no rows of dead, disabled days.
	interface Props {
		selected: Set<string>;
		onToggle: (date: string) => void;
		onClose: () => void;
		/** Marks a day unpickable (e.g. today once no submittable time remains).
		 *  The publish sheet passes its rail's own rule so the two surfaces
		 *  can't disagree; the discover filter leaves every day selectable. */
		isDisabled?: (date: string) => boolean;
		/** At the selection ceiling: unselected days disable (selected ones stay
		 *  togglable-off) and the hint explains why. */
		atCapacity?: boolean;
		/** Shown when atCapacity — e.g. the publish sheet's slot-ceiling hint. */
		capacityHint?: string;
	}

	let { selected, onToggle, onClose, isDisabled, atCapacity = false, capacityHint }: Props = $props();

	const days = getUpcomingDates(SCHEDULING_HORIZON_DAYS);
	const todayKey = days[0].date;

	// Group the horizon's days into month sections, preserving order. The month
	// heading comes from the first day of each group; lead blanks align the
	// first rendered day to its weekday column (Monday-start).
	interface MonthSection {
		name: string;
		lead: number;
		days: WeekDate[];
	}
	const months: MonthSection[] = (() => {
		const sections: MonthSection[] = [];
		let current: MonthSection | null = null;
		let currentKey = '';
		for (const day of days) {
			const monthKey = day.date.slice(0, 7); // YYYY-MM
			if (monthKey !== currentKey) {
				currentKey = monthKey;
				const d = new Date(day.date + 'T12:00:00');
				current = {
					name: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
					// Monday-start offset: JS getDay() is 0=Sun.
					lead: (d.getDay() + 6) % 7,
					days: []
				};
				sections.push(current);
			}
			current!.days.push(day);
		}
		return sections;
	})();

	const WEEKDAY_HEADER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

	let closeButton: HTMLButtonElement | undefined = $state();
	let modalEl: HTMLDivElement | undefined = $state();
	let reducedMotion = $state(false);

	// Esc must close only this modal, not the sheet that may sit under it
	// (PublishSheet listens for Esc on document in the bubble phase). A
	// capture-phase listener runs first; stopPropagation keeps the event from
	// reaching the sheet's handler. Tab is contained inside the dialog so
	// aria-modal is true in behavior, not just markup (the pattern
	// MembershipPaywallModal established).
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			onClose();
			return;
		}
		if (e.key === 'Tab' && modalEl) {
			const focusables = modalEl.querySelectorAll<HTMLElement>('button:not(:disabled)');
			if (focusables.length === 0) return;
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	// Body scroll lock (save/restore, so nesting inside the already-locked
	// publish sheet restores 'hidden') and focus restoration to the element
	// that opened the modal — both mirroring the codebase's other overlays.
	let prevOverflow = '';
	let openerEl: HTMLElement | null = null;

	onMount(async () => {
		openerEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		document.addEventListener('keydown', handleKeydown, true);
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		await tick();
		closeButton?.focus();
	});

	onDestroy(() => {
		document.removeEventListener('keydown', handleKeydown, true);
		document.body.style.overflow = prevOverflow;
		openerEl?.focus();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="cal-backdrop"
	onclick={onClose}
	transition:fade={{ duration: reducedMotion ? 1 : 150 }}
>
	<div
		bind:this={modalEl}
		class="cal-modal"
		role="dialog"
		aria-modal="true"
		aria-label={copy.common.monthAheadTitle}
		onclick={(e) => e.stopPropagation()}
	>
		<div class="cal-head">
			<h3 class="cal-title">{copy.common.monthAheadTitle}</h3>
			<button
				bind:this={closeButton}
				type="button"
				class="cal-close"
				onclick={onClose}
				aria-label={copy.common.close}>&times;</button>
		</div>

		{#each months as month (month.name)}
			<div class="cal-month">
				<div class="cal-month-name">{month.name}</div>
				<div class="cal-grid">
					{#each WEEKDAY_HEADER as w, i (i)}
						<span class="cal-weekday">{w}</span>
					{/each}
					{#each { length: month.lead } as _, i (i)}
						<span class="cal-blank"></span>
					{/each}
					{#each month.days as day (day.date)}
						{@const unpickable =
							(isDisabled?.(day.date) ?? false) || (atCapacity && !selected.has(day.date))}
						<button
							type="button"
							class="cal-day"
							class:selected={selected.has(day.date)}
							class:today={day.date === todayKey}
							aria-pressed={selected.has(day.date)}
							disabled={unpickable}
							onclick={() => onToggle(day.date)}
						>
							{day.dayNum}
						</button>
					{/each}
				</div>
			</div>
		{/each}

		<div class="cal-foot">
			{#if atCapacity && capacityHint}
				<p class="cal-hint">{capacityHint}</p>
			{/if}
			<button type="button" class="cal-done" onclick={onClose}>{copy.common.done}</button>
		</div>
	</div>
</div>

<style>
	.cal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000; /* above the publish sheet (z 900) and the nav pill */
		background: rgba(0, 0, 0, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
	}
	.cal-modal {
		background: var(--bg-canvas);
		border-radius: var(--radius-card);
		box-shadow: 0 8px 40px rgba(0, 0, 0, 0.25);
		width: 100%;
		max-width: 21rem;
		max-height: min(85vh, 40rem);
		overflow-y: auto;
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.cal-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}
	.cal-title {
		font-size: var(--text-lg);
		font-weight: 500;
		margin: 0;
	}
	.cal-close {
		font-size: var(--text-lg);
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 0 var(--space-1);
		line-height: 1;
	}
	.cal-close:hover { color: var(--text-primary); }

	.cal-month {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.cal-month-name {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-muted);
	}
	.cal-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}
	.cal-weekday {
		text-align: center;
		font-size: var(--text-xs);
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding-bottom: 2px;
	}
	.cal-blank { visibility: hidden; }
	.cal-day {
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
		border: none;
		background: none;
		border-radius: 50%;
		color: var(--text-primary);
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s, color 0.15s;
	}
	.cal-day:hover { background: var(--bg-control-hover); }
	.cal-day.selected { background: var(--text-primary); color: var(--bg-canvas); }
	.cal-day.today { box-shadow: inset 0 0 0 1px var(--border-link); }
	.cal-day:focus-visible { outline: 2px solid var(--border-link-hover); outline-offset: 1px; }
	.cal-day:disabled {
		color: var(--text-muted);
		opacity: 0.35;
		cursor: default;
	}
	.cal-day:disabled:hover { background: none; }

	.cal-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		border-top: 1px solid var(--border-subtle);
		padding-top: var(--space-3);
	}
	.cal-hint {
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin: 0;
	}
	.cal-done:only-child { margin-left: auto; }
	.cal-done {
		font-size: var(--text-sm);
		padding: var(--space-2) var(--space-4);
		border: 1px solid var(--text-primary);
		border-radius: var(--radius-input);
		background: var(--text-primary);
		color: var(--bg-canvas);
		cursor: pointer;
		font-family: inherit;
	}

	@media (prefers-reduced-motion: reduce) {
		.cal-day { transition: none; }
	}
</style>
