<script lang="ts">
	// ATProto sign-in: a handle form that navigates to the authorize route,
	// which redirects to the member's own authorization server. The server
	// sends the browser back to /api/atproto/callback, which establishes the
	// scope session and lands on /discover.
	//
	// A verified-but-not-admitted sign-in can ask to join: the rejection left a
	// short-lived pending token, and the waitlist endpoint attaches the request
	// to that proven identity.

	let { data } = $props();

	const messages: Record<string, string> = {
		handle: 'Enter a handle like name.bsky.social.',
		resolve: 'That handle was not found.',
		not_admitted: 'No dyad membership is linked to that handle yet. dyad is invite-based.'
	};
	const message = data.errorCode
		? (messages[data.errorCode] ?? 'Sign-in did not complete.')
		: null;

	let requestState = $state<'idle' | 'sending' | 'sent' | 'failed'>('idle');

	async function askToJoin() {
		requestState = 'sending';
		try {
			const res = await fetch('/api/atproto/waitlist', { method: 'POST' });
			requestState = res.ok ? 'sent' : 'failed';
		} catch {
			requestState = 'failed';
		}
	}
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

	{#if data.errorCode === 'not_admitted'}
		{#if requestState === 'sent'}
			<p class="lede">Request sent. Sign in again once it is approved.</p>
		{:else}
			<p class="ask">
				<button onclick={askToJoin} disabled={requestState === 'sending'}>ask to join</button>
			</p>
			{#if requestState === 'failed'}
				<p class="message">The request did not go through. Sign in again, then retry.</p>
			{/if}
		{/if}
	{/if}

	<p class="alt"><a href="/login">Use email instead</a></p>
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
	.ask { margin-top: var(--space-4); }
	.alt { margin-top: var(--space-6); }
</style>
