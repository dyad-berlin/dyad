<script lang="ts">
	// ATProto sign-in: a handle form that navigates to the authorize route,
	// which redirects to the member's own authorization server. The server
	// sends the browser back to /api/atproto/callback, which establishes the
	// scope session and lands on /discover. No fetch, no client state.

	let { data } = $props();

	const messages: Record<string, string> = {
		handle: 'Enter the handle you use on the network, like name.bsky.social.',
		resolve: 'That handle could not be found on the network.',
		credential_rejected: 'Sign-in was not completed. You can try again.',
		credential_invalid: 'Sign-in was not completed. You can try again.'
	};
	const message = data.errorCode
		? (messages[data.errorCode] ?? 'Something went wrong. You can try again.')
		: null;
</script>

<svelte:head><title>Enter with Your ATProto Account</title></svelte:head>

<main class="enter">
	<h1>Enter with Your ATProto Account</h1>

	<p class="lede">
		If you have an account on Bluesky or elsewhere on the ATProto network, you
		can enter with it. Your own server confirms it is you; dyad learns no name,
		no email, and keeps no way to reach you.
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
	input { flex: 1; padding: 0.5rem 0.75rem; }
	button { cursor: pointer; padding: 0.5rem 0.9rem; }
	.message { color: #c2410c; }
	.alt { margin-top: 1.5rem; }
</style>
