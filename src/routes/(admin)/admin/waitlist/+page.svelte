<script lang="ts">
	import type { PageData } from './$types';
	import { copy } from '$lib/copy';

	let { data }: { data: PageData } = $props();

	// Map a stored referral value to its friendly label. Option keys resolve to
	// their label; free text typed under "other" passes through unchanged.
	const referralLabels = new Map<string, string>(
		copy.waitlist.referralOptions.map((o) => [o.value, o.label])
	);
	const referralDisplay = (v: string | null | undefined) =>
		v ? (referralLabels.get(v) ?? v) : null;

	// Per-row compose state: which row is expanded, and what opener + message
	// the admin has typed for each email. Keyed by email so reopening a row
	// keeps the draft. Both are shared across the row's Send button.
	let expandedEmail = $state<string | null>(null);
	let openerByEmail = $state<Record<string, string>>({});
	let messageByEmail = $state<Record<string, string>>({});
	let invitingEmail = $state<string | null>(null);
	let inviteResult = $state<{ email: string; message: string; url?: string } | null>(null);

	const MESSAGE_MAX = 2000;

	async function send(email: string, name: string | null, message: string, recipientName: string | null) {
		invitingEmail = email;
		inviteResult = null;
		try {
			const res = await fetch('/admin/invites/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email,
					name,
					message: message.trim() || undefined,
					recipientName: recipientName?.trim() || undefined
				})
			});
			const body = await res.json();
			if (res.ok) {
				inviteResult = {
					email,
					message: body.alreadyInvited ? 'Already accepted — email re-sent.' : 'Accepted.',
					url: body.inviteUrl
				};
			} else if (res.status === 409) {
				inviteResult = { email, message: 'Already signed up.' };
			} else {
				inviteResult = { email, message: body.error ?? 'Failed to accept.' };
			}
		} catch {
			inviteResult = { email, message: 'Network error.' };
		} finally {
			invitingEmail = null;
		}
	}

	async function inviteWaitlisted(contact: { email: string; name: string | null }) {
		// Personalized path: the admin wrote the opener/message by hand.
		const opener = openerByEmail[contact.email] ?? '';
		const msg = messageByEmail[contact.email] ?? '';
		await send(contact.email, opener.trim() || null, msg, contact.name);
		if (inviteResult && !inviteResult.message.startsWith('Failed') && !inviteResult.message.startsWith('Network')) {
			const { [contact.email]: _o, ...restOpeners } = openerByEmail;
			const { [contact.email]: _m, ...restMessages } = messageByEmail;
			openerByEmail = restOpeners;
			messageByEmail = restMessages;
			expandedEmail = null;
		}
	}

	/** One-click accept: the templated join email goes out as-is, with the
	 *  greeting built from the name the person gave on the waitlist form.
	 *  Nothing to type — the template (copy.email.invite*) carries the words. */
	async function acceptWithTemplate(contact: { email: string; name: string | null }) {
		await send(contact.email, null, '', contact.name);
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	// Provider join requests (substrate-verified, e.g. atproto): approving grants
	// the scope so the person's next sign-in is admitted. Pending requests are
	// the ones awaiting a decision.
	let deciding = $state<string | null>(null);
	let decided = $state<Record<string, 'approved' | 'declined' | 'failed'>>({});

	const pendingRequests = $derived(data.joinRequests.filter((r) => r.decided_at === null));

	async function decide(id: string, action: 'approve' | 'decline') {
		deciding = id;
		try {
			const res = await fetch('/admin/waitlist/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, action })
			});
			decided = { ...decided, [id]: res.ok ? (action === 'approve' ? 'approved' : 'declined') : 'failed' };
		} catch {
			decided = { ...decided, [id]: 'failed' };
		} finally {
			deciding = null;
		}
	}
</script>

<svelte:head>
	<title>Waitlist · Admin</title>
</svelte:head>

<h1 class="admin-title">Waitlist</h1>
<p class="admin-subtitle">{data.waitlist.length} contacts</p>

{#if pendingRequests.length > 0}
	<section class="join-requests">
		<h2>Join requests</h2>
		<p class="admin-subtitle">{pendingRequests.length} awaiting a decision</p>
		{#each pendingRequests as req (req.id)}
			<div class="request-row">
				<div class="request-info">
					<span class="request-handle">{req.handle ?? req.substrate_id}</span>
					<span class="badge badge-provider">{req.substrate}</span>
					<span class="request-scope">{req.scope}</span>
					<span class="contact-date">{formatDate(req.requested_at)}</span>
				</div>
				{#if decided[req.id]}
					<span class="request-decided">{decided[req.id]}</span>
				{:else}
					<div class="request-actions">
						<button
							class="btn-primary"
							disabled={deciding === req.id}
							onclick={() => decide(req.id, 'approve')}>approve</button
						>
						<button
							class="btn-ghost"
							disabled={deciding === req.id}
							onclick={() => decide(req.id, 'decline')}>decline</button
						>
					</div>
				{/if}
			</div>
		{/each}
	</section>
{/if}

{#if inviteResult}
	<div class="invite-result">
		<div class="invite-result-main">
			<strong>{inviteResult.email}:</strong> {inviteResult.message}
			{#if inviteResult.url}
				<div class="invite-url">Link: <a href={inviteResult.url}>{inviteResult.url}</a></div>
			{/if}
		</div>
		<button class="dismiss" onclick={() => (inviteResult = null)} aria-label="Dismiss">×</button>
	</div>
{/if}

<div class="waitlist">
	{#each data.waitlist as contact}
		<div class="contact-row">
			<div class="contact-info">
				<div class="contact-header">
					<span class="contact-name">{contact.name ?? 'Anonymous'}</span>
					<span class="contact-email">{contact.email}</span>
					<span class="badge badge-{contact.status}">{contact.status.replace('_', ' ')}</span>
					{#if contact.referred_by_username}
						<span class="badge badge-referred">invited by @{contact.referred_by_username}</span>
						{#if contact.status !== 'signed_up'}
							<span class="badge badge-fasttrack">review within 2 days</span>
						{/if}
					{/if}
				</div>
				{#if contact.based_in}
					<span class="contact-city">{contact.based_in}</span>
				{/if}
				{#if referralDisplay(contact.referral_source)}
					<span class="contact-referral">via {referralDisplay(contact.referral_source)}</span>
				{/if}
				{#if contact.freewrite}
					<p class="contact-freewrite">
						{contact.freewrite.length > 200 ? contact.freewrite.slice(0, 200) + '...' : contact.freewrite}
					</p>
				{/if}
				<span class="contact-date">{formatDate(contact.created_at)}</span>

				{#if expandedEmail === contact.email}
					<label class="compose">
						<span>Opener <em>(optional, verbatim at the top)</em></span>
						<input
							type="text"
							bind:value={openerByEmail[contact.email]}
							placeholder={'e.g. "Hi ' + (contact.name ?? 'there') + ',"'}
							disabled={invitingEmail === contact.email}
						/>
					</label>
					<label class="compose">
						<span
							>Message <em>(optional, rendered as a quote)</em>
							<span
								class="charcount"
								class:over={(messageByEmail[contact.email]?.length ?? 0) > MESSAGE_MAX}
								>{messageByEmail[contact.email]?.length ?? 0} / {MESSAGE_MAX}</span
							></span
						>
						<textarea
							bind:value={messageByEmail[contact.email]}
							rows={3}
							maxlength={MESSAGE_MAX}
							placeholder="A line or two — why you thought of them, what to expect."
							disabled={invitingEmail === contact.email}
						></textarea>
					</label>
				{/if}
			</div>
			<div class="contact-actions">
				{#if contact.status === 'not_invited' || contact.status === 'expired'}
					{#if expandedEmail === contact.email}
						<button
							class="btn-primary"
							onclick={() => inviteWaitlisted(contact)}
							disabled={invitingEmail === contact.email}
						>
							{invitingEmail === contact.email
								? 'Sending...'
								: contact.status === 'expired'
									? 'Re-accept'
									: 'Accept'}
						</button>
						<button class="btn-ghost" onclick={() => (expandedEmail = null)} disabled={invitingEmail === contact.email}>
							Cancel
						</button>
					{:else}
						<button
							class="btn-primary"
							onclick={() => acceptWithTemplate(contact)}
							disabled={invitingEmail === contact.email}
						>
							{invitingEmail === contact.email
								? 'Sending...'
								: contact.status === 'expired'
									? 'Re-accept & send'
									: 'Accept & send'}
						</button>
						<button class="btn-ghost" onclick={() => (expandedEmail = contact.email)}>
							personalize
						</button>
					{/if}
				{:else if contact.status === 'signed_up'}
					<span class="status-done">Joined</span>
				{:else}
					<span class="status-pending">Pending</span>
				{/if}
			</div>
		</div>
	{/each}
</div>

<style>
	.admin-title { font-size: var(--text-2xl); font-weight: normal; margin: 0 0 var(--space-1); }
	.admin-subtitle { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-muted); margin: 0 0 var(--space-6); }

	.invite-result {
		padding: var(--space-3) var(--space-4);
		background: rgba(61, 158, 90, 0.08);
		border-radius: var(--radius-input);
		margin-bottom: var(--space-4);
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		font-size: var(--text-sm);
	}
	.invite-result-main { flex: 1; min-width: 0; }
	.invite-url { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-muted); margin-top: var(--space-1); word-break: break-all; }
	.dismiss { margin-left: auto; font-size: var(--text-lg); color: var(--text-muted); }

	.compose {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin-top: var(--space-3);
		font-size: var(--text-sm);
	}
	.compose > span { color: var(--text-secondary); display: flex; align-items: baseline; gap: var(--space-2); }
	.compose em { font-style: normal; color: var(--text-muted); font-size: var(--text-xs); }

	.charcount { margin-left: auto; font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-muted); }
	.charcount.over { color: var(--color-danger); }

	input, textarea {
		width: 100%;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input);
		font-family: inherit;
		font-size: var(--text-sm);
		background: var(--bg-canvas);
		color: var(--text-primary);
		box-sizing: border-box;
		resize: vertical;
	}
	input:focus, textarea:focus { outline: none; border-color: var(--text-muted); }
	input:disabled, textarea:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }

	.contact-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: var(--space-4) 0;
		border-bottom: 1px solid var(--border-link);
		gap: var(--space-4);
	}
	.contact-row:last-child { border-bottom: none; }

	.contact-info { flex: 1; min-width: 0; }
	.contact-header { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-1); }
	.contact-name { font-weight: 500; }
	.contact-email { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-muted); }
	.contact-city { font-size: var(--text-sm); color: var(--text-muted); display: block; margin-bottom: var(--space-1); }
	.contact-referral { font-size: var(--text-xs); color: var(--text-muted); font-style: italic; display: block; margin-bottom: var(--space-1); }
	.contact-freewrite { font-size: var(--text-sm); color: var(--text-secondary); margin: var(--space-2) 0; line-height: var(--leading-normal); }
	.contact-date { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-muted); }

	.badge {
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 2px 6px;
		border-radius: 3px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.badge-not_invited { background: color-mix(in srgb, var(--text-primary) 6%, transparent); color: var(--text-muted); }
	.badge-invited { background: rgba(245,158,11,0.12); color: #b45309; }
	.badge-expired { background: rgba(239,68,68,0.12); color: #dc2626; }
	.badge-signed_up { background: rgba(61,158,90,0.12); color: #2d7a42; }
	.badge-provider { background: color-mix(in srgb, var(--color-accent) 12%, transparent); color: var(--color-accent); }
	.badge-referred { background: rgba(99,102,241,0.12); color: #4f46e5; text-transform: none; }
	.badge-fasttrack { background: rgba(245,158,11,0.18); color: #92400e; }

	.join-requests { margin-bottom: var(--space-6); }
	.join-requests h2 { font-size: var(--text-lg); margin: 0 0 var(--space-1) 0; color: var(--text-primary); }
	.request-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--border-subtle);
	}
	.request-info { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
	.request-handle { font-weight: 500; color: var(--text-primary); }
	.request-scope { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-secondary); }
	.request-actions { display: flex; gap: var(--space-2); flex-shrink: 0; }
	.request-decided { font-size: var(--text-sm); color: var(--text-muted); text-transform: capitalize; }

	.contact-actions { flex-shrink: 0; display: flex; flex-direction: column; gap: var(--space-2); }
	.btn-ghost {
		font-family: inherit;
		font-size: var(--text-sm);
		color: var(--text-muted);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}
	.btn-ghost:hover { color: var(--text-primary); }
	.btn-ghost:disabled { opacity: var(--opacity-disabled); cursor: not-allowed; }

	.status-done { font-family: var(--font-mono); font-size: var(--text-xs); color: #2d7a42; }
	.status-pending { font-family: var(--font-mono); font-size: var(--text-xs); color: #b45309; }
</style>
