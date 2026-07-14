<script lang="ts">
	// Demo EUDI wallet login (same-device flow). Two moments share this page:
	//
	//  start:  fetch the wallet deeplink from the generic session endpoint and
	//          render it; tapping it opens the EUDI wallet, which presents to
	//          the wallet-facing routes (/api/eudi/request, /api/eudi/response).
	//  finish: the wallet sends the browser back here with ?response_code=...;
	//          POSTing it to the session endpoint redeems it (single-use) and
	//          establishes the account-less scope session, then the app renders
	//          scoped to it at /discover — no account, no PID attribute stored.

	import { onMount } from 'svelte';

	let deeplink = $state<string | null>(null);
	let busy = $state(false);
	let finishing = $state(false);
	let message = $state<string | null>(null);

	async function requestDeeplink() {
		busy = true;
		message = null;
		try {
			const res = await fetch('/api/session/eudi');
			if (!res.ok) throw new Error(await res.text());
			deeplink = (await res.json()).deeplink;
		} catch (e) {
			message = e instanceof Error ? e.message : 'failed to start a presentation';
		} finally {
			busy = false;
		}
	}

	async function finish(responseCode: string) {
		busy = true;
		message = null;
		try {
			const res = await fetch('/api/session/eudi', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ response_code: responseCode })
			});
			const body = await res.json();
			if (!res.ok) throw new Error(body.error ?? 'presentation rejected');
			// Full navigation so hooks re-run with the new cookie and authorize
			// the app as this identity.
			window.location.href = '/discover';
		} catch (e) {
			message = e instanceof Error ? e.message : 'presentation rejected';
			finishing = false;
		} finally {
			busy = false;
		}
	}

	onMount(() => {
		const responseCode = new URL(window.location.href).searchParams.get('response_code');
		if (responseCode) {
			finishing = true;
			finish(responseCode);
		}
	});
</script>

<svelte:head><title>Enter with Your EUDI Wallet</title></svelte:head>

<main class="enter">
	<h1>Enter with Your EUDI Wallet</h1>

	{#if finishing}
		<p class="lede">Checking your presentation…</p>
	{:else}
		<p class="lede">
			No email, no password, no account. Your wallet proves you hold a valid
			PID and discloses nothing else: no name, no birthdate, no identifier
			dyad could recognise you by next time. The proof admits you once; what
			you enter is a scope session that lapses on its own.
		</p>

		<ol class="steps">
			<li>
				<button onclick={requestDeeplink} disabled={busy}>start a presentation</button>
			</li>
			<li>
				{#if deeplink}
					<a class="wallet" href={deeplink}>open your wallet</a>
					<p class="hint">Same-device flow: the link opens your EUDI wallet app, which brings you back here.</p>
				{:else}
					<p class="hint">The wallet link appears here.</p>
				{/if}
			</li>
		</ol>
	{/if}

	{#if message}<p class="message">{message}</p>{/if}
	<p class="alt"><a href="/login">Use email instead</a></p>
</main>

<style>
	.enter { max-width: 32rem; margin: 2rem auto; padding: var(--space-6); }
	.lede { color: var(--text-secondary); }
	.steps { display: grid; gap: var(--space-5); padding-left: var(--space-4); }
	.hint { color: var(--text-muted); }
	button { cursor: pointer; padding: var(--space-2) var(--space-3); }
	a.wallet { display: inline-block; background: var(--color-accent); color: var(--bg-canvas); border-radius: var(--radius-input); padding: var(--space-2) var(--space-3); text-decoration: none; }
	.message { color: var(--color-danger); }
	.alt { margin-top: var(--space-6); }
</style>
