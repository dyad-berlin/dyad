<script lang="ts">
	import type { Snippet } from 'svelte';
	import { copy } from '$lib/copy';

	let {
		signalId,
		initialVisible,
		compact = false,
		children
	}: {
		signalId: string;
		initialVisible: boolean;
		/** Bare checkbox + label row, no hint/border — for a dense list (the
		 *  preferences page). Default is the fuller card variant used inline
		 *  on a revealed-feedback card (/feedback/[id], /meetings/[id]). */
		compact?: boolean;
		/** Compact mode only: custom label content (e.g. the quote itself)
		 *  instead of the default "Feature this on your profile" text. */
		children?: Snippet;
	} = $props();

	let visible = $state(initialVisible);
	let saving = $state(false);
	let error = $state('');

	async function toggle() {
		if (saving) return;
		const next = !visible;
		saving = true;
		error = '';
		try {
			const res = await fetch(`/api/reputation-signals/${signalId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ visible: next })
			});
			if (res.ok) {
				visible = next;
			} else {
				error = copy.feedback.featureError;
			}
		} catch {
			error = copy.feedback.featureError;
		} finally {
			saving = false;
		}
	}
</script>

{#if compact}
	<label class="feature-row-compact">
		<input type="checkbox" checked={visible} onchange={toggle} disabled={saving} />
		{#if children}
			{@render children()}
		{:else}
			<span>{visible ? copy.feedback.featuredBadge : copy.feedback.featureToggleLabel}</span>
		{/if}
	</label>
	{#if error}<p class="feature-row-error">{error}</p>{/if}
{:else}
	<div class="feature-toggle">
		<label class="feature-toggle-row">
			<input type="checkbox" checked={visible} onchange={toggle} disabled={saving} />
			<span>{visible ? copy.feedback.featuredBadge : copy.feedback.featureToggleLabel}</span>
		</label>
		<p class="feature-toggle-hint">{copy.feedback.featureToggleHint}</p>
		{#if error}<p class="feature-toggle-error">{error}</p>{/if}
	</div>
{/if}

<style>
	.feature-toggle {
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border-link);
	}

	.feature-toggle-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
		font-size: var(--text-sm);
		color: var(--text-primary);
	}

	.feature-toggle-row input {
		width: 16px;
		height: 16px;
		accent-color: var(--color-success);
		cursor: pointer;
	}

	.feature-toggle-hint {
		margin: var(--space-1) 0 0 24px;
		font-size: var(--text-xs);
		color: var(--text-muted);
	}

	.feature-toggle-error {
		margin: var(--space-1) 0 0 24px;
		font-size: var(--text-xs);
		color: var(--color-danger);
	}

	/* ── Compact: one dense row, no hint/border (preferences page) ── */
	.feature-row-compact {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		cursor: pointer;
	}

	.feature-row-compact input {
		width: var(--space-4);
		height: var(--space-4);
		margin-top: 2px;
		accent-color: var(--text-primary);
		cursor: pointer;
		flex-shrink: 0;
	}

	.feature-row-error {
		margin: var(--space-1) 0 0 calc(var(--space-4) + var(--space-3));
		font-size: var(--text-xs);
		color: var(--color-danger);
	}
</style>
