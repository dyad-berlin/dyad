<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editingVoiceId = $state<string | null>(null);
</script>

<h1 class="admin-title">Unfolding</h1>
<p class="admin-subtitle">Essays and Wiggling voices. Publishing needs no deploy.</p>

{#if form?.error}
	<p class="admin-error">{form.error}</p>
{/if}

<section class="panel">
	<h2>Essays</h2>
	<table class="admin-table">
		<thead>
			<tr><th>Title</th><th>Date</th><th>State</th><th>Last edit</th><th></th></tr>
		</thead>
		<tbody>
			{#each data.entries as entry (entry.slug)}
				<tr>
					<td><a href="/admin/unfolding/{entry.slug}">{entry.title}</a></td>
					<td>{entry.date}</td>
					<td><span class="state state-{entry.state}">{entry.state}</span></td>
					<td class="muted">{entry.updated_by ?? '—'}</td>
					<td>
						<form method="POST" action="?/setEntryState" use:enhance>
							<input type="hidden" name="slug" value={entry.slug} />
							<input
								type="hidden"
								name="state"
								value={entry.state === 'published' ? 'draft' : 'published'}
							/>
							<button type="submit" class="link-btn">
								{entry.state === 'published' ? 'unpublish' : 'publish'}
							</button>
						</form>
					</td>
				</tr>
			{:else}
				<tr><td colspan="5" class="muted">No essays yet.</td></tr>
			{/each}
		</tbody>
	</table>

	<form method="POST" action="?/createEntry" class="inline-form" use:enhance>
		<input name="slug" placeholder="slug-like-this" required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
		<input name="title" placeholder="Title" required />
		<button type="submit">new draft</button>
	</form>
</section>

<section class="panel">
	<h2>Wiggling Voices</h2>
	<table class="admin-table">
		<thead>
			<tr><th>#</th><th>Name</th><th>State</th><th></th><th></th></tr>
		</thead>
		<tbody>
			{#each data.voices as voice (voice.id)}
				<tr>
					<td>{voice.position}</td>
					<td>{voice.name}</td>
					<td>
						<span class="state state-{voice.state}">{voice.state}</span>
						{#if voice.archived_at}<span class="state state-archived">archived</span>{/if}
					</td>
					<td>
						<button
							type="button"
							class="link-btn"
							onclick={() => (editingVoiceId = editingVoiceId === voice.id ? null : voice.id)}
						>
							{editingVoiceId === voice.id ? 'close' : 'edit'}
						</button>
					</td>
					<td class="voice-actions">
						<form method="POST" action="?/setVoiceState" use:enhance>
							<input type="hidden" name="id" value={voice.id} />
							<input
								type="hidden"
								name="state"
								value={voice.state === 'published' ? 'draft' : 'published'}
							/>
							<input type="hidden" name="archived" value={voice.archived_at ? 'true' : 'false'} />
							<button type="submit" class="link-btn">
								{voice.state === 'published' ? 'unpublish' : 'publish'}
							</button>
						</form>
						<form method="POST" action="?/setVoiceState" use:enhance>
							<input type="hidden" name="id" value={voice.id} />
							<input type="hidden" name="archived" value={voice.archived_at ? 'false' : 'true'} />
							<button type="submit" class="link-btn">
								{voice.archived_at ? 'restore' : 'archive'}
							</button>
						</form>
					</td>
				</tr>
				{#if editingVoiceId === voice.id}
					<tr>
						<td colspan="5">
							<form method="POST" action="?/updateVoice" class="voice-form" use:enhance>
								<input type="hidden" name="id" value={voice.id} />
								<input name="name" value={voice.name} placeholder="Name" required />
								<input name="src" value={voice.src} placeholder="voices/name.mp4" required />
								<input name="poster" value={voice.poster} placeholder="voices/name.webp" required />
								<input name="episode" value={voice.episode} placeholder="https://…" required />
								<input name="position" type="number" value={voice.position} required />
								<button type="submit">save</button>
							</form>
						</td>
					</tr>
				{/if}
			{:else}
				<tr><td colspan="5" class="muted">No voices yet.</td></tr>
			{/each}
		</tbody>
	</table>

	<details class="add-voice">
		<summary>add a voice</summary>
		<form method="POST" action="?/createVoice" class="voice-form" use:enhance>
			<input name="name" placeholder="Name" required />
			<input name="src" placeholder="voices/name.mp4 (path in the videos bucket)" required />
			<input name="poster" placeholder="voices/name.webp (path in the assets bucket)" required />
			<input name="episode" placeholder="https://… (link to the full conversation)" required />
			<input name="position" type="number" placeholder="Position" required />
			<button type="submit">add</button>
		</form>
	</details>
</section>

<style>
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
		margin: 0 0 var(--space-4);
	}
	.admin-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}
	.admin-table th {
		text-align: left;
		font-weight: 500;
		color: var(--text-muted);
		padding: var(--space-2);
		border-bottom: 1px solid var(--border-link);
	}
	.admin-table td {
		padding: var(--space-2);
		border-bottom: 1px solid var(--border-link);
		vertical-align: middle;
	}
	.muted {
		color: var(--text-muted);
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
	.state-archived {
		opacity: 0.7;
	}
	.link-btn {
		background: none;
		border: none;
		padding: 0;
		color: var(--text-link, inherit);
		text-decoration: underline;
		cursor: pointer;
		font-size: var(--text-sm);
	}
	.voice-actions {
		display: flex;
		gap: var(--space-3);
	}
	.inline-form,
	.voice-form {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-4);
		flex-wrap: wrap;
	}
	.inline-form input,
	.voice-form input {
		padding: var(--space-2);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input, 6px);
		font-size: var(--text-sm);
	}
	.voice-form input[name='episode'],
	.voice-form input[name='src'],
	.voice-form input[name='poster'] {
		min-width: 16rem;
	}
	.add-voice {
		margin-top: var(--space-4);
		font-size: var(--text-sm);
	}
</style>
