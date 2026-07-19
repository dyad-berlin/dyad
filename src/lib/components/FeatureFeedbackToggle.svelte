<script lang="ts">
	import { copy } from '$lib/copy';

	let { signalId, initialVisible }: { signalId: string; initialVisible: boolean } = $props();

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

<div class="feature-toggle">
	<label class="feature-toggle-row">
		<input type="checkbox" checked={visible} onchange={toggle} disabled={saving} />
		<span>{visible ? copy.feedback.featuredBadge : copy.feedback.featureToggleLabel}</span>
	</label>
	<p class="feature-toggle-hint">{copy.feedback.featureToggleHint}</p>
	{#if error}<p class="feature-toggle-error">{error}</p>{/if}
</div>

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
</style>
