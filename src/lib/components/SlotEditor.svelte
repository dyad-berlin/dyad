<script lang="ts">
	import { slide } from 'svelte/transition';
	import SlotCard from './SlotCard.svelte';
	import LocationSearch from './LocationSearch.svelte';
	import { copy } from '$lib/copy';
	import { getWeekDates, formatHybridDate } from '$lib/utils/dates.js';
	import type { LocationRef, TimeSlot } from '$lib/domain/types';

	// Slot shape extends TimeSlot with author-only fields the loader provides.
	// exact_location: full LocationRef (the author's own slot, RLS allows full read).
	// pending_invitation_inviter_username: nullable; non-null when there's a
	// pending invitation on this slot — drives the warn-before-mutate confirm.
	type EditableSlot = TimeSlot & {
		exact_location?: LocationRef | null;
		pending_invitation_inviter_username?: string | null;
	};

	interface Props {
		slots: EditableSlot[];
		promptId: string;
		onSlotsChanged?: () => void | Promise<void>;
	}

	let { slots, promptId, onSlotsChanged }: Props = $props();

	// State machine:
	// - idle: showing slot list + maybe "+ add" row
	// - adding: form rendered in place of "+ add" row
	// - editing: form rendered in place of the slot card with id === editingSlotId
	// Plus a pendingConfirm overlay when an action would withdraw a pending invitation.
	let mode = $state<'idle' | 'adding' | 'editing'>('idle');
	let editingSlotId = $state<string | null>(null);
	let pendingConfirm = $state<
		| { kind: 'edit'; slotId: string; inviter: string }
		| { kind: 'remove'; slotId: string; inviter: string }
		| null
	>(null);

	interface SlotDraft {
		date: string; // 'YYYY-MM-DD'
		time: string; // 'HH:MM'
		duration: number;
		location: LocationRef | null;
	}

	let formDraft = $state<SlotDraft | null>(null);
	let saving = $state(false);
	let error = $state<string | null>(null);

	const weekDates = getWeekDates();

	// Time options: 7:00 AM to 10:00 PM in 30-min increments. Lifted from the
	// existing PublishSheet defaults so authors land on the same value space.
	const timeOptions = (() => {
		const options: { value: string; label: string }[] = [];
		for (let h = 7; h <= 22; h++) {
			for (const m of [0, 30]) {
				if (h === 22 && m === 30) continue;
				const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
				const hour = h % 12 || 12;
				const ampm = h < 12 ? 'AM' : 'PM';
				options.push({ value, label: `${hour}:${m.toString().padStart(2, '0')} ${ampm}` });
			}
		}
		return options;
	})();

	const DEFAULT_TIME = '09:00';
	const DEFAULT_DURATION = 60;

	function startAdd() {
		formDraft = {
			date: weekDates[0].date,
			time: DEFAULT_TIME,
			duration: DEFAULT_DURATION,
			location: null
		};
		mode = 'adding';
		editingSlotId = null;
		error = null;
	}

	function startEdit(slot: EditableSlot) {
		const start = new Date(slot.start_time);
		// Local date in the same sv-SE format weekDates uses.
		const date = start.toLocaleDateString('sv-SE');
		const time = `${start.getHours().toString().padStart(2, '0')}:${start
			.getMinutes()
			.toString()
			.padStart(2, '0')}`;
		formDraft = {
			date,
			time,
			duration: slot.duration_minutes,
			location: slot.exact_location ?? null
		};
		mode = 'editing';
		editingSlotId = slot.id;
		error = null;
	}

	function cancelForm() {
		mode = 'idle';
		editingSlotId = null;
		formDraft = null;
		error = null;
	}

	function isDraftValid(d: SlotDraft | null): d is SlotDraft & { location: LocationRef } {
		if (!d || !d.location) return false;
		const startTime = new Date(`${d.date}T${d.time}`);
		if (isNaN(startTime.getTime())) return false;
		const now = new Date();
		const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
		return startTime > now && startTime <= sevenDays;
	}

	const draftValid = $derived(isDraftValid(formDraft));

	async function saveAdd() {
		if (!isDraftValid(formDraft)) return;
		saving = true;
		error = null;
		try {
			const start = new Date(`${formDraft.date}T${formDraft.time}`);
			const res = await fetch(`/api/prompts/${promptId}/slots`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					add: [
						{
							start_time: start.toISOString(),
							duration_minutes: formDraft.duration,
							location: formDraft.location
						}
					]
				})
			});
			if (!res.ok) {
				const e = (await res.json().catch(() => ({}))) as { error?: string };
				error = e.error ?? copy.common.genericError;
				saving = false;
				return;
			}
			cancelForm();
			saving = false;
			await onSlotsChanged?.();
		} catch {
			error = copy.common.networkError;
			saving = false;
		}
	}

	async function saveEdit() {
		if (!isDraftValid(formDraft) || !editingSlotId) return;
		const slot = slots.find((s) => s.id === editingSlotId);
		const inviter = slot?.pending_invitation_inviter_username;
		if (inviter) {
			pendingConfirm = { kind: 'edit', slotId: editingSlotId, inviter };
			return;
		}
		await commitEdit();
	}

	async function commitEdit() {
		if (!isDraftValid(formDraft) || !editingSlotId) return;
		saving = true;
		error = null;
		try {
			const start = new Date(`${formDraft.date}T${formDraft.time}`);
			const res = await fetch(`/api/prompts/${promptId}/slots`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					edit: [
						{
							slotId: editingSlotId,
							updates: {
								start_time: start.toISOString(),
								duration_minutes: formDraft.duration,
								location: formDraft.location
							}
						}
					]
				})
			});
			if (!res.ok) {
				const e = (await res.json().catch(() => ({}))) as { error?: string };
				error = e.error ?? copy.common.genericError;
				saving = false;
				pendingConfirm = null;
				return;
			}
			pendingConfirm = null;
			cancelForm();
			saving = false;
			await onSlotsChanged?.();
		} catch {
			error = copy.common.networkError;
			saving = false;
			pendingConfirm = null;
		}
	}

	async function startRemove(slot: EditableSlot) {
		if (slot.pending_invitation_inviter_username) {
			pendingConfirm = {
				kind: 'remove',
				slotId: slot.id,
				inviter: slot.pending_invitation_inviter_username
			};
			return;
		}
		await commitRemove(slot.id);
	}

	async function commitRemove(slotId: string) {
		saving = true;
		error = null;
		try {
			const res = await fetch(`/api/prompts/${promptId}/slots`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ remove: [slotId] })
			});
			if (!res.ok) {
				const e = (await res.json().catch(() => ({}))) as { error?: string };
				error = e.error ?? copy.common.genericError;
				saving = false;
				pendingConfirm = null;
				return;
			}
			pendingConfirm = null;
			saving = false;
			await onSlotsChanged?.();
		} catch {
			error = copy.common.networkError;
			saving = false;
			pendingConfirm = null;
		}
	}

	function dismissPendingConfirm() {
		pendingConfirm = null;
	}

	const showAddRow = $derived(mode !== 'adding' && slots.length < 3);
</script>

<div class="slot-editor">
	{#each slots as slot (slot.id)}
		{#if mode === 'editing' && editingSlotId === slot.id && formDraft}
			<div class="slot-form" transition:slide={{ duration: 150 }}>
				{#if pendingConfirm?.kind === 'edit' && pendingConfirm.slotId === slot.id}
					<div class="pending-confirm" role="alertdialog">
						<p>{copy.conversation.editSlotPendingWarn(pendingConfirm.inviter)}</p>
						<div class="confirm-actions">
							<button type="button" class="link-btn" onclick={dismissPendingConfirm}>
								{copy.common.cancel}
							</button>
							<button
								type="button"
								class="link-btn link-btn--danger"
								onclick={commitEdit}
								disabled={saving}
							>
								{copy.conversation.editSlotConfirm}
							</button>
						</div>
					</div>
				{:else}
					<div class="form-row form-days">
						{#each weekDates as day}
							<button
								type="button"
								class="day-cell"
								class:selected={formDraft.date === day.date}
								onclick={() => (formDraft && (formDraft.date = day.date))}
							>
								<span class="day-name">{day.dayShort.toUpperCase()}</span>
								<span class="day-num">{day.dayNum}</span>
							</button>
						{/each}
					</div>
					<div class="form-row form-time-row">
						<select class="form-select" bind:value={formDraft.time}>
							{#each timeOptions as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
						<select class="form-select" bind:value={formDraft.duration}>
							<option value={30}>30 min</option>
							<option value={45}>45 min</option>
							<option value={60}>1 hour</option>
							<option value={90}>1.5 hours</option>
						</select>
					</div>
					<LocationSearch
						value={formDraft.location}
						onChange={(loc) => (formDraft && (formDraft.location = loc))}
						placeholder={copy.editor.locationPlaceholder}
					/>
					{#if error}
						<p class="form-error" role="alert">{error}</p>
					{/if}
					<div class="form-actions">
						<button type="button" class="link-btn" onclick={cancelForm} disabled={saving}>
							{copy.common.cancel}
						</button>
						<button
							type="button"
							class="btn-primary btn-primary--sm"
							onclick={saveEdit}
							disabled={!draftValid || saving}
						>
							{saving ? copy.common.loading : copy.common.save}
						</button>
					</div>
				{/if}
			</div>
		{:else if slot.accepted}
			<div class="slot-row" transition:slide={{ duration: 150 }}>
				<SlotCard
					startTime={slot.start_time}
					durationMinutes={slot.duration_minutes}
					area={slot.general_area}
					exactLocation={slot.exact_location ?? null}
					invited
					invitedNote={copy.conversation.myOfferedTimesBooked}
				/>
			</div>
		{:else}
			<div class="slot-row" transition:slide={{ duration: 150 }}>
				{#if pendingConfirm?.kind === 'remove' && pendingConfirm.slotId === slot.id}
					<div class="pending-confirm" role="alertdialog">
						<p>{copy.conversation.removeSlotPendingWarn(pendingConfirm.inviter)}</p>
						<div class="confirm-actions">
							<button type="button" class="link-btn" onclick={dismissPendingConfirm}>
								{copy.common.cancel}
							</button>
							<button
								type="button"
								class="link-btn link-btn--danger"
								onclick={() => commitRemove(slot.id)}
								disabled={saving}
							>
								{copy.conversation.removeSlotConfirm}
							</button>
						</div>
					</div>
				{:else}
					<SlotCard
						startTime={slot.start_time}
						durationMinutes={slot.duration_minutes}
						area={slot.general_area}
						exactLocation={slot.exact_location ?? null}
					/>
					<div class="slot-actions">
						<button
							type="button"
							class="link-btn"
							onclick={() => startEdit(slot)}
							disabled={mode !== 'idle' || saving}
						>
							{copy.common.edit}
						</button>
						<button
							type="button"
							class="link-btn link-btn--danger"
							aria-label={copy.conversation.removeSlot(slot.general_area)}
							onclick={() => startRemove(slot)}
							disabled={mode !== 'idle' || saving}
						>
							×
						</button>
					</div>
				{/if}
			</div>
		{/if}
	{/each}

	{#if mode === 'adding' && formDraft}
		<div class="slot-form" transition:slide={{ duration: 150 }}>
			<div class="form-row form-days">
				{#each weekDates as day}
					<button
						type="button"
						class="day-cell"
						class:selected={formDraft.date === day.date}
						onclick={() => (formDraft && (formDraft.date = day.date))}
					>
						<span class="day-name">{day.dayShort.toUpperCase()}</span>
						<span class="day-num">{day.dayNum}</span>
					</button>
				{/each}
			</div>
			<div class="form-row form-time-row">
				<select class="form-select" bind:value={formDraft.time}>
					{#each timeOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				<select class="form-select" bind:value={formDraft.duration}>
					<option value={30}>30 min</option>
					<option value={45}>45 min</option>
					<option value={60}>1 hour</option>
					<option value={90}>1.5 hours</option>
				</select>
			</div>
			<LocationSearch
				value={formDraft.location}
				onChange={(loc) => (formDraft && (formDraft.location = loc))}
				placeholder={copy.editor.locationPlaceholder}
			/>
			{#if error}
				<p class="form-error" role="alert">{error}</p>
			{/if}
			<div class="form-actions">
				<button type="button" class="link-btn" onclick={cancelForm} disabled={saving}>
					{copy.common.cancel}
				</button>
				<button
					type="button"
					class="btn-primary btn-primary--sm"
					onclick={saveAdd}
					disabled={!draftValid || saving}
				>
					{saving ? copy.common.loading : copy.common.save}
				</button>
			</div>
		</div>
	{/if}

	{#if showAddRow}
		<button type="button" class="add-row" onclick={startAdd} transition:slide={{ duration: 150 }}>
			{copy.conversation.addATime}
		</button>
	{/if}
</div>

<style>
	.slot-editor {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.slot-row {
		position: relative;
		display: flex;
		align-items: stretch;
		gap: var(--space-2);
	}

	/* SlotCard takes full width inside the row; actions sit beside it. */
	.slot-row :global(.slot-card) { flex: 1; margin-bottom: 0; }

	.slot-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding-bottom: var(--space-3);
	}

	.link-btn {
		font-size: var(--text-sm);
		color: var(--text-muted);
		background: none;
		border: none;
		padding: var(--space-1) var(--space-2);
		cursor: pointer;
		font-family: inherit;
		line-height: var(--leading-tight);
	}
	.link-btn:hover { color: var(--text-primary); }
	.link-btn:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }

	.link-btn--danger { color: var(--text-muted); font-size: var(--text-md); }
	.link-btn--danger:hover { color: var(--color-danger); }

	/* Add row reads like a placeholder slot card — same dimensions, same
	   border-radius, dashed border to mark "empty content waiting to be
	   filled." When clicked, morphs into the inline form. */
	.add-row {
		display: block;
		width: 100%;
		padding: var(--space-4);
		border: 1px dashed var(--border-link);
		border-radius: var(--radius-card);
		background: none;
		text-align: left;
		font-family: inherit;
		font-size: var(--text-sm);
		font-style: italic;
		color: var(--text-muted);
		cursor: pointer;
		margin-bottom: var(--space-3);
	}
	.add-row:hover { border-color: var(--text-primary); color: var(--text-primary); }

	/* Inline form — matches SlotCard's outer dimensions so the morph reads as
	   "the same content slot in input mode." */
	.slot-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-card);
		margin-bottom: var(--space-3);
		box-sizing: border-box;
	}

	.form-row {
		display: flex;
		gap: var(--space-2);
	}

	.form-days {
		flex-wrap: wrap;
	}

	.day-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: var(--space-2) 0;
		flex: 1 0 calc(14% - var(--space-2));
		min-width: 42px;
		background: none;
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input);
		cursor: pointer;
		font-family: inherit;
		color: var(--text-primary);
		transition: background 0.15s, color 0.15s, border-color 0.15s;
	}
	.day-cell.selected {
		background: var(--text-primary);
		color: var(--bg-canvas);
		border-color: var(--text-primary);
	}
	.day-name { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.04em; }
	.day-num { font-size: var(--text-md); font-weight: 600; line-height: 1; }

	.form-time-row { flex-wrap: wrap; }
	.form-time-row .form-select { flex: 1 1 140px; }

	.form-select {
		font-size: var(--text-sm);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input);
		background: transparent;
		color: var(--text-primary);
		font-family: inherit;
	}

	.form-error {
		font-size: var(--text-sm);
		color: var(--color-danger);
		margin: 0;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}

	/* Pending-invitation confirm — replaces the form (or the card) inline so
	   the warning sits exactly where the action was taken. Quiet visual
	   register; no modal layer. */
	.pending-confirm {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--text-muted);
		border-radius: var(--radius-card);
		margin-bottom: var(--space-3);
		background: var(--bg-canvas);
		flex: 1;
	}
	.pending-confirm p { margin: 0; font-size: var(--text-sm); color: var(--text-primary); }

	.confirm-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}
</style>
