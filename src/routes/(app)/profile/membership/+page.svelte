<script lang="ts">
	import type { PageData } from './$types';
	import { copy } from '$lib/copy';

	// This route has no +page.server.ts of its own — it inherits the (app)
	// layout data, which already loads membership state (data.membership).
	let { data }: { data: PageData } = $props();

	// Membership (display-only). Manage → Stripe portal for now (an in-app
	// manage page is a later, backend-dependent step).
	// TODO: the membership* copy keys below still live under copy.preferences;
	// a later cleanup can move them into copy.membershipArea.
	const m = $derived(data.membership);
	const planName = $derived(
		!m
			? ''
			: m.source !== 'paid'
				? copy.preferences.planComp
				: m.cadence === 'lifetime'
					? copy.preferences.planLifetime
					: m.cadence === 'annual'
						? copy.preferences.planAnnual
						: copy.preferences.planMonthly
	);
	let managing = $state(false);
	let manageError = $state<string | null>(null);
	async function manageMembership() {
		managing = true;
		manageError = null;
		try {
			const res = await fetch('/api/membership/portal', { method: 'POST' });
			const body = await res.json().catch(() => ({}));
			if (res.ok && body.url) {
				window.location.href = body.url;
				return;
			}
			manageError = copy.preferences.membershipManageError;
		} catch {
			manageError = copy.preferences.membershipManageError;
		} finally {
			managing = false;
		}
	}
</script>

<svelte:head>
	<title>{copy.membershipArea.title} · dyad.social</title>
</svelte:head>

<div class="content">
	<a href="/profile" class="back-link">{copy.membershipArea.backToProfile}</a>
	<h1 class="page-title">{copy.membershipArea.title}</h1>

	<section class="membership-pref">
		<p class="section-label">{copy.preferences.membershipHeading}</p>
		{#if m?.active}
			<p class="plan-name">{planName}</p>
			<button type="button" class="manage-link" disabled={managing} onclick={manageMembership}>
				{copy.preferences.membershipManage}
			</button>
			{#if manageError}
				<p class="manage-error" role="alert">{manageError}</p>
			{/if}
		{:else if m && m.source !== 'paid'}
			<p class="plan-name">{copy.preferences.membershipEnded}</p>
			<a href="/membership" class="manage-link">{copy.preferences.membershipJoin}</a>
		{:else if m}
			<p class="plan-name">{copy.preferences.membershipLapsed}</p>
			<a href="/membership" class="manage-link">{copy.preferences.membershipRenew}</a>
		{:else}
			<p class="plan-name muted">{copy.preferences.membershipNone}</p>
			<a href="/membership" class="manage-link">{copy.preferences.membershipJoin}</a>
		{/if}
	</section>
</div>

<style>
	.content {
		width: 100%;
		max-width: var(--content-standard);
		padding-bottom: var(--nav-clearance);
	}

	.back-link {
		display: inline-block;
		margin-top: var(--space-6);
		font-size: var(--text-sm);
		color: var(--text-muted);
		text-decoration: underline;
		text-decoration-color: transparent;
	}
	.back-link:hover {
		color: var(--text-primary);
	}

	.page-title {
		font-size: var(--text-xl);
		font-weight: 500;
		margin: var(--space-4) 0 var(--space-6);
	}

	.section-label {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin: 0 0 var(--space-3);
	}

	.membership-pref {
		margin-bottom: var(--space-5);
	}
	.plan-name {
		font-size: var(--text-base);
		color: var(--text-primary);
		margin: var(--space-2) 0;
	}
	.plan-name.muted {
		color: var(--text-muted);
	}
	.manage-link {
		display: inline-block;
		font-size: var(--text-sm);
		color: var(--text-link);
		text-decoration: underline;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}
	.manage-link:hover {
		color: var(--text-link-hover);
	}
	.manage-error {
		margin: var(--space-2) 0 0;
		font-size: var(--text-sm);
		color: var(--color-danger);
	}
</style>
