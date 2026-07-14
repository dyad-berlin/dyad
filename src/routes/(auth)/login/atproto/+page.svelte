<script lang="ts">
	// ATProto sign-in: a handle form that navigates to the authorize route,
	// which redirects to the member's own authorization server. The server
	// sends the browser back to /api/atproto/callback, which establishes the
	// scope session and lands on /discover. No fetch, no client state.

	let { data } = $props();

	const messages: Record<string, string> = {
		handle: 'Enter a handle like name.bsky.social.',
		resolve: 'That handle was not found.',
		not_admitted: 'No dyad membership is linked to that handle yet. dyad is invite-based.'
	};
	const message = data.errorCode
		? (messages[data.errorCode] ?? 'Sign-in did not complete.')
		: null;
</script>

<svelte:head><title>Enter with Your ATProto Account</title></svelte:head>

<main class="enter">
	<h1>Enter with Your ATProto Account</h1>

	<p class="lede">
		Enter with a handle from Bluesky or any other ATProto service. dyad keeps
		an anonymous reference to it and nothing else.
	</p>

	<form method="GET" action="/api/atproto/authorize">
		<input
			name="handle"
			type="text"
			autocomplete="off"
			autocapitalize="none"
			spellcheck="false"
			required
			placeholder="your handle, like name.bsky.social"
		/>
		<button type="submit">continue</button>
	</form>

	{#if message}<p class="message">{message}</p>{/if}
	<p class="alt"><a href="/login">Use email instead</a></p>
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
	.alt { margin-top: 1.5rem; }
</style>
