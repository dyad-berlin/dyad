import type { JSONContent } from '@tiptap/core';

// Default email-notification preference when a member has no explicit value.
// Mirrors the per-event `profiles.email_*` column defaults (TRUE; see
// migration 20260604090000) and is the single source for the
// nullish-coalescing fallback at every read site that may encounter a
// missing/null row.
export const EMAIL_NOTIFICATIONS_DEFAULT = true;

// Prompt states
export type PromptState = 'draft' | 'published';

// Per-conversation capacity bounds (max joiners per slot; mirrors the DB CHECK
// in 20260529100000_add_capacity_to_prompts.sql). 1 = one-on-one; up to 7
// others = 8 people total including the author. null stays legacy unlimited.
export const MIN_CAPACITY = 1;
export const MAX_CAPACITY = 7;

// Location reference stored in time_slots.exact_location JSONB
export interface LocationRef {
	place_id: string;
	name: string;
	address: string;
	lat: number;
	lng: number;
}

// Core entities

export interface Prompt {
	id: string;
	author_id: string;
	title: string | null;
	body: JSONContent | null;
	cover_image_url: string | null;
	state: PromptState;
	region: string;
	published_at: string | null;
	hidden_at: string | null;
	audience_scope: string | null;
	// Max joiners per slot. null = legacy unlimited; 1 = one-on-one; 2-7 = group
	// (up to 8 total incl. author). Set at first publish, immutable thereafter.
	capacity: number | null;
	created_at: string;
	updated_at: string;
}

export interface TimeSlot {
	id: string;
	prompt_id: string;
	start_time: string;
	duration_minutes: number;
	general_area: string;
	general_area_lat: number | null;
	general_area_lng: number | null;
	accepted: boolean;
	/** Set when the author withdrew this time (whole-gathering cancel) —
	 *  terminal; retired slots are never offered or invitable. */
	retired_at?: string | null;
	created_at: string;
	// exact_location is omitted from non-author surfaces (public view masks it).
	// Present (or null) only when the loader fetched via get_my_prompt_slots
	// (author path); the RPC returns full time_slots rows where the column
	// can be null.
	exact_location?: LocationRef | null;
}

export interface TimeSlotWithLocation extends TimeSlot {
	exact_location: LocationRef;
}

export interface TimeSlotInput {
	start_time: string; // ISO 8601
	duration_minutes: number;
	location: LocationRef;
}

// Slot submitted from the publish sheet back to the editor for diff
// computation. dbId is set when the draft was hydrated from an existing
// time_slots row; absent when the draft is freshly added in the sheet.
export type SubmitSlot = TimeSlotInput & { dbId?: string };

// Discover feed types

export interface PromptSummary {
	id: string;
	author_id: string;
	author_username: string;
	author_display_name: string | null;
	title: string | null;
	body_snippet: string;
	cover_image_url: string | null;
	available_slots: TimeSlot[];
	soonest_slot: string | null; // ISO 8601 of earliest available slot
	published_at: string;
	region: string;
	audience_scope: string | null;
	audience_scope_name: string | null;
	// Max joiners per slot (mirrors Prompt.capacity). null = legacy unlimited
	// or a surface that does not derive capacity (anon landing teaser sets
	// null); 1 = one-on-one; 2-7 = small group (up to 8 total incl. author).
	// Required so every construction site is forced to make the choice explicit.
	capacity: number | null;
}

export interface PromptDetail extends PromptSummary {
	state: PromptState;
	body: JSONContent;
	body_html: string; // server-rendered TipTap HTML (sanitized)
}

// Engagement types

export type InvitationState = 'pending' | 'accepted' | 'cancelled' | 'expired';

export interface Comment {
	id: string;
	prompt_id: string;
	author_id: string;
	author_username?: string;
	body: string;
	created_at: string;
	updated_at: string;
	// "edited" derived in UI: updated_at > created_at
}

export interface MeetingInvitation {
	id: string;
	prompt_id: string;
	slot_id: string;
	inviter_id: string;
	invitee_id: string;
	comment_id: string | null;
	message: string | null;
	state: InvitationState;
	created_at: string;
	resolved_at: string | null;
}

// Meeting types

export type MeetingState =
	| 'scheduled'
	| 'cancelled_early'
	| 'cancelled_late'
	| 'awaiting_feedback'
	| 'completed';

export type CancellationTier = 'early' | 'late';

export interface Meeting {
	id: string;
	invitation_id: string;
	prompt_id: string;
	participant_a: string;
	participant_b: string;
	scheduled_time: string;
	duration_minutes: number;
	state: MeetingState;
	created_at: string;
	resolved_at: string | null;
}

export interface MeetingWithLocation extends Meeting {
	exact_location: LocationRef;
	general_area: string;
}

export interface MeetingDetail extends Meeting {
	general_area: string;
	cancellation_tier: CancellationTier | null;
	cancellation_reason: string | null;
	cancelled_by: string | null;
}

export interface CancellationRecord {
	id: string;
	meeting_id: string;
	cancelled_by: string;
	cancelled_at: string;
	tier: CancellationTier;
	reason: string | null;
	free_pass_used: boolean;
}

// Feedback types

export type FeedbackFormState = 'not_due' | 'due' | 'submitted' | 'locked' | 'released';

export interface FeedbackForm {
	id: string;
	meeting_id: string;
	reviewer_id: string;
	reviewee_id: string;
	did_meet: boolean | null;
	no_show_reason: string | null;
	rating_tags: string[];
	free_text: string | null;
	share_with_person: string | null;
	// share_with_platform and platform_comments hidden by column-level REVOKE
	state: FeedbackFormState;
	submitted_at: string | null;
	locked_at: string | null;
	created_at: string;
}

export interface RevealedFeedback {
	reviewer_id: string;
	did_meet: boolean;
	rating_tags: string[];
	share_with_person: string | null;
	locked_at: string;
}

// Group feedback (R5 / U11): one group-level form per participant per group
// gathering (a slot with >= 2 active meetings). Distinct from the per-pair
// FeedbackForm used by one-on-one meetings.

export type GroupFeedbackState = 'due' | 'submitted';

export interface GroupFeedback {
	id: string;
	prompt_id: string;
	slot_id: string;
	reviewer_id: string;
	meet_again: boolean | null;
	comment: string | null;
	personal_feedback: string | null;
	state: GroupFeedbackState;
	submitted_at: string | null;
	created_at: string;
}

// Unified gathering model (feat: unified gathering feedback, U1). A gathering is
// the anchor for one time_slot that took place; a 1-on-1 is the n=2 case.
// Occurrence is DERIVED from participation (>= 2 turned_up), never stored.

export interface Gathering {
	id: string;
	slot_id: string;
	prompt_id: string;
	host_id: string;
	closed_at: string | null;
	created_at: string;
}

// A participant's own account of what happened at a gathering.
export type SelfReport = 'attended' | 'cancelled_before' | 'absent';

export interface Participation {
	id: string;
	gathering_id: string;
	member_id: string;
	is_host: boolean;
	turned_up: boolean;
	self_report: SelfReport | null;
	absence_reason: string | null;
	attested_by: string | null;
	created_at: string;
}

// Confidential safeguarding concern (feat: unified gathering feedback, U2).
// Structurally isolated: insert-only for participants, steward-only read via the
// service-role admin plane. Never surfaced to the reported person or any
// participant. See supabase/migrations/20260715120100_create_safety_concerns.sql.
export type SafetyConcernScope = 'person' | 'gathering';
export type SafetyConcernKind = 'no_show' | 'felt_unsafe' | 'other';

export interface SafetyConcern {
	id: string;
	// Schedule-time anchor (turnout-blind gate keys off this slot).
	slot_id: string;
	// Optional finer context; null when filed before/without a gathering row.
	gathering_id: string | null;
	reporter_id: string;
	// Null for a gathering-scoped concern (names no person).
	subject_id: string | null;
	scope: SafetyConcernScope;
	kind: SafetyConcernKind;
	detail: string | null;
	created_at: string;
}

// Public feedback edge (feat: unified gathering feedback, U3). Any-to-any
// experiential feedback about a co-present participant — tags (from
// adjective_vocabulary) + free text, NO numeric rating. Least-privilege
// visibility (R11): visible to reviewer + subject on submit; the subject alone
// promotes it by setting made_public_at, after which co-participants of the
// gathering may read it. See supabase/migrations/20260715120200_create_public_feedback.sql.
export interface PublicFeedback {
	id: string;
	gathering_id: string;
	reviewer_id: string;
	reviewee_id: string;
	tags: string[];
	free_text: string | null;
	// NULL = subject-visible only; set (by the subject) to promote to a broader,
	// still-minimal co-participant audience.
	made_public_at: string | null;
	created_at: string;
}

// Collect-only "would you meet again" soft signal (R7). One row per reviewer per
// gathering; owner-read only, wired to nothing user-visible or match-affecting.
export interface GatheringFeedback {
	id: string;
	gathering_id: string;
	reviewer_id: string;
	meet_again: boolean | null;
	created_at: string;
}

// ── Gathering write-path inputs (feat: unified gathering feedback, U5) ──────
// Inputs to the SECURITY DEFINER RPCs (submit_attendance, submit_public_feedback,
// submit_concern) consumed by FeedbackService. See
// supabase/migrations/20260715120300_feedback_write_rpcs.sql.

// The caller's own attendance, plus (host only) a turnout attestation map of
// member_id -> turned_up for co-participants.
export interface AttendanceInput {
	gathering_id: string;
	self_report: SelfReport;
	absence_reason?: string;
	// Host-only: attest other participants' turnout. Keyed by member id.
	turnout?: Record<string, boolean>;
}

// A public (subject-visible) feedback edge about a co-present participant.
export interface PublicFeedbackInput {
	gathering_id: string;
	reviewee_id: string;
	tags?: string[];
	free_text?: string;
}

// A confidential safeguarding concern about a co-participant or the meeting.
export interface SafetyConcernInput {
	slot_id: string;
	scope: SafetyConcernScope;
	kind: SafetyConcernKind;
	// Required when scope='person'; must be absent when scope='gathering'.
	subject_id?: string | null;
	gathering_id?: string | null;
	detail?: string | null;
}

// Discriminated union so invalid states (both form IDs set) are unrepresentable.
// `kind` distinguishes the one-on-one feedback_forms gate (reveal-capable modal),
// the legacy group_feedback gate (standalone redirect page), and the unified
// `gathering` obligation (U9 — an unconfirmed participation.self_report on a
// group gathering; formId is the gathering id, routed to /feedback/gathering/[id]).
// Mutually exclusive by construction.
export type GateStatus =
	| { gated: false }
	| { gated: true; kind: 'one_on_one'; formId: string }
	| { gated: true; kind: 'group'; formId: string }
	| { gated: true; kind: 'gathering'; formId: string };

export interface ReputationSignal {
	id: string;
	profile_id: string;
	signal_type: 'feedback_received' | 'cancellation' | 'no_show';
	source_meeting_id: string;
	visible: boolean;
	content: Record<string, unknown>;
	created_at: string;
}

// Membership / entitlement

// Billing cadence. Monthly/annual auto-recur; lifetime is a one-time purchase
// yielding a perpetual entitlement. NULL on operator-granted rows.
export const MEMBERSHIP_CADENCES = ['monthly', 'annual', 'lifetime'] as const;
export type MembershipCadence = (typeof MEMBERSHIP_CADENCES)[number];

// Monthly is a solidarity scale: three fixed tiers (solidarity €7 / standard €12
// / supporter €17), each its own fixed-price Stripe Price so subscriber counts
// per tier are trackable. Annual/lifetime have a single Price each.
export const MEMBERSHIP_MONTHLY_TIERS = ['solidarity', 'standard', 'supporter'] as const;
export type MembershipMonthlyTier = (typeof MEMBERSHIP_MONTHLY_TIERS)[number];

// How the entitlement was obtained. `paid` flows through Stripe; the others are
// operator grants with no Stripe record but an equivalent active entitlement.
export const MEMBERSHIP_SOURCES = ['paid', 'comp', 'founding', 'grandfathered'] as const;
export type MembershipSource = (typeof MEMBERSHIP_SOURCES)[number];

// One row per actor (keyed identity_id). Opaque-only: no payment PII ever. The
// opaque Stripe references and payment_ref are server-side only and must not be
// surfaced to the client UI — map to user-facing fields at the boundary.
export interface Membership {
	identity_id: string;
	cadence: MembershipCadence | null;
	source: MembershipSource;
	status: string | null;
	current_period_end: string | null;
	active: boolean;
	// Opaque references — never rendered. payment_ref is the only dyad value
	// Stripe sees; stripe_* are Stripe's own ids.
	payment_ref: string | null;
	stripe_customer_id: string | null;
	stripe_subscription_id: string | null;
}
