<script lang="ts">
	import { copy } from '$lib/copy';
	import type { SafetyConcernKind, SafetyConcernScope } from '$lib/domain/types';

	// A quiet, self-contained confidential-concern affordance (R5). Scoped to a
	// specific person or to the meeting as a whole. Submits on its own — decoupled
	// from the main form's "done" — so raising a concern never feels like the
	// headline step. The concern channel is confidential: content is written to
	// safety_concerns (no authenticated read) and reaches only a steward.
	let {
		slotId,
		gatheringId,
		scope,
		subjectId = null,
		name = null
	}: {
		slotId: string;
		gatheringId: string;
		scope: SafetyConcernScope;
		subjectId?: string | null;
		name?: string | null;
	} = $props();

	let open = $state(false);
	let kind = $state<SafetyConcernKind | null>(null);
	let detail = $state('');
	let submitting = $state(false);
	let sent = $state(false);
	let error = $state('');

	// Person-scoped concerns can name a no-show; a meeting-scoped one cannot.
	const kinds = $derived<{ value: SafetyConcernKind; label: string }[]>(
		scope === 'person'
			? [
					{ value: 'no_show', label: copy.gatheringFeedback.concernKindNoShow },
					{ value: 'felt_unsafe', label: copy.gatheringFeedback.concernKindUnsafe },
					{ value: 'other', label: copy.gatheringFeedback.concernKindOther }
				]
			: [
					{ value: 'felt_unsafe', label: copy.gatheringFeedback.concernKindUnsafe },
					{ value: 'other', label: copy.gatheringFeedback.concernKindOther }
				]
	);

	async function submit() {
		if (submitting || kind === null) return;
		submitting = true;
		error = '';
		try {
			const res = await fetch('/api/feedback/gathering/concern', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					slot_id: slotId,
					gathering_id: gatheringId,
					scope,
					subject_id: scope === 'person' ? subjectId : undefined,
					kind,
					detail: detail.trim() || undefined
				})
			});
			if (res.ok) {
				sent = true;
				open = false;
			} else {
				error = copy.common.submitFailed;
			}
		} catch {
			error = copy.common.networkError;
		} finally {
			submitting = false;
		}
	}
</script>

{#if sent}
	<p class="concern-sent">{copy.gatheringFeedback.concernSaved}</p>
{:else if !open}
	<button type="button" class="concern-toggle" onclick={() => (open = true)}>
		{scope === 'person'
			? copy.gatheringFeedback.concernLink
			: copy.gatheringFeedback.concernAboutMeeting}
	</button>
{:else}
	<div class="concern-panel">
		<p class="concern-note">{copy.gatheringFeedback.concernNote}</p>
		<div class="concern-kinds">
			{#each kinds as k}
				<button
					type="button"
					class="concern-kind"
					class:selected={kind === k.value}
					onclick={() => (kind = k.value)}
				>{k.label}</button>
			{/each}
		</div>
		<textarea
			bind:value={detail}
			rows={2}
			placeholder={copy.gatheringFeedback.concernDetailPlaceholder}
			maxlength={2000}
		></textarea>
		{#if error}<p class="concern-error">{error}</p>{/if}
		<div class="concern-actions">
			<button type="button" class="concern-cancel" onclick={() => (open = false)}>
				{copy.gatheringFeedback.concernCancel}
			</button>
			<button
				type="button"
				class="concern-submit"
				onclick={submit}
				disabled={submitting || kind === null}
			>
				{submitting ? copy.gatheringFeedback.submitting : copy.gatheringFeedback.submit}
			</button>
		</div>
	</div>
{/if}

<style>
	.concern-toggle,
	.concern-cancel {
		background: none;
		border: none;
		padding: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
		text-decoration: underline;
		cursor: pointer;
	}
	.concern-toggle:hover,
	.concern-cancel:hover {
		color: var(--text-primary);
	}

	.concern-panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: var(--space-2);
		padding: var(--space-3);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input);
	}
	.concern-note {
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin: 0;
	}
	.concern-kinds {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.concern-kind {
		font-size: var(--text-sm);
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-card);
		background: none;
		color: var(--text-primary);
		cursor: pointer;
	}
	.concern-kind:hover {
		border-color: var(--text-primary);
	}
	.concern-kind.selected {
		background: var(--text-primary);
		color: var(--bg-canvas);
		border-color: var(--text-primary);
	}
	.concern-panel textarea {
		font-size: var(--text-base);
		padding: var(--space-2);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input);
		background: transparent;
		color: var(--text-primary);
		resize: vertical;
		line-height: 1.6;
		width: 100%;
		box-sizing: border-box;
	}
	.concern-panel textarea:focus {
		outline: none;
		border-color: var(--text-muted);
	}
	.concern-error {
		font-size: var(--text-sm);
		color: var(--color-danger);
		margin: 0;
	}
	.concern-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.concern-submit {
		font-size: var(--text-sm);
		padding: var(--space-2) var(--space-4);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input);
		background: none;
		color: var(--text-primary);
		cursor: pointer;
	}
	.concern-submit:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.concern-sent {
		font-size: var(--text-sm);
		color: var(--text-muted);
		margin: 0;
	}
</style>
