/**
 * Membership display mapping — the single place a raw `memberships` row becomes
 * what the UI is allowed to see. Used by every (app) surface that reflects
 * membership state (the layout loader, the /membership page, preferences).
 *
 * Never selects or returns `payment_ref` / `stripe_*` — those stay server-side.
 */

export interface MembershipRow {
	active: boolean;
	cadence: string | null;
	source: string;
	current_period_end?: string | null;
}

export interface MembershipDisplay {
	active: boolean;
	cadence: string | null;
	source: string;
	currentPeriodEnd?: string | null;
}

/**
 * Normalise a raw row into the display shape, or `null` for "not a member".
 *
 * A paid row that was never activated is an abandoned checkout, NOT a lapse:
 * `ensurePaymentRef` inserts `{ source:'paid', active:false }` with a null
 * cadence *before* the Stripe redirect, and the webhook only writes a cadence on
 * activation. So `active:false && cadence===null && source==='paid'` is a signup
 * that never completed — we treat it as a non-member so the lapsed surfaces
 * ("renew to…") never fire for someone who never joined. Genuinely lapsed
 * subscriptions keep their cadence; revoked grants keep a non-'paid' source.
 */
export function toMembershipDisplay(
	row: MembershipRow | null | undefined
): MembershipDisplay | null {
	if (!row) return null;
	if (row.active === false && row.cadence === null && row.source === 'paid') return null;
	const display: MembershipDisplay = {
		active: row.active,
		cadence: row.cadence,
		source: row.source
	};
	if (row.current_period_end !== undefined) display.currentPeriodEnd = row.current_period_end ?? null;
	return display;
}
