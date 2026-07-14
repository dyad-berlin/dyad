<script lang="ts">
	let { form } = $props();
</script>

<svelte:head><title>Choose Your Name</title></svelte:head>

<main class="enter">
	<h1>Choose Your Name</h1>

	<p class="lede">You're invited. Pick the name other members will see.</p>

	<form method="POST">
		<input
			name="username"
			type="text"
			autocomplete="off"
			autocapitalize="none"
			spellcheck="false"
			required
			minlength="3"
			maxlength="30"
			placeholder="username"
			value={form?.username ?? ''}
		/>
		<button type="submit">join</button>
	</form>

	{#if form?.error}<p class="message">{form.error}</p>{/if}
</main>

<style>
	.enter { max-width: 32rem; margin: 2rem auto; padding: var(--space-6); }
	.lede { color: var(--text-secondary); }
	form { display: flex; gap: var(--space-2); margin-top: var(--space-5); }
	input {
		flex: 1;
		padding: var(--space-2) var(--space-3);
		background: var(--bg-canvas);
		color: var(--text-primary);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input);
	}
	input::placeholder { color: var(--text-muted); }
	button { cursor: pointer; padding: var(--space-2) var(--space-3); }
	.message { color: var(--color-danger); }
</style>
