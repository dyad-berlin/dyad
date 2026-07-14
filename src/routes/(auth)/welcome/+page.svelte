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
	.enter { max-width: 32rem; margin: 2rem auto; padding: 1.5rem; }
	.lede { color: #44403c; }
	form { display: flex; gap: 0.5rem; margin-top: 1.25rem; }
	input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		background: #fff;
		color: #1c1917;
		border: 1px solid #d6d3d1;
		border-radius: 6px;
	}
	input::placeholder { color: #78716c; }
	button { cursor: pointer; padding: 0.5rem 0.9rem; }
	.message { color: #c2410c; }
</style>
