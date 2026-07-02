/**
 * Per-action membership gating.
 *
 * The single source of truth for which actions can be gated behind an active
 * membership. The endpoint checks, the RLS `app.gating_allows` function input,
 * the accept-invitation RPC guard, and the admin toggles all key off these
 * exact strings — so they can never drift on a literal.
 *
 * Reads / browsing are NEVER in this catalog (plan R8): only state-changing
 * interactions. The same JSONB config expresses all three cofounder positions —
 * "everything gated" (all true), "browse-free / interact-paid" (subset true),
 * "gating off" (all false / absent) — as configuration, not a code fork (R9).
 *
 * The two meeting-flow actions (responding / taking a slot, and inviting to
 * meet) are split by the TARGET conversation's size so a one-on-one and a group
 * can be gated INDEPENDENTLY. Size comes from `prompts.capacity`: 1 = one-on-one;
 * NULL or 2–7 = group. `create_conversation` is size-agnostic (the author does
 * not choose capacity until first publish). The size-scoped action string is
 * what a caller passes to the gate; `app.gating_allows` itself is unchanged and
 * size-blind — it just reads the flag for whatever action string it is given.
 */
export const PROTECTED_ACTIONS = [
	'create_conversation',
	'respond_take_slot_1on1',
	'respond_take_slot_group',
	'invite_to_meet_1on1',
	'invite_to_meet_group'
] as const;

export type ProtectedAction = (typeof PROTECTED_ACTIONS)[number];

/** The two size-split base actions. A caller resolves the target conversation's
 *  capacity and calls `gatingActionForCapacity` to get the concrete action. */
export type GatedMeetingBase = 'respond_take_slot' | 'invite_to_meet';

/**
 * Map a size-split base action + the target conversation's capacity to the
 * concrete gated action string. `capacity === 1` ⇒ one-on-one; anything else
 * (NULL / ≥2) ⇒ group — matching `prompts.capacity` semantics (NULL = legacy
 * unlimited, treated as a group). The SQL twin is `app.gating_action_for_capacity`.
 */
export function gatingActionForCapacity(
	base: GatedMeetingBase,
	capacity: number | null
): ProtectedAction {
	return `${base}_${capacity === 1 ? '1on1' : 'group'}` as ProtectedAction;
}

/** The operator-edited config: action -> "requires an active membership". An
 *  absent or false flag means the action is open to all registered guests. */
export type MembershipGating = Partial<Record<ProtectedAction, boolean>>;

export function isProtectedAction(value: unknown): value is ProtectedAction {
	return typeof value === 'string' && (PROTECTED_ACTIONS as readonly string[]).includes(value);
}

/**
 * Operator-facing labels for the admin toggles. Each `respond_take_slot_*`
 * action deliberately spans BOTH writing a response AND accepting an invitation
 * (taking a slot) on a conversation of that size — the latter runs through the
 * `accept_invitation` SECURITY DEFINER RPC, which is gated inside its body (RLS
 * cannot reach a DEFINER write). Documented here so the two enforcement points
 * never diverge on what the action covers.
 *
 * `group` is used as the label for a `base` prefix that scopes to a size; the
 * admin page groups the five rows by base action + size for scanning.
 */
export const PROTECTED_ACTION_META: Record<ProtectedAction, { label: string; hint: string }> = {
	create_conversation: {
		label: 'Create a conversation',
		hint: 'Whether starting a new conversation requires an active membership. Applies to conversations of any size.'
	},
	respond_take_slot_1on1: {
		label: 'Respond and take a time — one-on-one',
		hint: 'Covers writing a response and accepting an invitation (taking a time) on a one-on-one conversation. Reading stays open.'
	},
	respond_take_slot_group: {
		label: 'Respond and take a time — group',
		hint: 'Covers writing a response and accepting an invitation (taking a time) on a group conversation. Reading stays open.'
	},
	invite_to_meet_1on1: {
		label: 'Invite to meet — one-on-one',
		hint: 'Whether inviting someone to meet on a one-on-one conversation requires an active membership.'
	},
	invite_to_meet_group: {
		label: 'Invite to meet — group',
		hint: 'Whether inviting someone to meet on a group conversation requires an active membership.'
	}
};
