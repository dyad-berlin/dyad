<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { invalidate, goto } from '$app/navigation';
	import { copy } from '$lib/copy';
	import MembershipOffer from '$lib/components/MembershipOffer.svelte';

	let { data } = $props();

	const c = copy.membership;

	let busy = $state(false);
	let error = $state('');
	let pollFallback = $state(false);

	const membership = $derived(data.membership);
	const status = $derived($page.url.searchParams.get('status'));
	// Where to send the member after they join — the page they were paywalled on,
	// passed as ?return=. Guard against open redirects: internal paths only.
	const rawReturn = $derived($page.url.searchParams.get('return'));
	const returnTo = $derived(rawReturn && /^\/[A-Za-z0-9]/.test(rawReturn) ? rawReturn : null);
	const isActive = $derived(membership?.active === true);
	const isLifetime = $derived(isActive && membership?.cadence === 'lifetime');
	// A non-active row is either a genuinely lapsed paid membership or a revoked
	// operator grant (comp/founding/grandfathered). Never-activated rows are
	// already mapped to null upstream, so any non-null row here really lapsed.
	const isEndedGrant = $derived(!isActive && membership !== null && membership.source !== 'paid');
	const isLapsedPaid = $derived(!isActive && membership !== null && membership.source === 'paid');
	// While confirming a just-completed checkout the webhook may not have landed.
	const confirming = $derived(status === 'success' && !isActive && !pollFallback);
	// The shared offer body renders the join/renew/ended offer and owns its own
	// checkout POST — pick the mode from the same display state used for the copy.
	const offerMode = $derived(isEndedGrant ? 'ended' : isLapsedPaid ? 'renew' : 'join');

	async function openPortal() {
		busy = true;
		error = '';
		try {
			const res = await fetch('/api/membership/portal', { method: 'POST' });
			const body = await res.json().catch(() => ({}));
			if (res.ok && body.url) {
				window.location.href = body.url;
				return;
			}
			error = c.errorGeneric;
		} catch {
			error = copy.common.networkError;
		} finally {
			busy = false;
		}
	}

	// Poll for the webhook to flip `active` after a successful checkout return.
	onMount(() => {
		if (status !== 'success') return;
		// Fast webhook: already active on return — go straight back to context.
		if (isActive) {
			if (returnTo) goto(returnTo);
			return;
		}
		let elapsed = 0;
		const iv = setInterval(async () => {
			elapsed += 3000;
			// A transient network error on invalidate must not throw an unhandled
			// rejection every tick — swallow it and let the next tick retry (or the
			// 30s fallback take over).
			try {
				await invalidate('membership:status');
			} catch {
				/* transient — retry next tick */
			}
			if (data.membership?.active) {
				clearInterval(iv);
				if (returnTo) goto(returnTo);
			} else if (elapsed >= 30000) {
				clearInterval(iv);
				pollFallback = true;
			}
		}, 3000);
		return () => clearInterval(iv);
	});
</script>

<svelte:head>
	<title>{c.pageTitle} — dyad</title>
</svelte:head>

<main class="membership">
	{#if isLifetime}
		<h1>{c.activeHeading}</h1>
		<p class="lead">{c.lifetimeConfirmation}</p>
	{:else if isActive}
		<h1>{c.activeHeading}</h1>
		<p class="lead">{c.activeSubscription}</p>
		<button class="primary" disabled={busy} onclick={openPortal}>{c.manageCta}</button>
		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}
		{#if busy}
			<p class="busy" aria-live="polite">{c.continuing}</p>
		{/if}
	{:else if confirming}
		<h1>{c.pageTitle}</h1>
		<p class="lead">{c.finishingUp}</p>
		<p class="spinner" aria-live="polite">…</p>
	{:else}
		{#if pollFallback}
			<p class="lead notice">{c.finishingUpFallback}</p>
		{:else if status === 'cancelled'}
			<p class="lead notice">{c.cancelled}</p>
		{/if}
		<!-- The shared offer body: same cadence→tier picker, benefits, CTA, and
		     checkout POST as the paywall modal, so the two never diverge. -->
		<MembershipOffer mode={offerMode} {returnTo} />
	{/if}
</main>

<style>
	.membership {
		max-width: 64rem;
		margin: 0 auto;
		padding: var(--space-6) var(--space-4);
	}
	h1 {
		font-size: var(--text-xl);
		font-weight: 500;
		margin: 0 0 var(--space-3);
	}
	.lead {
		font-size: var(--text-base);
		color: var(--text-muted);
		line-height: var(--leading-relaxed);
		margin: 0 0 var(--space-5);
	}
	.notice {
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-card);
		background: var(--bg-canvas);
		color: var(--text-primary);
		margin-bottom: var(--space-5);
	}
	/* The "manage membership" button on the active state; the offer body owns
	   its own primary CTA styling. */
	.primary {
		padding: var(--space-3) var(--space-5);
		border: 1px solid var(--text-primary);
		border-radius: var(--radius-card);
		background: var(--text-primary);
		color: var(--bg-canvas);
		cursor: pointer;
	}
	.primary:disabled {
		cursor: progress;
		opacity: 0.6;
	}
	.error {
		font-size: var(--text-sm);
		color: var(--color-danger);
		margin: var(--space-3) 0 0;
	}
	.busy {
		font-size: var(--text-sm);
		color: var(--text-muted);
		margin: var(--space-3) 0 0;
	}
	.spinner {
		font-size: var(--text-xl);
		color: var(--text-muted);
	}
</style>
