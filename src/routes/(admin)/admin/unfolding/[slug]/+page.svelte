<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { JSONContent } from '@tiptap/core';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const entry = $derived(data.entry);

	// The editor holds the working body; the hidden input serializes it on
	// save. Legacy paragraph essays show their paragraphs read-only below —
	// editing those means moving the essay to the body variant deliberately.
	let body = $state<JSONContent | null>((data.entry.body as JSONContent | null) ?? null);
	let bodyDirty = $state(false);

	function handleEditorUpdate(json: JSONContent) {
		body = json;
		bodyDirty = true;
	}

	const legacyParagraphs = $derived(
		Array.isArray(entry.paragraphs) ? (entry.paragraphs as string[]) : []
	);
</script>

<p class="back-row"><a href="/admin/unfolding">← all essays</a></p>
<h1 class="admin-title">{entry.title}</h1>
<p class="admin-subtitle">
	<span class="state state-{entry.state}">{entry.state}</span>
	{#if entry.state === 'published'}
		· <a href="/newsletter/{entry.slug}" target="_blank" rel="noopener">live page</a>
	{/if}
</p>

{#if form?.error}<p class="admin-error">{form.error}</p>{/if}
{#if form?.saved}<p class="admin-saved">Saved.</p>{/if}

<form
	method="POST"
	action="?/save"
	class="panel"
	use:enhance={() =>
		async ({ update }) => {
			bodyDirty = false;
			await update({ reset: false });
			await invalidateAll();
		}}
>
	<div class="field-grid">
		<label>title <input name="title" value={entry.title} required /></label>
		<label>kicker <input name="kicker" value={entry.kicker} /></label>
		<label>dek <input name="dek" value={entry.dek ?? ''} /></label>
		<label>quote <input name="quote" value={entry.quote} /></label>
		<label>quote attribution <input name="quoteAttr" value={entry.quote_attr ?? ''} /></label>
		<label>date <input name="date" type="date" value={entry.date} required /></label>
		<label>hero credit <input name="heroCredit" value={entry.hero_credit ?? ''} /></label>
		<label>hero credit link <input name="heroCreditUrl" value={entry.hero_credit_url ?? ''} /></label>
	</div>
	<input type="hidden" name="heroImage" value={entry.hero_image ?? ''} />
	<input type="hidden" name="body" value={body ? JSON.stringify(body) : ''} />

	<div class="editor-block">
		{#await import('$lib/components/PromptEditor.svelte') then { default: PromptEditor }}
			<PromptEditor
				content={body ?? undefined}
				onUpdate={handleEditorUpdate}
				placeholder="the essay"
			/>
		{/await}
	</div>

	<button type="submit">save{bodyDirty ? ' *' : ''}</button>
</form>

<section class="panel">
	<h2>Hero Image</h2>
	{#if data.heroUrl}
		<img class="hero-preview" src={data.heroUrl} alt="" />
	{:else}
		<p class="muted">None — the page shows the textured placeholder panel.</p>
	{/if}
	<form method="POST" action="?/uploadHero" enctype="multipart/form-data" use:enhance>
		<input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/avif" />
		<button type="submit">upload</button>
	</form>
</section>

{#if legacyParagraphs.length > 0}
	<section class="panel">
		<h2>Legacy Paragraphs</h2>
		<p class="muted">
			This essay is carried by plain paragraphs. They render as-is; writing in the editor above
			and saving switches the page to the editor body.
		</p>
		{#each legacyParagraphs as paragraph}
			<p class="legacy-paragraph">{paragraph}</p>
		{/each}
	</section>
{/if}

{#if data.bodyHtml}
	<section class="panel">
		<h2>Preview</h2>
		<p class="muted">Rendered by the same allowlist renderer as the public page.</p>
		<!-- Safe by construction: renderTiptapToHtml output only. -->
		<div class="preview-body">{@html data.bodyHtml}</div>
	</section>
{/if}

<section class="panel">
	<h2>Publish</h2>
	{#if entry.state === 'published'}
		<form method="POST" action="?/setState" use:enhance>
			<input type="hidden" name="state" value="draft" />
			<button type="submit">unpublish</button>
		</form>
	{:else if data.blockers.length > 0}
		<p class="muted">Not publishable yet:</p>
		<ul class="muted">
			{#each data.blockers as blocker}<li>{blocker}</li>{/each}
		</ul>
	{:else}
		<form method="POST" action="?/setState" use:enhance>
			<input type="hidden" name="state" value="published" />
			<button type="submit">publish</button>
		</form>
	{/if}
</section>

<style>
	.back-row {
		font-size: var(--text-sm);
		margin: 0 0 var(--space-3);
	}
	.admin-title {
		font-size: var(--text-xl);
		font-weight: 500;
		margin: 0 0 var(--space-1);
	}
	.admin-subtitle {
		font-size: var(--text-sm);
		color: var(--text-muted);
		margin: 0 0 var(--space-6);
	}
	.admin-error {
		color: var(--color-danger);
		font-size: var(--text-sm);
	}
	.admin-saved {
		color: var(--text-muted);
		font-size: var(--text-sm);
	}
	.panel {
		padding: var(--space-5);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-card);
		background: var(--bg-canvas);
		margin-bottom: var(--space-5);
	}
	.panel h2 {
		font-size: var(--text-lg);
		font-weight: 500;
		margin: 0 0 var(--space-3);
	}
	.muted {
		color: var(--text-muted);
		font-size: var(--text-sm);
	}
	.state {
		font-size: var(--text-xs);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-pill, 999px);
		padding: 0 var(--space-2);
	}
	.state-published {
		background: var(--bg-accent-soft, #eef7ee);
	}
	.field-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
		gap: var(--space-3);
		margin-bottom: var(--space-4);
	}
	.field-grid label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
	.field-grid input {
		padding: var(--space-2);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input, 6px);
		font-size: var(--text-sm);
	}
	.editor-block {
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input, 6px);
		padding: var(--space-3);
		margin-bottom: var(--space-4);
	}
	.hero-preview {
		max-width: 24rem;
		display: block;
		border-radius: var(--radius-card);
		margin-bottom: var(--space-3);
	}
	.legacy-paragraph {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
	.preview-body :global(p) {
		margin: 0 0 var(--space-3);
	}
</style>
