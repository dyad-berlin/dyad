<script lang="ts">
	// Demo ember login. Establishes an account-less scope session by presenting
	// a presence proof, then enters the real app at /discover — the app renders
	// scoped to the membership via the claim-injected client (no special page).

	let nonce = $state<string | null>(null);
	let proof = $state('');
	let busy = $state(false);
	let message = $state<string | null>(null);

	async function requestChallenge() {
		busy = true;
		message = null;
		try {
			const res = await fetch('/api/session/ember');
			if (!res.ok) throw new Error(await res.text());
			nonce = (await res.json()).nonce;
		} catch (e) {
			message = e instanceof Error ? e.message : 'failed to get a challenge';
		} finally {
			busy = false;
		}
	}

	async function enter() {
		busy = true;
		message = null;
		try {
			const res = await fetch('/api/session/ember', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ proof: proof.trim() })
			});
			const body = await res.json();
			if (!res.ok) throw new Error(body.error ?? 'proof rejected');
			// Full navigation so hooks re-run with the new cookie and authorize
			// the app as this identity.
			window.location.href = '/discover';
		} catch (e) {
			message = e instanceof Error ? e.message : 'proof rejected';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Enter with ember</title></svelte:head>

<main class="enter">
	<h1>Enter with ember</h1>
	<p class="lede">
		No email, no password, no account. You enter dyad by holding an ember
		membership — a credential someone renewed for you, in person. You are known
		only by your member key, for as long as the credential lasts.
	</p>

	<ol class="steps">
		<li>
			<button onclick={requestChallenge} disabled={busy}>request a challenge</button>
			{#if nonce}<p class="nonce">Answer this in the ember app: <code>{nonce}</code></p>{/if}
		</li>
		<li>
			<label for="proof">Paste the proof</label>
			<textarea id="proof" bind:value={proof} rows="4" placeholder="base64url proof"></textarea>
			<button class="primary" onclick={enter} disabled={busy || !proof.trim() || !nonce}>enter dyad</button>
		</li>
	</ol>

	{#if message}<p class="message">{message}</p>{/if}
	<p class="alt"><a href="/login">Use email instead</a></p>
</main>

<style>
	.enter { max-width: 32rem; margin: 2rem auto; padding: 1.5rem; }
	.lede { color: #44403c; }
	.steps { display: grid; gap: 1.25rem; padding-left: 1rem; }
	.nonce code, code { font-family: ui-monospace, monospace; word-break: break-all; }
	textarea { width: 100%; font-family: ui-monospace, monospace; }
	button { cursor: pointer; padding: 0.5rem 0.9rem; }
	button.primary { background: #c2410c; color: white; border: none; border-radius: 6px; }
	.message { color: #c2410c; }
	.alt { margin-top: 1.5rem; }
</style>
