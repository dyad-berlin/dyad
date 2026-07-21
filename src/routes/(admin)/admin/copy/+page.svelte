<script lang="ts">
	import type { PageData } from './$types';
	import { validateOverride, MAX_OVERRIDE_LENGTH } from '$lib/copy-meta';
	import { invalidateAll } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let search = $state('');
	let openKey = $state<string | null>(null);
	let draft = $state('');
	let expectedUpdatedAt = $state<string | null>(null);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);

	const query = $derived(search.trim().toLowerCase());

	const visibleSections = $derived(
		data.sections
			.map((section) => ({
				...section,
				leaves: query
					? section.leaves.filter(
							(l) =>
								l.key.toLowerCase().includes(query) ||
								l.defaultValue.toLowerCase().includes(query) ||
								(l.override?.value ?? '').toLowerCase().includes(query)
						)
					: section.leaves
			}))
			.filter((section) => section.leaves.length > 0)
	);

	const overrideCount = $derived(
		data.sections.flatMap((s) => s.leaves).filter((l) => l.override).length
	);

	// Sections whose strings also feed transactional emails — overrides do
	// NOT apply there (email templates read the typed defaults).
	const EMAIL_SECTIONS = new Set(['email']);

	function openEditor(key: string, current: string, updatedAt: string | null) {
		openKey = key;
		draft = current;
		expectedUpdatedAt = updatedAt;
		error = null;
		notice = null;
	}

	const draftErrors = $derived(openKey ? validateOverride(openKey, draft) : []);

	async function save() {
		if (!openKey || saving || draftErrors.length > 0) return;
		saving = true;
		error = null;
		try {
			const res = await fetch('/admin/copy/api', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key: openKey, value: draft, expectedUpdatedAt })
			});
			const body = await res.json().catch(() => ({}));
			if (res.ok) {
				notice = 'Saved. Live within about a minute.';
				openKey = null;
				await invalidateAll();
			} else {
				error = body.error ?? 'Failed to save.';
			}
		} catch {
			error = 'Network error.';
		} finally {
			saving = false;
		}
	}

	async function revert(key: string) {
		if (saving) return;
		if (!confirm('Remove this override and return to the default wording?')) return;
		saving = true;
		error = null;
		try {
			const res = await fetch('/admin/copy/api', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key })
			});
			const body = await res.json().catch(() => ({}));
			if (res.ok) {
				notice = 'Reverted to default.';
				if (openKey === key) openKey = null;
				await invalidateAll();
			} else {
				error = body.error ?? 'Failed to revert.';
			}
		} catch {
			error = 'Network error.';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>copy · admin</title>
</svelte:head>

<div class="copy-admin">
	<header class="head">
		<div>
			<h1>Copy</h1>
			<p class="subtitle">
				Edit user-facing wording without a deploy. Changes appear on the site within about a
				minute. {overrideCount} override{overrideCount === 1 ? '' : 's'} active.
			</p>
		</div>
		<input
			type="search"
			placeholder="search keys, defaults, overrides…"
			bind:value={search}
			class="search"
		/>
	</header>

	{#if notice}<p class="notice">{notice}</p>{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}

	{#if data.orphans.length > 0}
		<section class="orphans">
			<h2>Orphaned overrides</h2>
			<p class="hint">
				These override copy keys that no longer exist (renamed or removed in a deploy). They do
				nothing — delete them, or keep them if a rollback is expected.
			</p>
			{#each data.orphans as orphan (orphan.key)}
				<div class="orphan-row">
					<code>{orphan.key}</code>
					<span class="orphan-value">{orphan.value}</span>
					<button class="btn-small" onclick={() => revert(orphan.key)}>delete</button>
				</div>
			{/each}
		</section>
	{/if}

	{#each visibleSections as section (section.path)}
		<section class="copy-section">
			<h2><code>{section.path}</code></h2>
			{#if section.description}<p class="hint">{section.description}</p>{/if}
			{#if section.routes.length > 0}
				<p class="routes">appears on: {section.routes.join(' · ')}</p>
			{/if}
			{#if EMAIL_SECTIONS.has(section.path)}
				<p class="email-note">
					Transactional emails use the built-in defaults — overrides here do not change sent
					email.
				</p>
			{/if}

			{#each section.leaves as leaf (leaf.key)}
				<div class="leaf" class:overridden={!!leaf.override}>
					<div class="leaf-head">
						<code class="leaf-key">{leaf.key.slice(section.path.length + 1)}</code>
						{#if !leaf.editable}
							<span class="tag tag-fn">requires an engineer</span>
						{:else if leaf.override}
							<span class="tag tag-live">overridden</span>
						{/if}
						{#if leaf.editable && !leaf.adopted}
							<span class="tag tag-unwired" title="This key is not yet wired to the copy runtime — an override will not show on the site until an engineer adopts it.">not yet wired</span>
						{/if}
					</div>

					{#if leaf.editable}
						<p class="default-value">
							<span class="label">default</span>
							{leaf.defaultValue === '' ? '(empty)' : leaf.defaultValue}
						</p>
						{#if leaf.override && openKey !== leaf.key}
							<p class="override-value">
								<span class="label">override</span>
								{leaf.override.value === '' ? '(empty)' : leaf.override.value}
								<span class="meta">
									— {leaf.override.updatedBy ?? 'unknown'},
									{new Date(leaf.override.updatedAt).toLocaleString()}
								</span>
							</p>
						{/if}

						{#if openKey === leaf.key}
							<div class="editor">
								<textarea bind:value={draft} rows="3" maxlength={MAX_OVERRIDE_LENGTH + 1}></textarea>
								{#each draftErrors as e (e.code + ('token' in e ? e.token : ''))}
									<p class="error">{e.message}</p>
								{/each}
								<div class="editor-actions">
									<button class="btn-primary-sm" onclick={save} disabled={saving || draftErrors.length > 0}>
										{saving ? 'saving…' : 'save'}
									</button>
									<button class="btn-small" onclick={() => (openKey = null)}>cancel</button>
								</div>
							</div>
						{:else}
							<div class="leaf-actions">
								<button
									class="btn-small"
									onclick={() =>
										openEditor(
											leaf.key,
											leaf.override?.value ?? leaf.defaultValue,
											leaf.override?.updatedAt ?? null
										)}
								>
									edit
								</button>
								{#if leaf.override}
									<button class="btn-small" onclick={() => revert(leaf.key)}>revert to default</button>
								{/if}
							</div>
						{/if}
					{:else}
						<p class="default-value fn">{leaf.defaultValue.split('\n')[0]}</p>
					{/if}
				</div>
			{/each}
		</section>
	{/each}
</div>

<style>
	.copy-admin {
		max-width: 860px;
	}
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 24px;
	}
	h1 {
		margin: 0 0 4px;
	}
	.subtitle,
	.hint,
	.routes {
		color: var(--text-muted, #666);
		font-size: 0.875rem;
		margin: 0 0 4px;
	}
	.routes {
		font-family: monospace;
		font-size: 0.75rem;
	}
	.search {
		min-width: 280px;
		padding: 8px 12px;
	}
	.notice {
		color: var(--color-success, #2e7d32);
	}
	.error {
		color: var(--color-danger, #c62828);
		margin: 4px 0;
	}
	.orphans {
		border: 1px solid var(--color-danger, #c62828);
		border-radius: 8px;
		padding: 12px 16px;
		margin-bottom: 24px;
	}
	.orphan-row {
		display: flex;
		gap: 12px;
		align-items: baseline;
		padding: 4px 0;
	}
	.orphan-value {
		color: var(--text-muted, #666);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}
	.copy-section {
		margin-bottom: 28px;
		border-top: 1px solid var(--border-link, #ddd);
		padding-top: 12px;
	}
	.copy-section h2 {
		font-size: 1rem;
		margin: 0 0 2px;
	}
	.email-note {
		font-size: 0.8rem;
		font-style: italic;
		color: var(--text-muted, #666);
	}
	.leaf {
		padding: 10px 0 10px 12px;
		border-left: 2px solid transparent;
	}
	.leaf.overridden {
		border-left-color: var(--color-success, #2e7d32);
	}
	.leaf-head {
		display: flex;
		gap: 8px;
		align-items: baseline;
	}
	.leaf-key {
		font-weight: 600;
	}
	.tag {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 1px 6px;
		border-radius: 4px;
		border: 1px solid currentColor;
	}
	.tag-fn {
		color: var(--text-muted, #888);
	}
	.tag-live {
		color: var(--color-success, #2e7d32);
	}
	.tag-unwired {
		color: var(--color-warning, #b26a00);
	}
	.default-value,
	.override-value {
		margin: 4px 0;
		font-size: 0.9rem;
		white-space: pre-wrap;
	}
	.default-value.fn {
		color: var(--text-muted, #888);
		font-family: monospace;
		font-size: 0.75rem;
	}
	.label {
		display: inline-block;
		min-width: 64px;
		font-family: monospace;
		font-size: 0.7rem;
		text-transform: uppercase;
		color: var(--text-muted, #888);
	}
	.meta {
		color: var(--text-muted, #888);
		font-size: 0.75rem;
	}
	.editor textarea {
		width: 100%;
		font: inherit;
		padding: 8px;
	}
	.editor-actions,
	.leaf-actions {
		display: flex;
		gap: 8px;
		margin-top: 4px;
	}
	.btn-small,
	.btn-primary-sm {
		font-size: 0.8rem;
		padding: 3px 10px;
		cursor: pointer;
	}
</style>
