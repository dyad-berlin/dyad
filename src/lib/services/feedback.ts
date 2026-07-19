import type { SupabaseClient } from '@supabase/supabase-js';
import type {
	FeedbackForm,
	FeedbackFormState,
	RevealedFeedback,
	GroupFeedback,
	GroupFeedbackState,
	AttendanceInput,
	PublicFeedbackInput,
	SafetyConcernInput,
	RosterMember,
	ReputationSignal
} from '$lib/domain/types.js';

export interface FeedbackInput {
	did_meet: boolean;
	no_show_reason?: string;
	rating_tags?: string[];
	free_text?: string;
	share_with_person?: string;
	share_with_platform?: string;
	platform_comments?: string;
}

export interface GroupFeedbackInput {
	meet_again: boolean;
	comment?: string;
	personal_feedback?: string;
}

export interface FeedbackService {
	getMyForm(meetingId: string, userId: string): Promise<FeedbackForm | null>;
	getFormById(formId: string, userId: string): Promise<FeedbackForm | null>;
	submit(formId: string, data: FeedbackInput): Promise<FeedbackFormState>;
	getRevealedFeedback(meetingId: string, userId: string): Promise<RevealedFeedback[]>;
	getVocabulary(): Promise<string[]>;
	getGroupFormById(formId: string, userId: string): Promise<GroupFeedback | null>;
	submitGroupFeedback(formId: string, data: GroupFeedbackInput): Promise<GroupFeedbackState>;

	// ── Unified gathering feedback write path (U5) ──────────────────────────
	submitAttendance(data: AttendanceInput): Promise<void>;
	submitPublicFeedback(data: PublicFeedbackInput): Promise<void>;
	/** Returns true if a subject-owned row was promoted, false otherwise. */
	promotePublicFeedback(feedbackId: string): Promise<boolean>;
	submitConcern(data: SafetyConcernInput): Promise<void>;
	/** Co-participant roster (caller excluded) for a gathering the caller is in. */
	getGatheringRoster(gatheringId: string): Promise<RosterMember[]>;
	/** Records the caller's collect-only "would you meet again" answer. */
	submitMeetAgain(gatheringId: string, meetAgain: boolean): Promise<void>;

	// ── Feature feedback on profile ──────────────────────────────────────
	/** The caller's own feedback_received signal for one meeting (null if
	 *  feedback hasn't locked yet, or a signal wasn't created for some other
	 *  reason). Used to render the feature-on-profile toggle next to a
	 *  revealed feedback card. */
	getReputationSignalForMeeting(meetingId: string, userId: string): Promise<ReputationSignal | null>;
	/** ALL of the caller's own feedback_received signals — visible and
	 *  hidden alike (RLS: "Profile owner reads own signals"), newest first.
	 *  Powers the /profile "Feedback you've received" management list, so a
	 *  member can find and feature any past feedback without already
	 *  knowing which meeting it came from. */
	getMyReputationSignals(profileId: string): Promise<ReputationSignal[]>;
	/** Visible feedback_received signals for a profile, newest first — RLS
	 *  scopes this to visible=true rows for anyone but the profile owner. */
	getVisibleReputationSignals(profileId: string): Promise<ReputationSignal[]>;
	/** Returns true if the caller's own signal was updated, false otherwise
	 *  (not found / not owned / not a feedback_received signal). */
	setReputationSignalVisibility(signalId: string, visible: boolean): Promise<boolean>;
}

export class SupabaseFeedbackService implements FeedbackService {
	constructor(private supabase: SupabaseClient) {}

	async getMyForm(meetingId: string, userId: string): Promise<FeedbackForm | null> {
		const { data, error } = await this.supabase
			.from('feedback_forms')
			.select('id, meeting_id, reviewer_id, reviewee_id, did_meet, no_show_reason, rating_tags, free_text, share_with_person, state, submitted_at, locked_at, created_at')
			.eq('meeting_id', meetingId)
			.eq('reviewer_id', userId)
			.maybeSingle();

		if (error) throw new Error(`Failed to load feedback form: ${error.message}`);
		return data as FeedbackForm | null;
	}

	async getFormById(formId: string, userId: string): Promise<FeedbackForm | null> {
		const { data, error } = await this.supabase
			.from('feedback_forms')
			.select('id, meeting_id, reviewer_id, reviewee_id, did_meet, no_show_reason, rating_tags, free_text, share_with_person, state, submitted_at, locked_at, created_at')
			.eq('id', formId)
			.eq('reviewer_id', userId)
			.maybeSingle();

		if (error) throw new Error(`Failed to load feedback form: ${error.message}`);
		return data as FeedbackForm | null;
	}

	async submit(formId: string, data: FeedbackInput): Promise<FeedbackFormState> {
		const { data: result, error } = await this.supabase.rpc('submit_feedback', {
			p_form_id: formId,
			p_did_meet: data.did_meet,
			p_no_show_reason: data.no_show_reason ?? null,
			p_rating_tags: data.rating_tags ?? [],
			p_free_text: data.free_text ?? null,
			p_share_with_person: data.share_with_person ?? null,
			p_share_with_platform: data.share_with_platform ?? null,
			p_platform_comments: data.platform_comments ?? null
		});

		if (error) throw new Error(`Failed to submit feedback: ${error.message}`);
		return result as FeedbackFormState;
	}

	async getRevealedFeedback(meetingId: string, userId: string): Promise<RevealedFeedback[]> {
		// RLS: reviewee can only see locked feedback forms
		// We filter to forms where the current user is the reviewee (i.e., feedback about them)
		const { data, error } = await this.supabase
			.from('feedback_forms')
			.select('reviewer_id, did_meet, rating_tags, share_with_person, locked_at')
			.eq('meeting_id', meetingId)
			.eq('reviewee_id', userId)
			.eq('state', 'locked');

		if (error) throw new Error(`Failed to load revealed feedback: ${error.message}`);
		return (data ?? []) as RevealedFeedback[];
	}

	async getVocabulary(): Promise<string[]> {
		const { data, error } = await this.supabase
			.from('adjective_vocabulary')
			.select('word')
			.eq('active', true)
			.order('word');

		if (error) throw new Error(`Failed to load vocabulary: ${error.message}`);
		return (data ?? []).map((d) => d.word);
	}

	// ── Group feedback (R5 / U11) ──────────────────────────────────────────

	async getGroupFormById(formId: string, userId: string): Promise<GroupFeedback | null> {
		const { data, error } = await this.supabase
			.from('group_feedback')
			.select('id, prompt_id, slot_id, reviewer_id, meet_again, comment, personal_feedback, state, submitted_at, created_at')
			.eq('id', formId)
			.eq('reviewer_id', userId)
			.maybeSingle();

		if (error) throw new Error(`Failed to load group feedback form: ${error.message}`);
		return data as GroupFeedback | null;
	}

	async submitGroupFeedback(formId: string, data: GroupFeedbackInput): Promise<GroupFeedbackState> {
		const { data: result, error } = await this.supabase.rpc('submit_group_feedback', {
			p_form_id: formId,
			p_meet_again: data.meet_again,
			p_comment: data.comment ?? null,
			p_personal_feedback: data.personal_feedback ?? null
		});

		if (error) throw new Error(`Failed to submit group feedback: ${error.message}`);
		return result as GroupFeedbackState;
	}

	// ── Unified gathering feedback write path (U5) ──────────────────────────

	async submitAttendance(data: AttendanceInput): Promise<void> {
		const { error } = await this.supabase.rpc('submit_attendance', {
			p_gathering: data.gathering_id,
			p_self_report: data.self_report,
			p_absence_reason: data.absence_reason ?? null,
			p_turnout: data.turnout ?? null
		});

		if (error) throw new Error(`Failed to submit attendance: ${error.message}`);
	}

	async submitPublicFeedback(data: PublicFeedbackInput): Promise<void> {
		const { error } = await this.supabase.rpc('submit_public_feedback', {
			p_gathering: data.gathering_id,
			p_reviewee: data.reviewee_id,
			p_tags: data.tags ?? [],
			p_free_text: data.free_text ?? null
		});

		if (error) throw new Error(`Failed to submit public feedback: ${error.message}`);
	}

	async promotePublicFeedback(feedbackId: string): Promise<boolean> {
		const { data: result, error } = await this.supabase.rpc('promote_public_feedback', {
			p_feedback_id: feedbackId
		});

		if (error) throw new Error(`Failed to promote public feedback: ${error.message}`);
		return result === true;
	}

	async submitConcern(data: SafetyConcernInput): Promise<void> {
		const { error } = await this.supabase.rpc('submit_concern', {
			p_slot: data.slot_id,
			p_scope: data.scope,
			p_kind: data.kind,
			p_subject: data.subject_id ?? null,
			p_gathering: data.gathering_id ?? null,
			p_detail: data.detail ?? null
		});

		if (error) throw new Error(`Failed to submit concern: ${error.message}`);
	}

	async getGatheringRoster(gatheringId: string): Promise<RosterMember[]> {
		const { data, error } = await this.supabase.rpc('get_gathering_roster', {
			p_gathering: gatheringId
		});

		if (error) throw new Error(`Failed to load gathering roster: ${error.message}`);
		return (data ?? []) as RosterMember[];
	}

	async submitMeetAgain(gatheringId: string, meetAgain: boolean): Promise<void> {
		const { error } = await this.supabase.rpc('submit_meet_again', {
			p_gathering: gatheringId,
			p_meet_again: meetAgain
		});

		if (error) throw new Error(`Failed to submit meet-again: ${error.message}`);
	}

	// ── Feature feedback on profile ──────────────────────────────────────

	async getReputationSignalForMeeting(meetingId: string, userId: string): Promise<ReputationSignal | null> {
		const { data, error } = await this.supabase
			.from('reputation_signals')
			.select('id, profile_id, signal_type, source_meeting_id, visible, content, created_at')
			.eq('source_meeting_id', meetingId)
			.eq('profile_id', userId)
			.eq('signal_type', 'feedback_received')
			.maybeSingle();

		if (error) throw new Error(`Failed to load reputation signal: ${error.message}`);
		return data as ReputationSignal | null;
	}

	async getMyReputationSignals(profileId: string): Promise<ReputationSignal[]> {
		const { data, error } = await this.supabase
			.from('reputation_signals')
			.select('id, profile_id, signal_type, source_meeting_id, visible, content, created_at')
			.eq('profile_id', profileId)
			.eq('signal_type', 'feedback_received')
			.order('created_at', { ascending: false });

		if (error) throw new Error(`Failed to load your feedback: ${error.message}`);
		return (data ?? []) as ReputationSignal[];
	}

	async getVisibleReputationSignals(profileId: string): Promise<ReputationSignal[]> {
		const { data, error } = await this.supabase
			.from('reputation_signals')
			.select('id, profile_id, signal_type, source_meeting_id, visible, content, created_at')
			.eq('profile_id', profileId)
			.eq('signal_type', 'feedback_received')
			.eq('visible', true)
			.order('created_at', { ascending: false });

		if (error) throw new Error(`Failed to load featured feedback: ${error.message}`);
		return (data ?? []) as ReputationSignal[];
	}

	async setReputationSignalVisibility(signalId: string, visible: boolean): Promise<boolean> {
		const { data, error } = await this.supabase.rpc('set_reputation_signal_visibility', {
			p_signal_id: signalId,
			p_visible: visible
		});

		if (error) throw new Error(`Failed to update visibility: ${error.message}`);
		return data === true;
	}
}
