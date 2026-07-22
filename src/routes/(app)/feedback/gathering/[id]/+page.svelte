<script lang="ts">
	import type { PageData } from './$types';
	import type { SelfReport } from '$lib/domain/types';
	import { capture } from '$lib/analytics';
	import { copy } from '$lib/copy';
	import {
		showsPerPersonFeedback,
		showsMeetAgain,
		attendanceAnswered
	} from '$lib/domain/gathering-feedback';
	import ConcernPanel from '$lib/components/ConcernPanel.svelte';

	let { data }: { data: PageData } = $props();

	// 'form' while collecting, 'done' after a successful submit.
	let step = $state<'form' | 'done'>('form');

	// ── Attendance (mandatory) ──────────────────────────────────────────
	let selfReport = $state<SelfReport | null>(null);
	let noBranchOpen = $state(false); // "No" expands into cancelled / didn't-go
	let absenceReason = $state('');

	// Host-only turnout attestation: member_id -> came?. Default everyone came;
	// the host toggles no-shows. Copy-on-write so runes track the mutation.
	let hostTurnout = $state<Record<string, boolean>>(
		Object.fromEntries(data.roster.map((m) => [m.member_id, true]))
	);

	// ── Per-person positive feedback (only when the caller turned up) ────
	let perPersonTags = $state<Map<string, Set<string>>>(new Map());
	let perPersonText = $state<Record<string, string>>({});

	// ── Meet-again pulse ────────────────────────────────────────────────
	let meetAgain = $state<boolean | null>(null);

	let submitting = $state(false);
	let submitError = $state('');

	const turnedUp = $derived(showsPerPersonFeedback(selfReport));
	const showMeetAgain = $derived(showsMeetAgain(selfReport));
	const canSubmit = $derived(attendanceAnswered(selfReport) && !submitting);

	function chooseYes() {
		selfReport = 'attended';
		noBranchOpen = false;
	}
	function chooseNo() {
		selfReport = null; // unset until they pick a specific reason
		noBranchOpen = true;
	}
	function toggleTurnout(memberId: string) {
		hostTurnout = { ...hostTurnout, [memberId]: !hostTurnout[memberId] };
	}
	function toggleTag(memberId: string, tag: string) {
		const next = new Map(perPersonTags);
		const set = new Set(next.get(memberId) ?? []);
		if (set.has(tag)) set.delete(tag);
		else set.add(tag);
		next.set(memberId, set);
		perPersonTags = next;
	}

	async function post(url: string, body: unknown): Promise<boolean> {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		return res.ok;
	}

	async function handleSubmit() {
		if (!canSubmit || selfReport === null) return;
		submitting = true;
		submitError = '';
		try {
			// 1. Attendance is mandatory and clears the gate. Host attests turnout
			//    only when they themselves turned up.
			const turnout =
				data.isHost && selfReport === 'attended' ? hostTurnout : undefined;
			const attendanceOk = await post('/api/feedback/gathering/attendance', {
				gathering_id: data.gatheringId,
				self_report: selfReport,
				absence_reason: selfReport === 'absent' ? absenceReason.trim() || undefined : undefined,
				turnout
			});
			if (!attendanceOk) {
				submitError = copy.common.submitFailed;
				return;
			}

			// 2. Per-person positive feedback — only for co-present pairs. Best-effort
			//    (the gate is re-enforced server-side); attendance already succeeded.
			if (turnedUp) {
				await Promise.all(
					data.roster
						.filter((m) => {
							const tags = perPersonTags.get(m.member_id);
							return (tags && tags.size > 0) || (perPersonText[m.member_id]?.trim() ?? '') !== '';
						})
						.map((m) =>
							post('/api/feedback/gathering/public', {
								gathering_id: data.gatheringId,
								reviewee_id: m.member_id,
								tags: [...(perPersonTags.get(m.member_id) ?? [])],
								free_text: perPersonText[m.member_id]?.trim() || undefined
							})
						)
				);
			}

			// 3. Meet-again pulse (collect-only) — only when the caller turned up.
			if (showMeetAgain && meetAgain !== null) {
				await post('/api/feedback/gathering/meet-again', {
					gathering_id: data.gatheringId,
					meet_again: meetAgain
				});
			}

			capture('gathering_feedback_submitted');
			step = 'done';
		} catch {
			submitError = copy.common.networkError;
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Feedback · dyad.social</title>
</svelte:head>

<div class="content">
	{#if step === 'done'}
		<div class="done-state">
			<h1 class="page-title">{copy.gatheringFeedback.thankYou}</h1>
			<p class="desc">{copy.gatheringFeedback.submitted}</p>
			<a href="/discover" class="continue-link">{copy.gatheringFeedback.continueToDiscover}</a>
		</div>
	{:else}
		<h1 class="page-title">{copy.gatheringFeedback.title}</h1>

		<!-- ═══ Attendance (mandatory) ═══ -->
		<fieldset class="field">
			<legend>{copy.gatheringFeedback.attendanceQuestion}</legend>
			<div class="choices">
				<button
					type="button"
					class="choice"
					class:selected={selfReport === 'attended'}
					onclick={chooseYes}
				>{copy.gatheringFeedback.wentYes}</button>
				<button
					type="button"
					class="choice"
					class:selected={noBranchOpen}
					onclick={chooseNo}
				>{copy.gatheringFeedback.wentNo}</button>
			</div>
		</fieldset>

		{#if noBranchOpen}
			<div class="field sub-branch">
				<button
					type="button"
					class="choice-line"
					class:selected={selfReport === 'cancelled_before'}
					onclick={() => (selfReport = 'cancelled_before')}
				>{copy.gatheringFeedback.cancelledOption}</button>
				<button
					type="button"
					class="choice-line"
					class:selected={selfReport === 'absent'}
					onclick={() => (selfReport = 'absent')}
				>{copy.gatheringFeedback.absentOption}</button>

				{#if selfReport === 'absent'}
					<label class="sub-label" for="absence-reason">{copy.gatheringFeedback.absenceReasonLabel}</label>
					<textarea
						id="absence-reason"
						bind:value={absenceReason}
						rows={2}
						placeholder={copy.gatheringFeedback.optional}
						maxlength={500}
					></textarea>
				{/if}
			</div>
		{/if}

		<!-- ═══ Host turnout attestation ═══ -->
		{#if data.isHost && selfReport === 'attended' && data.roster.length > 0}
			<fieldset class="field">
				<legend>{copy.gatheringFeedback.hostTurnoutHeading}</legend>
				<p class="desc">{copy.gatheringFeedback.hostTurnoutHint}</p>
				{#each data.roster as member}
					<div class="turnout-row">
						<span class="member-name">{member.display_name}</span>
						<div class="turnout-toggle">
							<button
								type="button"
								class="pill"
								class:selected={hostTurnout[member.member_id]}
								onclick={() => hostTurnout[member.member_id] || toggleTurnout(member.member_id)}
							>{copy.gatheringFeedback.present}</button>
							<button
								type="button"
								class="pill"
								class:selected={!hostTurnout[member.member_id]}
								onclick={() => hostTurnout[member.member_id] && toggleTurnout(member.member_id)}
							>{copy.gatheringFeedback.noShow}</button>
						</div>
					</div>
				{/each}
			</fieldset>
		{/if}

		<!-- ═══ Per-person feedback — co-presence gated ═══ -->
		{#if attendanceAnswered(selfReport) && data.roster.length > 0}
			{#if turnedUp}
				<div class="people">
					<h2 class="section-title">{copy.gatheringFeedback.peopleHeading}</h2>
					{#each data.roster as member}
						<div class="person-card">
							<span class="member-name">{member.display_name}</span>

							{#if data.vocabulary.length > 0}
								<p class="desc">{copy.gatheringFeedback.positiveLabel}</p>
								<div class="tag-grid">
									{#each data.vocabulary as tag}
										<button
											type="button"
											class="tag"
											class:selected={perPersonTags.get(member.member_id)?.has(tag)}
											onclick={() => toggleTag(member.member_id, tag)}
										>{tag}</button>
									{/each}
								</div>
							{/if}

							<textarea
								bind:value={perPersonText[member.member_id]}
								rows={2}
								placeholder={copy.gatheringFeedback.positiveTextPlaceholder}
								maxlength={2000}
							></textarea>
							<p class="micro-note">{copy.gatheringFeedback.positiveNote}</p>

							{#if data.safetyReportingEnabled}
								<ConcernPanel
									slotId={data.slotId}
									gatheringId={data.gatheringId}
									scope="person"
									subjectId={member.member_id}
									name={member.display_name}
								/>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<p class="desc">{copy.gatheringFeedback.didntGoNote}</p>
			{/if}
		{/if}

		<!-- ═══ Meet-again pulse ═══ -->
		{#if showMeetAgain}
			<fieldset class="field">
				<legend>{copy.gatheringFeedback.meetAgainQuestion}</legend>
				<div class="choices">
					<button
						type="button"
						class="choice"
						class:selected={meetAgain === true}
						onclick={() => (meetAgain = true)}
					>{copy.gatheringFeedback.yes}</button>
					<button
						type="button"
						class="choice"
						class:selected={meetAgain === false}
						onclick={() => (meetAgain = false)}
					>{copy.gatheringFeedback.no}</button>
				</div>
			</fieldset>
		{/if}

		<!-- ═══ Meeting-level concern — turnout-blind, but gated on the safety-
		     reporting kill-switch (R9): hidden until the concern store is live ═══ -->
		{#if attendanceAnswered(selfReport) && data.safetyReportingEnabled}
			<div class="meeting-concern">
				<ConcernPanel slotId={data.slotId} gatheringId={data.gatheringId} scope="gathering" />
			</div>
		{/if}

		{#if submitError}<p class="field-error">{submitError}</p>{/if}

		<button class="btn-primary" onclick={handleSubmit} disabled={!canSubmit}>
			{submitting ? copy.gatheringFeedback.submitting : copy.gatheringFeedback.submit}
		</button>
	{/if}

	<div class="sign-out-section">
		<form method="POST" action="/logout" class="sign-out-form">
			<button type="submit">{copy.nav.signOut}</button>
		</form>
	</div>
</div>

<style>
	.content {
		position: relative;
		width: 100%;
		max-width: 420px;
		background: var(--bg-canvas);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-card);
		padding: var(--space-8) var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		margin-top: var(--space-10);
	}

	.page-title { font-size: var(--text-xl); font-weight: 500; margin: 0; }
	.section-title { font-size: var(--text-base); font-weight: 500; margin: 0 0 var(--space-2); }
	.desc { font-size: var(--text-sm); color: var(--text-muted); margin: 0; }
	.micro-note { font-size: var(--text-xs); color: var(--text-muted); margin: 0; }

	.field { display: flex; flex-direction: column; gap: var(--space-2); border: none; padding: 0; margin: 0; }
	.field legend { font-size: var(--text-sm); color: var(--text-muted); padding: 0; }

	.choices { display: flex; gap: var(--space-3); }
	.choice {
		flex: 1;
		font-size: var(--text-base);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input);
		background: none;
		color: var(--text-primary);
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}
	.choice:hover { border-color: var(--text-primary); }
	.choice.selected { background: var(--text-primary); color: var(--bg-canvas); border-color: var(--text-primary); }

	.sub-branch { gap: var(--space-2); padding-left: var(--space-2); border-left: 2px solid var(--border-link); }
	.choice-line {
		text-align: left;
		font-size: var(--text-base);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input);
		background: none;
		color: var(--text-primary);
		cursor: pointer;
	}
	.choice-line:hover { border-color: var(--text-primary); }
	.choice-line.selected { background: var(--text-primary); color: var(--bg-canvas); border-color: var(--text-primary); }
	.sub-label { font-size: var(--text-sm); color: var(--text-muted); }

	.turnout-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
	.member-name { font-size: var(--text-base); color: var(--text-primary); }
	.turnout-toggle { display: flex; gap: var(--space-2); }
	.pill {
		font-size: var(--text-sm);
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-card);
		background: none;
		color: var(--text-primary);
		cursor: pointer;
	}
	.pill.selected { background: var(--text-primary); color: var(--bg-canvas); border-color: var(--text-primary); }

	.people { display: flex; flex-direction: column; gap: var(--space-4); }
	.person-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4) 0;
		border-top: 1px solid var(--border-link);
	}

	.tag-grid { display: flex; flex-wrap: wrap; gap: var(--space-2); }
	.tag {
		font-size: var(--text-sm);
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-card);
		background: none;
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.15s;
	}
	.tag:hover { border-color: var(--text-primary); }
	.tag.selected { background: var(--text-primary); color: var(--bg-canvas); border-color: var(--text-primary); }

	textarea {
		font-size: var(--text-base);
		padding: var(--space-3);
		border: 1px solid var(--border-link);
		border-radius: var(--radius-input);
		background: transparent;
		color: var(--text-primary);
		resize: vertical;
		line-height: 1.6;
		width: 100%;
		box-sizing: border-box;
	}
	textarea:focus { outline: none; border-color: var(--text-muted); }
	textarea::placeholder { color: var(--text-muted); }

	.meeting-concern { padding-top: var(--space-2); }
	.field-error { font-size: var(--text-sm); color: var(--color-danger); margin: 0; }

	.done-state { display: flex; flex-direction: column; gap: var(--space-3); }
	.continue-link { font-size: var(--text-base); color: var(--text-primary); text-decoration: underline; }

	.sign-out-section {
		padding: var(--space-6) 0 0;
		text-align: center;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
	.sign-out-section button { color: var(--text-muted); text-decoration: underline; }
	.sign-out-section .sign-out-form { margin: 0; padding: 0; }
	.sign-out-section button { background: none; border: none; cursor: pointer; font: inherit; }
</style>
