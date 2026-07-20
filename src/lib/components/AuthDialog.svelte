<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { copy } from '$lib/copy';
	import { env } from '$env/dynamic/public';
	import CitySearch from './CitySearch.svelte';

	interface Props {
		mode?: 'waitlist' | 'login';
	}

	let { mode: initialMode = 'waitlist' }: Props = $props();

	let open = $state(false);
	let dialogBox = $state<HTMLElement | undefined>();
	let currentMode = $state(initialMode);
	let loading = $state(false);
	let error = $state('');
	let success = $state(false);

	// Waitlist fields
	let freewrite = $state('');
	let name = $state('');
	let city = $state('');
	let email = $state('');
	let referralSource = $state('');
	let referralOther = $state('');
	// Acknowledgement gate — same requirement as the /waitlist page.
	let agreedStandards = $state(false);
	let agreedAgreements = $state(false);
	// The newsletter opt-in lives on Substack (they are the controller); we
	// only show the link after signup, and only when the URL is configured.
	const newsletterUrl = (env.PUBLIC_NEWSLETTER_URL ?? '').trim();

	// Login fields
	let loginEmail = $state('');
	let loginPassword = $state('');

	export function show(mode: 'waitlist' | 'login' = 'waitlist') {
		currentMode = mode;
		error = '';
		success = false;
		loading = false;
		open = true;
	}

	function hide() {
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') hide();
	}

	// A plain fixed overlay, NOT <dialog>.showModal(). The native dialog renders
	// in the browser top layer, which sits above the page DOM and occludes the
	// inline popup that extension password managers inject — so they appear not
	// to fire. A normal overlay keeps the login form in the page's stacking
	// context, where password managers behave as they do on any page.
	$effect(() => {
		if (typeof document === 'undefined') return;
		document.body.style.overflow = open ? 'hidden' : '';
		return () => { document.body.style.overflow = ''; };
	});

	// Native <dialog> auto-focused the first control; preserve that.
	$effect(() => {
		if (open && dialogBox) {
			dialogBox.querySelector<HTMLElement>('input, textarea')?.focus();
		}
	});

	function switchMode(mode: 'waitlist' | 'login') {
		currentMode = mode;
		error = '';
		success = false;
	}

	async function submitWaitlist() {
		// Every field is part of the request — the ask is small and deliberate.
		if (
			!freewrite.trim() || !email.trim() || !name.trim() || !city.trim() ||
			!referralSource || (referralSource === 'other' && !referralOther.trim())
		) {
			error = copy.waitlist.allRequired;
			return;
		}
		if (!agreedStandards || !agreedAgreements) {
			error = copy.waitlist.consentRequired;
			return;
		}
		loading = true;
		error = '';

		// Read referral cookie
		const dyadRef = document.cookie.split('; ').find(r => r.startsWith('dyad_ref='))?.split('=')[1];

		try {
			const res = await fetch('/api/contact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: email.trim(),
					name: name.trim() || undefined,
					based_in: city.trim() || undefined,
					freewrite: freewrite.trim(),
					referred_by_username: dyadRef || undefined,
					referral_source:
						referralSource === 'other'
							? referralOther.trim() || 'other'
							: referralSource || undefined
				})
			});

			if (res.ok) {
				success = true;
			} else if (res.status === 409) {
				success = true; // Already on waitlist — show friendly message
				error = 'already';
			} else {
				const data = await res.json().catch(() => ({}));
				error = (data as any).error ?? copy.auth.somethingWentWrong;
			}
		} catch {
			error = copy.common.networkError;
		} finally {
			loading = false;
		}
	}

	function handleLoginEnhance() {
		loading = true;
		error = '';
		return async ({ result }: { result: { type: string; location?: string; data?: Record<string, unknown>; error?: Error } }) => {
			loading = false;
			if (result.type === 'redirect') {
				hide();
				await goto(result.location!, { invalidateAll: true });
			} else if (result.type === 'failure') {
				error = (result.data?.error as string) ?? 'Login failed';
			} else if (result.type === 'error') {
				error = result.error?.message ?? copy.auth.somethingWentWrong;
			}
		};
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="auth-overlay" onclick={(e) => { if (e.target === e.currentTarget) hide(); }}>
		<div
			class="auth-dialog"
			role="dialog"
			aria-modal="true"
			aria-labelledby="auth-dialog-title"
			bind:this={dialogBox}
		>
			<div class="dialog-content">
		<button class="close-btn" onclick={hide} aria-label="Close">&times;</button>

		{#if currentMode === 'waitlist'}
			<h2 id="auth-dialog-title" class="dialog-title">{copy.waitlist.heading}</h2>

			{#if success}
				<div class="success-message">
					{#if error === 'already'}
						<p>{copy.waitlist.alreadyOnWaitlist}</p>
					{:else}
						<p>{copy.waitlist.thanksForJoining}</p>
					{/if}
					{#if newsletterUrl}
						<!-- The opt-in itself happens on Substack — we hold nothing. -->
						<p class="newsletter-invite">
							{copy.waitlist.newsletterInvite}
							<a href={newsletterUrl} target="_blank" rel="noopener">{copy.waitlist.newsletterCta}</a>
						</p>
					{/if}
				</div>
			{:else}
				<p class="dialog-intro">
					{copy.waitlist.introPre}<a href={copy.waitlist.introDocsHref} target="_blank" rel="noopener">{copy.waitlist.introDocsLink}</a>{copy.waitlist.introPost}
				</p>
				<p class="dialog-intro">{copy.waitlist.introJoin}</p>

				<label class="consent-card" class:checked={agreedStandards}>
					<input type="checkbox" bind:checked={agreedStandards} disabled={loading} />
					<span class="consent-body">
						<span class="consent-title">{copy.waitlist.consentStandardsTitle}</span>
						<span class="consent-desc">{copy.waitlist.consentStandardsDesc}</span>
						<a href={copy.waitlist.consentStandardsHref} target="_blank" rel="noopener" class="consent-link">{copy.waitlist.consentStandardsLinkLabel}</a>
					</span>
				</label>

				<label class="consent-card" class:checked={agreedAgreements}>
					<input type="checkbox" bind:checked={agreedAgreements} disabled={loading} />
					<span class="consent-body">
						<span class="consent-title">{copy.waitlist.consentAgreementsTitle}</span>
						<span class="consent-desc">{copy.waitlist.consentAgreementsDesc}</span>
						<a href={copy.waitlist.consentAgreementsHref} target="_blank" rel="noopener" class="consent-link">{copy.waitlist.consentAgreementsLinkLabel}</a>
					</span>
				</label>

				<form onsubmit={(e) => { e.preventDefault(); submitWaitlist(); }}>
					<label class="field">
						<span class="field-label">{copy.waitlist.freewriteLabel}</span>
						<textarea
							bind:value={freewrite}
							rows={3}
							required
							maxlength={2000}
							placeholder={copy.waitlist.thoughtPlaceholder}
						></textarea>
					</label>

					<label class="field">
						<span class="field-label">{copy.auth.email}</span>
						<input
							type="email"
							bind:value={email}
							required
							placeholder="you@example.com"
							autocomplete="email"
							autocapitalize="off"
							autocorrect="off"
							spellcheck="false"
						/>
					</label>

					<label class="field">
						<span class="field-label">{copy.auth.name}</span>
						<input
							type="text"
							bind:value={name}
							required
							maxlength={200}
							placeholder={copy.waitlist.namePlaceholder}
							autocomplete="name"
						/>
					</label>

					<div class="field">
						<span class="field-label">{copy.waitlist.city}</span>
						<CitySearch bind:value={city} placeholder={copy.waitlist.cityPlaceholder} />
						<p class="city-note">{copy.waitlist.cityExpansionNote}</p>
					</div>

					<label class="field">
						<span class="field-label">{copy.waitlist.referralLabel}</span>
						<select bind:value={referralSource} class="city-select" required>
							<option value="">{copy.waitlist.referralSelectPlaceholder}</option>
							{#each copy.waitlist.referralOptions as opt (opt.value)}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
						{#if referralSource === 'other'}
							<input
								type="text"
								bind:value={referralOther}
								required
								maxlength={120}
								placeholder={copy.waitlist.referralOtherPlaceholder}
								class="referral-other"
							/>
						{/if}
						<p class="city-note">{copy.waitlist.referralNote}</p>
					</label>

					{#if error && error !== 'already'}
						<p class="error-msg">{error}</p>
					{/if}

					<button class="btn-primary btn-primary--block" type="submit" disabled={loading || !freewrite.trim() || !email.trim()}>
						{loading ? copy.waitlist.sendingWaitlist : copy.waitlist.joinWaitlistButton}
					</button>
				</form>

				<p class="mode-switch">
					{copy.auth.alreadyHaveAccount} <button class="link-btn" onclick={() => switchMode('login')}>{copy.auth.logIn}</button>
				</p>
			{/if}

		{:else}
			<h2 id="auth-dialog-title" class="dialog-title">{copy.auth.logIn}</h2>

			<form method="POST" action="/login?/login" use:enhance={handleLoginEnhance}>
				<label class="field">
					<span class="field-label">{copy.auth.email}</span>
					<input
						type="email"
						name="email"
						bind:value={loginEmail}
						required
						autocomplete="username"
						autocapitalize="off"
						autocorrect="off"
						spellcheck="false"
					/>
				</label>

				<label class="field">
					<span class="field-label">{copy.auth.password}</span>
					<input
						type="password"
						name="password"
						bind:value={loginPassword}
						required
						autocomplete="current-password"
					/>
				</label>

				{#if error}
					<p class="error-msg">{error}</p>
				{/if}

				<button class="btn-primary btn-primary--block" type="submit" disabled={loading}>
					{loading ? copy.auth.loggingIn : copy.auth.logIn}
				</button>
			</form>

			<p class="mode-switch">
				<a href="/login?mode=reset" class="link-btn" onclick={hide}>{copy.auth.forgotPassword}</a>
			</p>
			<p class="mode-switch">
				{copy.auth.dontHaveAccount} <button class="link-btn" onclick={() => switchMode('waitlist')}>{copy.auth.join}</button>
			</p>
		{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.auth-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
		box-sizing: border-box;
		background: rgba(0, 0, 0, 0.5);
		overflow-y: auto;
	}

	.auth-dialog {
		max-width: 420px;
		width: 100%;
		background: var(--bg-canvas);
		color: var(--text-primary);
		border-radius: var(--radius-card);
	}

	.dialog-content {
		padding: var(--space-8) var(--space-6);
		position: relative;
	}

	.close-btn {
		position: absolute;
		top: var(--space-4);
		right: var(--space-4);
		background: none;
		border: none;
		font-size: var(--text-2xl);
		color: var(--text-muted);
		cursor: pointer;
		line-height: 1;
		padding: var(--space-1);
	}
	.close-btn:hover { color: var(--text-primary); }

	.dialog-title {
		font-size: var(--text-xl);
		font-weight: 500;
		margin: 0 0 var(--space-6);
	}

	.dialog-intro {
		margin: 0 0 var(--space-3) 0;
		color: var(--text-muted);
		font-size: var(--text-sm);
		line-height: var(--leading-relaxed);
	}
	.dialog-intro:last-of-type {
		margin-bottom: var(--space-4);
	}
	.dialog-intro a {
		color: inherit;
		text-decoration: underline;
	}
	.dialog-intro a:hover {
		color: var(--text-primary);
	}

	/* Acknowledgement cards — same treatment as the /waitlist page. */
	.consent-card {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-3);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-card);
		margin-bottom: var(--space-3);
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
		gap: 2px;
	}
	.consent-title {
		font-size: var(--text-base);
		font-weight: 500;
		color: var(--text-primary);
	}
	.consent-desc {
		font-size: var(--text-xs);
		color: var(--text-muted);
		line-height: var(--leading-normal, 1.5);
	}
	.consent-link {
		font-size: var(--text-xs);
		color: var(--text-link);
		margin-top: 2px;
	}
	.consent-link:hover {
		color: var(--text-link-hover);
	}

	.field {
		display: block;
		margin-bottom: var(--space-4);
	}

	.field-label {
		display: block;
		font-size: var(--text-sm);
		color: var(--text-muted);
		margin-bottom: var(--space-1);
	}

	.field input, .field textarea {
		width: 100%;
		font-size: var(--text-base);
		padding: var(--space-3);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input);
		background: transparent;
		color: var(--text-primary);
		box-sizing: border-box;
	}

	.field input:focus, .field textarea:focus {
		outline: none;
		border-color: var(--text-muted);
	}

	.field textarea { resize: vertical; line-height: var(--leading-relaxed); }

	.city-select {
		width: 100%;
		font-size: var(--text-base);
		padding: var(--space-3);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input);
		background: var(--bg-canvas);
		color: var(--text-primary);
		box-sizing: border-box;
		cursor: pointer;
	}
	.city-select:focus { outline: none; border-color: var(--text-muted); }

	.city-note {
		margin: var(--space-2) 0 0;
		font-size: var(--text-xs);
		color: var(--text-muted);
		line-height: 1.5;
	}

	/* "Other" free-text appears under the select when chosen. */
	.referral-other {
		margin-top: var(--space-2);
	}

	/* Post-signup newsletter pointer — the opt-in lives on Substack. */
	.newsletter-invite {
		margin-top: var(--space-4);
		font-size: var(--text-sm);
		color: var(--text-muted);
		line-height: 1.6;
	}
	.newsletter-invite a {
		color: var(--text-link);
	}

	.error-msg {
		font-size: var(--text-sm);
		color: var(--color-danger);
		margin: 0 0 var(--space-3);
	}

	.success-message {
		font-size: var(--text-md);
		line-height: var(--leading-relaxed);
		padding: var(--space-4) 0;
	}

	.success-message p { margin: 0; }

	/* .btn-primary / .btn-primary--block live in shared.css */

	.mode-switch {
		font-size: var(--text-sm);
		color: var(--text-muted);
		text-align: center;
		margin: var(--space-4) 0 0;
	}

	.link-btn {
		background: none;
		border: none;
		color: var(--text-link);
		cursor: pointer;
		font-size: inherit;
		padding: 0;
		text-decoration: underline;
	}

	a.link-btn { text-decoration: underline; }

	/* Mobile — same breakpoint as the (auth) layout. A floating card with
	   fixed side padding left almost no room for the consent cards/inputs
	   on a phone width; go edge-to-edge like the standalone /waitlist page
	   does (no side image there either), scrolling naturally instead of
	   being boxed into a small inset dialog. */
	@media (max-width: 430px) {
		.auth-overlay {
			padding: 0;
			align-items: flex-start;
		}

		.auth-dialog {
			max-width: 100%;
			min-height: 100vh;
			border-radius: 0;
		}

		.dialog-content {
			padding: var(--space-6) var(--space-4);
		}
	}
</style>
