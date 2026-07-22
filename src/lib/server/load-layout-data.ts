import { redirect } from '@sveltejs/kit';
import { userToUpactor } from '@prefig/upact-supabase';
import { toMembershipDisplay, type MembershipRow } from '$lib/domain/membership.js';
import { getGatheringFeedbackGateEnabled } from '$lib/server/app-settings.js';

/**
 * Shared layout data loader for authenticated route groups.
 * Used by both (app) and (editor) layouts.
 */
export async function loadLayoutData(locals: App.Locals, url?: URL) {
	if (!locals.user) {
		// Preserve the intended destination so login can resume there (e.g. an
		// invitation email deep-link to /conversations/{id}). Falls back to a
		// bare /login when no url is threaded.
		const returnTo = url ? url.pathname + url.search : '';
		redirect(302, returnTo ? `/login?redirectTo=${encodeURIComponent(returnTo)}` : '/login');
	}

	const pendingFormId = (locals as any).pendingFeedbackFormId as string | undefined;

	const [{ data: profile }, { count: invitationCount }, { count: feedbackCount }, { data: groupRows }, { data: gatheringRows }, { data: pendingParticipation }, gatheringGateEnabled, pendingFeedback, { data: notif, error: notifError }, { data: membershipRow, error: membershipError }] = await Promise.all([
		locals.supabase
			.from('profiles')
			.select('username, onboarded')
			.eq('id', locals.user.id)
			.single(),
		// Inner-join on the slot so past-slot pending invitations don't count:
		// the profile and conversation loaders hide them (no longer actionable),
		// and a badge that counts what the lists hide would never clear.
		locals.supabase
			.from('prompt_invitations')
			.select('slot:slot_id!inner(start_time)', { count: 'exact', head: true })
			.eq('invitee_id', locals.user.id)
			.eq('state', 'pending')
			.gt('slot.start_time', new Date().toISOString()),
		locals.supabase
			.from('feedback_forms')
			.select('*', { count: 'exact', head: true })
			.eq('reviewer_id', locals.user.id)
			.eq('state', 'due'),
		// My legacy group_feedback rows (id/slot/state). Whether each counts is
		// decided in JS to mirror the U9 gate: a group_feedback 'due' row is
		// SUPPRESSED when its slot has a gathering row (the new participation
		// obligation carries it instead) — no double-count.
		locals.supabase
			.from('group_feedback')
			.select('id, slot_id, state')
			.eq('reviewer_id', locals.user.id),
		// My gatherings (id → slot_id). Marks which slots have a gathering row
		// (drives group_feedback suppression) and, joined with group_feedback
		// slots, which gatherings are GROUP gatherings (drive the new obligation).
		locals.supabase.from('gatherings').select('id, slot_id'),
		// My unconfirmed attendance obligations (participation.self_report NULL).
		locals.supabase
			.from('participation')
			.select('gathering_id')
			.eq('member_id', locals.user.id)
			.is('self_report', null),
		// The U9 gate flag (app_settings, default + fail-safe TRUE). Keeps the
		// badge aligned with what hooks.server.ts enforces.
		getGatheringFeedbackGateEnabled(),
		pendingFormId ? loadPendingFeedback(locals, pendingFormId) : Promise.resolve(null),
		// The notification address is the opt-in; its presence is the only signal the
		// contextual hints need. Select only `email` and return a boolean — never the
		// address itself (owner-only PII). A failed read fails safe to "has address"
		// so a transient error never nags an opted-in member.
		locals.supabase
			.from('notification_settings')
			.select('email')
			.eq('user_id', locals.user.id)
			.maybeSingle(),
		// Display-only: lets the (app) UI reflect membership state (lapsed nudge
		// before a 403, post-feedback CTA). Safe columns only — no payment_ref/stripe_*.
		locals.supabase
			.from('memberships')
			.select('active, cadence, source')
			.eq('identity_id', locals.user.id)
			.maybeSingle()
	]);

	if (notifError) {
		console.error('[layout loader] notification_settings fetch failed:', notifError);
	}
	// Fails safe to null (member appears non-member, no lapsed nudge). Log so a
	// transient error masking membership state isn't silent — mirrors notifError.
	if (membershipError) {
		console.error('[layout loader] memberships fetch failed:', membershipError);
	}

	// Attention badge mirrors the U9 feedback gate (my_feedback_gate): one_on_one
	// (feedback_forms due) always counts; the gathering + group counts depend on
	// the flag. When enabled, a group gathering's obligation is the unconfirmed
	// participation (gatheringCount) and its legacy group_feedback 'due' row is
	// suppressed; a pre-U4 group_feedback row (no gathering) still counts. When
	// disabled, all group_feedback 'due' rows count and no participation does.
	const gatheringSlots = new Set((gatheringRows ?? []).map((g) => g.slot_id));
	const gatheringIdToSlot = new Map((gatheringRows ?? []).map((g) => [g.id, g.slot_id]));
	const groupFeedbackSlots = new Set((groupRows ?? []).map((g) => g.slot_id));

	let gatheringCount = 0;
	let groupCount = 0;
	if (gatheringGateEnabled) {
		// Group gatherings only: an unconfirmed participation whose gathering's slot
		// also carries group_feedback (the legacy group-branch marker). 1-on-1
		// participations are excluded here and stay on the feedback_forms gate.
		gatheringCount = (pendingParticipation ?? []).filter((p) => {
			const slot = gatheringIdToSlot.get(p.gathering_id);
			return slot != null && groupFeedbackSlots.has(slot);
		}).length;
		groupCount = (groupRows ?? []).filter(
			(g) => g.state === 'due' && !gatheringSlots.has(g.slot_id)
		).length;
	} else {
		groupCount = (groupRows ?? []).filter((g) => g.state === 'due').length;
	}

	return {
		identity: userToUpactor(locals.user),
		username: profile?.username ?? '',
		// Per-user durable onboarding flag (profiles.onboarded). The discover
		// welcome modal gates on this, not a browser-global localStorage flag —
		// otherwise a second account on the same browser is wrongly treated as
		// already onboarded and never sees the welcome flow.
		onboarded: profile?.onboarded ?? false,
		attentionCount: (invitationCount ?? 0) + (feedbackCount ?? 0) + gatheringCount + groupCount,
		pendingFeedback,
		hasNotificationEmail: notifError ? true : !!notif?.email,
		membership: toMembershipDisplay(membershipRow as MembershipRow | null)
	};
}

async function loadPendingFeedback(locals: App.Locals, formId: string) {
	const userId = locals.user!.id;

	const [{ data: form }, { data: vocabRows }, meetingContext] = await Promise.all([
		locals.supabase
			.from('feedback_forms')
			.select('id, meeting_id, state')
			.eq('id', formId)
			.eq('reviewer_id', userId)
			.single(),
		locals.supabase
			.from('adjective_vocabulary')
			.select('word')
			.eq('active', true)
			.order('word'),
		loadMeetingContext(locals, formId, userId)
	]);

	if (!form) return null;

	return {
		formId: form.id,
		meetingId: form.meeting_id as string,
		state: form.state as string,
		vocabulary: (vocabRows ?? []).map((r: { word: string }) => r.word),
		meetingContext
	};
}

async function loadMeetingContext(locals: App.Locals, formId: string, userId: string) {
	const { data: form } = await locals.supabase
		.from('feedback_forms')
		.select('meeting_id')
		.eq('id', formId)
		.single();

	if (!form?.meeting_id) return null;

	const { data: meeting } = await locals.supabase
		.from('meetings')
		.select('scheduled_time, participant_a, participant_b')
		.eq('id', form.meeting_id)
		.single();

	if (!meeting) return null;

	const otherId = meeting.participant_a === userId ? meeting.participant_b : meeting.participant_a;
	const { data: otherProfile } = await locals.supabase
		.from('profiles')
		.select('username')
		.eq('id', otherId)
		.single();

	return {
		otherUsername: otherProfile?.username ?? 'someone',
		meetingDate: new Date(meeting.scheduled_time).toLocaleDateString('en-US', {
			weekday: 'long', month: 'long', day: 'numeric'
		})
	};
}
