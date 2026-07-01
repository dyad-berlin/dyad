<script lang="ts">
	import { copy } from '$lib/copy';

	// The join/renew offer body — cadence first, then (for monthly) a tier.
	// Shared by the paywall modal and the /membership page so they never diverge.
	// The wrapper owns the active/confirming states and any "not now" exit; this
	// component only renders the offer for a non-member, lapsed, or ended-grant.
	type Mode = 'join' | 'renew' | 'ended';
	type Cadence = 'monthly' | 'annual' | 'lifetime';
	type Tier = 'solidarity' | 'standard' | 'supporter';

	let { mode = 'join', returnTo = null }: { mode?: Mode; returnTo?: string | null } = $props();

	const c = copy.membership;

	const heading = $derived(
		mode === 'ended' ? c.grantEndedHeading : mode === 'renew' ? c.lapsedHeading : c.guestHeading
	);
	const intro = $derived(
		mode === 'ended' ? c.grantEndedIntro : mode === 'renew' ? c.lapsedIntro : c.guestIntro
	);
	// Only a genuinely-lapsed paid member "renews"; a never-member and an
	// ended grant both "become a member".
	const ctaLabel = $derived(mode === 'renew' ? c.gateCta(true) : c.becomeMemberCta);

	const cadences: { value: Cadence; label: string; price: string; period: string }[] = [
		{ value: 'monthly', label: c.cadenceMonthly, price: c.cadenceMonthlyPrice, period: c.cadenceMonthlyPeriod },
		{ value: 'annual', label: c.cadenceAnnual, price: c.cadenceAnnualPrice, period: c.cadenceAnnualPeriod },
		{ value: 'lifetime', label: c.cadenceLifetime, price: c.cadenceLifetimePrice, period: c.cadenceLifetimePeriod }
	];
	const tiers: { value: Tier; name: string; price: string; note: string }[] = [
		{ value: 'solidarity', name: c.monthlySolidarityName, price: c.monthlySolidarityPrice, note: c.monthlySolidarityNote },
		{ value: 'standard', name: c.monthlyStandardName, price: c.cadenceMonthlyPrice, note: c.monthlyStandardNote },
		{ value: 'supporter', name: c.monthlySupporterName, price: c.monthlySupporterPrice, note: c.monthlySupporterNote }
	];

	let cadence = $state<Cadence>('monthly');
	let tier = $state<Tier>('standard');
	let busy = $state(false);
	let error = $state('');

	// Price shown on the CTA row: the tier's price for monthly, the cadence's own price otherwise.
	const shownPrice = $derived(
		cadence === 'monthly'
			? tiers.find((t) => t.value === tier)!.price
			: cadences.find((cd) => cd.value === cadence)!.price
	);
	const shownPeriod = $derived(cadences.find((cd) => cd.value === cadence)!.period);

	async function startCheckout() {
		busy = true;
		error = '';
		try {
			const payload: Record<string, string> =
				cadence === 'monthly' ? { cadence, tier } : { cadence };
			if (returnTo) payload.returnTo = returnTo;
			const res = await fetch('/api/membership/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const body = await res.json().catch(() => ({}));
			if (res.ok && body.url) {
				window.location.href = body.url; // full-page redirect to Stripe
				return;
			}
			error = c.errorGeneric;
		} catch {
			error = copy.common.networkError;
		} finally {
			busy = false;
		}
	}
</script>

<div class="offer">
	<h2 class="offer-heading">{heading}</h2>
	<p class="offer-lead">{intro}</p>

	<div class="cadences" role="radiogroup" aria-label={c.cadenceAriaLabel}>
		{#each cadences as cd (cd.value)}
			<button
				type="button"
				class="cadence"
				class:selected={cadence === cd.value}
				role="radio"
				aria-checked={cadence === cd.value}
				disabled={busy}
				onclick={() => (cadence = cd.value)}
			>
				<span class="cadence-label">{cd.label}</span>
				<span class="cadence-price">{cd.price}<span class="cadence-period"> {cd.period}</span></span>
			</button>
		{/each}
	</div>

	{#if cadence === 'monthly'}
		<div class="tiers" role="radiogroup" aria-label={c.tierAriaLabel}>
			<p class="tiers-label">{c.tierPrompt}</p>
			{#each tiers as t (t.value)}
				<button
					type="button"
					class="tier"
					class:selected={tier === t.value}
					role="radio"
					aria-checked={tier === t.value}
					disabled={busy}
					onclick={() => (tier = t.value)}
				>
					<span class="tier-name">{t.name}</span>
					<span class="tier-price">{t.price}</span>
					<span class="tier-note">{t.note}</span>
				</button>
			{/each}
		</div>
	{/if}

	<ul class="benefits" role="list">
		{#each c.benefits as b (b)}
			<li>{b}</li>
		{/each}
	</ul>

	<button class="primary" disabled={busy} onclick={startCheckout}>
		{ctaLabel} · {shownPrice}{shownPeriod ? ' ' + shownPeriod : ''}
	</button>
	<p class="billing-note">{c.billingNote}</p>

	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#if busy}<p class="busy" aria-live="polite">{c.continuing}</p>{/if}
</div>

<style>
	.offer {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-width: 30rem;
		margin: 0 auto;
	}
	.offer-heading {
		font-size: var(--text-xl);
		font-weight: 500;
		margin: 0;
		text-wrap: balance;
	}
	.offer-lead {
		font-size: var(--text-sm);
		color: var(--text-muted);
		margin: 0 0 var(--space-2);
		line-height: var(--leading-relaxed);
	}
	.cadences {
		display: flex;
		gap: var(--space-2);
	}
	.cadence {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		align-items: flex-start;
		padding: var(--space-3);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-card);
		background: var(--bg-canvas);
		cursor: pointer;
		transition: border-color var(--duration-fast) var(--ease-ink);
	}
	.cadence:hover:not(:disabled) { border-color: var(--text-primary); }
	.cadence.selected { border-color: var(--text-primary); box-shadow: inset 0 0 0 1px var(--text-primary); }
	.cadence:disabled { cursor: progress; opacity: var(--opacity-disabled); }
	.cadence-label { font-size: var(--text-sm); color: var(--text-primary); }
	.cadence-price { font-size: var(--text-base); font-weight: 500; color: var(--text-primary); }
	.cadence-period { font-size: var(--text-xs); font-weight: 400; color: var(--text-muted); }

	.tiers { display: flex; flex-direction: column; gap: var(--space-2); }
	.tiers-label {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin: 0;
	}
	.tier {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0 var(--space-3);
		text-align: left;
		padding: var(--space-3);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-card);
		background: var(--bg-canvas);
		cursor: pointer;
		transition: border-color var(--duration-fast) var(--ease-ink);
	}
	.tier:hover:not(:disabled) { border-color: var(--text-primary); }
	.tier.selected { border-color: var(--text-primary); box-shadow: inset 0 0 0 1px var(--text-primary); }
	.tier:disabled { cursor: progress; opacity: var(--opacity-disabled); }
	.tier-name { font-size: var(--text-base); font-weight: 500; color: var(--text-primary); }
	.tier-price { font-size: var(--text-base); font-weight: 500; color: var(--text-primary); }
	.tier-note { grid-column: 1 / -1; font-size: var(--text-sm); color: var(--text-muted); }

	.benefits {
		list-style: none;
		margin: var(--space-2) 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.benefits li {
		position: relative;
		padding-left: var(--space-5);
		font-size: var(--text-sm);
		color: var(--text-primary);
		line-height: var(--leading-normal);
	}
	.benefits li::before { content: '✓'; position: absolute; left: 0; color: var(--text-muted); }

	.primary {
		display: block;
		width: 100%;
		text-align: center;
		padding: var(--space-4);
		border: 1px solid var(--text-primary);
		border-radius: var(--radius-card);
		background: var(--text-primary);
		color: var(--bg-canvas);
		font-weight: 500;
		cursor: pointer;
	}
	.primary:disabled { cursor: progress; opacity: var(--opacity-disabled); }
	.billing-note { font-size: var(--text-sm); color: var(--text-muted); text-align: center; margin: 0; }
	.error { font-size: var(--text-sm); color: var(--color-danger); margin: var(--space-2) 0 0; }
	.busy { font-size: var(--text-sm); color: var(--text-muted); margin: var(--space-2) 0 0; }
</style>
