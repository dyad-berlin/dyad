<script lang="ts">
	import { enhance } from '$app/forms';
	import { copy } from '$lib/copy';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let step = $state(1);
	let agreedStandards = $state(false);
	let agreedAgreements = $state(false);
	let tier = $state('none');
	// svelte-ignore state_referenced_locally — intentional initial-value capture for form field
	let username = $state(form?.username ?? '');
	// svelte-ignore state_referenced_locally
	let selectedTier = $state(form?.tier ?? 'none');
	let email = $state('');
	let password = $state('');
	let loading = $state(false);

	const canContinueStep1 = $derived(agreedStandards && agreedAgreements);

	const tiers = [
		{ id: 'none', name: 'Open membership', price: 'No contribution', note: 'Join without paying, right now. You can support us any time.' },
		{ id: 'solidarity', name: copy.membership.monthlySolidarityName, price: `${copy.membership.monthlySolidarityPrice} / month`, note: copy.membership.monthlySolidarityNote },
		{ id: 'standard', name: copy.membership.monthlyStandardName, price: `${copy.membership.cadenceMonthlyPrice} / month`, note: copy.membership.monthlyStandardNote },
		{ id: 'supporter', name: copy.membership.monthlySupporterName, price: `${copy.membership.monthlySupporterPrice} / month`, note: copy.membership.monthlySupporterNote },
		{ id: 'annual', name: copy.membership.cadenceAnnual, price: `${copy.membership.cadenceAnnualPrice} / year`, note: 'One payment, covers a full year.' },
		{ id: 'lifetime', name: copy.membership.cadenceLifetime, price: `${copy.membership.cadenceLifetimePrice} once`, note: 'One payment, no renewal, ever.' }
	];

	function selectTier(id: string) {
		tier = id;
		selectedTier = id;
	}
</script>

<svelte:head>
	<title>Become a member · dyad.</title>
</svelte:head>

<div class="auth-card wide">
	<p class="step-label">Step {step} of 3</p>

	{#if step === 1}
		<h1>Our common ground</h1>
		<p class="subtitle">Membership is built on mutual commitment and regard. Please read and confirm each before continuing.</p>

		<label class="consent-card" class:checked={agreedStandards}>
			<input type="checkbox" bind:checked={agreedStandards} />
			<span class="consent-body">
				<span class="consent-title">Community Standards</span>
				<span class="consent-desc">I have read and agree to the Community Standards: what we do not tolerate, and what happens when something goes wrong.</span>
				<a href="/docs#standards" target="_blank" class="consent-link">Read the Community Standards →</a>
			</span>
		</label>

		<label class="consent-card" class:checked={agreedAgreements}>
			<input type="checkbox" bind:checked={agreedAgreements} />
			<span class="consent-body">
				<span class="consent-title">Member Agreements</span>
				<span class="consent-desc">I have read and agree to the Member Agreements: who can join, what membership includes, and what it is not.</span>
				<a href="/docs#agreements" target="_blank" class="consent-link">Read the Member Agreements →</a>
			</span>
		</label>

		<p class="stands-link"><a href="/docs#support-us" target="_blank">What we stand for, in full →</a></p>

		<button type="button" class="btn-primary btn-primary--block" disabled={!canContinueStep1} onclick={() => (step = 2)}>
			Continue
		</button>
	{:else if step === 2}
		<h1>Choose your contribution</h1>
		<p class="subtitle">Membership is open to everyone. Paying is a choice, never a condition of belonging, and every rate is yours to pick.</p>

		<div class="tier-grid">
			{#each tiers as t (t.id)}
				<button type="button" class="tier-card" class:selected={tier === t.id} onclick={() => selectTier(t.id)}>
					<span class="tier-name">{t.name}</span>
					<span class="tier-price">{t.price}</span>
					<span class="tier-note">{t.note}</span>
				</button>
			{/each}
		</div>

		<div class="step-actions">
			<button type="button" class="btn-secondary" onclick={() => (step = 1)}>Back</button>
			<button type="button" class="btn-primary" onclick={() => (step = 3)}>Continue</button>
		</div>
	{:else}
		<h1>Create your account</h1>
		<p class="subtitle">
			{#if tier === 'none'}
				We just need a few details. You can start supporting us financially any time from your profile.
			{:else}
				We just need a few details. You will complete your {tiers.find((t) => t.id === tier)?.name} contribution on the next screen.
			{/if}
		</p>

		{#if form?.error}
			<div class="error-message">{form.error}</div>
		{/if}

		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				loading = true;
				return async ({ result, update }) => {
					loading = false;
					await update();
					if (result.type === 'failure') step = 3;
				};
			}}
		>
			<input type="hidden" name="tier" value={tier} />
			<input type="hidden" name="agreedStandards" value={agreedStandards ? 'on' : ''} />
			<input type="hidden" name="agreedAgreements" value={agreedAgreements ? 'on' : ''} />

			<div class="form-group">
				<label for="username" class="sr-only">{copy.auth.usernamePlaceholder}</label>
				<input
					type="text"
					id="username"
					name="username"
					bind:value={username}
					required
					autocomplete="username"
					placeholder={copy.auth.usernamePlaceholder}
					disabled={loading}
					minlength={3}
					maxlength={30}
					pattern="[a-z0-9_\-]+"
					title={copy.auth.usernameTitle}
				/>
				<p class="hint">{copy.auth.usernameHintLong}<strong>@username</strong></p>
			</div>

			<div class="form-group">
				<label for="email" class="sr-only">{copy.auth.email}</label>
				<input
					type="email"
					id="email"
					name="email"
					bind:value={email}
					required
					autocomplete="email"
					placeholder={copy.auth.emailPlaceholder}
					disabled={loading}
				/>
			</div>

			<div class="form-group">
				<label for="password" class="sr-only">{copy.auth.password}</label>
				<input
					type="password"
					id="password"
					name="password"
					bind:value={password}
					required
					autocomplete="new-password"
					placeholder={copy.auth.passwordWithMinPlaceholder}
					disabled={loading}
					minlength={8}
				/>
			</div>

			<div class="step-actions">
				<button type="button" class="btn-secondary" disabled={loading} onclick={() => (step = 2)}>Back</button>
				<button type="submit" class="btn-primary btn-primary--block" disabled={loading}>
					{loading ? copy.auth.creatingAccount : 'Become a member'}
				</button>
			</div>
		</form>
	{/if}

	<p class="switch-auth">
		{copy.auth.alreadyHaveAccount}
		<a href="/login" class="link-btn">{copy.auth.signIn}</a>
	</p>
</div>

<style>
	.auth-card {
		width: 100%;
		max-width: 400px;
		/* Auto cross-axis margins: centered when the step fits the viewport,
		   collapsing to 0 when it's taller (step 2's tier grid, mainly) — see
		   the layout's overflow-y: auto on .form-half. */
		margin: auto 0;
		padding: var(--space-8) 0;
	}
	.auth-card.wide {
		max-width: 480px;
	}

	.step-label {
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: var(--text-xs);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin: 0 0 var(--space-2);
	}

	h1 {
		margin: 0 0 var(--space-2) 0;
		font-size: var(--text-3xl);
		font-weight: 300;
		color: var(--text-primary);
	}

	.subtitle {
		margin: 0 0 var(--space-6) 0;
		color: var(--text-muted);
		font-size: var(--text-md);
		line-height: var(--leading-relaxed);
	}

	.error-message {
		background: color-mix(in srgb, var(--color-danger) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
		color: var(--color-danger);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-input);
		margin-bottom: var(--space-5);
		font-size: var(--text-base);
	}

	/* Step 1 — consent cards */
	.consent-card {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-card);
		margin-bottom: var(--space-4);
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}
	.consent-card.checked {
		border-color: var(--text-primary);
		background: color-mix(in srgb, var(--text-primary) 5%, transparent);
	}
	.consent-card input[type='checkbox'] {
		margin-top: 3px;
		width: 18px;
		height: 18px;
		accent-color: var(--text-primary);
		flex-shrink: 0;
	}
	.consent-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.consent-title {
		font-size: var(--text-md);
		font-weight: 500;
		color: var(--text-primary);
	}
	.consent-desc {
		font-size: var(--text-sm);
		color: var(--text-muted);
		line-height: var(--leading-relaxed);
	}
	.consent-link {
		font-size: var(--text-sm);
		color: var(--text-link);
		margin-top: var(--space-1);
	}
	.consent-link:hover {
		color: var(--text-link-hover);
	}
	.stands-link {
		font-size: var(--text-sm);
		margin: 0 0 var(--space-5);
	}
	.stands-link a {
		color: var(--text-muted);
	}
	.stands-link a:hover {
		color: var(--text-primary);
	}

	/* Step 2 — tier grid */
	.tier-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
		margin-bottom: var(--space-6);
	}
	.tier-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
		text-align: left;
		padding: var(--space-4);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-card);
		background: var(--bg-canvas);
		color: var(--text-primary);
		cursor: pointer;
		font: inherit;
		transition: border-color 0.15s, background 0.15s;
	}
	.tier-card.selected {
		border-color: var(--text-primary);
		background: color-mix(in srgb, var(--text-primary) 6%, transparent);
	}
	.tier-name {
		font-size: var(--text-sm);
		font-weight: 500;
	}
	.tier-price {
		font-size: var(--text-lg);
		font-weight: 300;
	}
	.tier-note {
		font-size: var(--text-xs);
		color: var(--text-muted);
		line-height: var(--leading-relaxed);
	}

	.step-actions {
		display: flex;
		gap: var(--space-3);
	}
	.step-actions .btn-primary {
		flex: 1;
	}
	.btn-secondary {
		padding: var(--space-3) var(--space-5);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input);
		background: transparent;
		color: var(--text-primary);
		cursor: pointer;
		font: inherit;
	}
	.btn-secondary:hover {
		border-color: var(--border-link-hover);
	}

	/* Step 3 — account fields, mirrors (auth)/join */
	.form-group {
		margin-bottom: var(--space-5);
	}
	input[type='text'],
	input[type='email'],
	input[type='password'] {
		width: 100%;
		padding: var(--space-3);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input);
		font-size: var(--text-lg);
		font-family: inherit;
		background: var(--bg-canvas);
		color: var(--text-primary);
		transition: border-color 0.2s;
		box-sizing: border-box;
	}
	input:focus {
		outline: none;
		border-color: var(--text-muted);
	}
	input:disabled {
		opacity: var(--opacity-disabled);
		cursor: not-allowed;
	}
	.hint {
		margin: var(--space-2) 0 0 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.switch-auth {
		margin: var(--space-6) 0 0 0;
		text-align: center;
		color: var(--text-muted);
		font-size: var(--text-md);
	}
	.link-btn {
		color: var(--text-link);
		font: inherit;
		border-bottom: 1px solid var(--border-link);
		transition: border-color 0.2s, color 0.2s;
		text-decoration: none;
	}
	.link-btn:hover {
		color: var(--text-link-hover);
		border-color: var(--border-link-hover);
	}

	@media (max-width: 480px) {
		.tier-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
