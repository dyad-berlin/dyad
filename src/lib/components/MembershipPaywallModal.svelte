<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { copy } from '$lib/copy';
	import MembershipOffer from './MembershipOffer.svelte';

	// The paywall modal: a calm overlay laid over the current page (Option A,
	// where the context dims behind and nothing is lost). It wraps the shared
	// <MembershipOffer/> so the join/renew offer never diverges from /membership.
	//
	// The exit is always honest and always available: "Not now" closes, Escape
	// closes, the scrim closes. There is no countdown and no fake scarcity. The
	// page the member was on is still there behind the dim, and on the
	// conversation page their half-written words are held so a dismiss loses
	// nothing.
	type Mode = 'join' | 'renew' | 'ended';

	let {
		open = $bindable(false),
		mode = 'join',
		returnTo = null,
		onclose
	}: {
		open?: boolean;
		mode?: Mode;
		returnTo?: string | null;
		onclose?: () => void;
	} = $props();

	let dialog = $state<HTMLElement | undefined>();
	// The element focused when the modal opened, so focus can return to the
	// trigger (the button the member tapped) on close.
	let previouslyFocused: HTMLElement | null = null;
	let reducedMotion = $state(false);

	onMount(() => {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	});

	function close() {
		open = false;
		onclose?.();
	}

	// Body scroll-lock + focus capture/restore, driven by `open` so the modal
	// can be opened/closed repeatedly on the same page without remounting.
	$effect(() => {
		if (typeof document === 'undefined') return;
		if (open) {
			previouslyFocused = (document.activeElement as HTMLElement) ?? null;
			const prevOverflow = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
			// Move focus into the dialog once it has rendered — the close button
			// carries [data-autofocus], falling back to the dialog container.
			tick().then(() => {
				const target = dialog?.querySelector<HTMLElement>('[data-autofocus]');
				if (target) target.focus();
				else dialog?.focus();
			});
			return () => {
				document.body.style.overflow = prevOverflow;
			};
		}
	});

	// Restore focus to the trigger after the dialog leaves the DOM.
	function restoreFocus() {
		previouslyFocused?.focus();
		previouslyFocused = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
			return;
		}
		if (e.key === 'Tab') {
			// Focus trap: keep Tab within the dialog.
			const focusables = dialog?.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
			);
			if (!focusables || focusables.length === 0) return;
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const active = document.activeElement as HTMLElement | null;
			if (e.shiftKey && active === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && active === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="paywall-overlay"
		onclick={(e) => {
			if (e.target === e.currentTarget) close();
		}}
		transition:fade={{ duration: reducedMotion ? 1 : 200 }}
		onoutroend={restoreFocus}
	>
		<div
			class="paywall-dialog"
			role="dialog"
			aria-modal="true"
			aria-label={copy.membership.dialogLabel}
			tabindex="-1"
			bind:this={dialog}
			onclick={(e) => e.stopPropagation()}
			transition:fly={{ y: reducedMotion ? 0 : 24, duration: reducedMotion ? 1 : 260 }}
		>
			<button
				type="button"
				class="paywall-close"
				onclick={close}
				aria-label={copy.common.close}
				data-autofocus
			>&times;</button>

			<!-- MembershipOffer renders the whole offer including its own <h2>
			     heading (mode-driven). The dialog is labelled via aria-label above
			     rather than the offer's heading, since the offer owns no stable id. -->
			<div class="paywall-body">
				<MembershipOffer {mode} {returnTo} />
			</div>

			<button type="button" class="paywall-dismiss" onclick={close}>
				{copy.common.notNow}
			</button>
		</div>
	</div>
{/if}

<style>
	.paywall-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
		box-sizing: border-box;
		/* Dim the context behind rather than hide it — the page is still there. */
		background: rgba(0, 0, 0, 0.5);
		overflow-y: auto;
	}

	.paywall-dialog {
		position: relative;
		width: 100%;
		max-width: 34rem;
		background: var(--bg-canvas);
		color: var(--text-primary);
		border-radius: var(--radius-card);
		padding: var(--space-8) var(--space-6) var(--space-6);
		box-sizing: border-box;
		box-shadow: 0 8px 48px rgba(0, 0, 0, 0.24);
		max-height: calc(100vh - var(--space-8));
		overflow-y: auto;
	}

	.paywall-close {
		position: absolute;
		top: var(--space-4);
		right: var(--space-4);
		background: none;
		border: none;
		font-size: var(--text-2xl);
		line-height: 1;
		color: var(--text-muted);
		cursor: pointer;
		padding: var(--space-1);
	}
	.paywall-close:hover {
		color: var(--text-primary);
	}

	.paywall-body {
		margin-top: var(--space-2);
	}

	/* The honest exit — always present, quiet, and clearly not the primary path. */
	.paywall-dismiss {
		display: block;
		width: 100%;
		margin-top: var(--space-4);
		padding: var(--space-3);
		background: none;
		border: none;
		font-size: var(--text-sm);
		color: var(--text-muted);
		cursor: pointer;
	}
	.paywall-dismiss:hover {
		color: var(--text-primary);
	}
</style>
