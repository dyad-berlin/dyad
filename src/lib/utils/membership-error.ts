import { copy } from '$lib/copy.js';

/** The paywall modal's mode: which offer to show. Backend returns this as
 *  `reason` on a gated 403; the frontend also derives it from `had_membership`
 *  as a fallback. Shared so the pages and the modal components never diverge. */
export type GateReason = 'join' | 'renew' | 'ended';

/** Shape of the 403 a gated action returns. */
interface GateError {
	error?: string;
	reason?: GateReason;
	had_membership?: boolean;
}

/**
 * Map a gated 403 body to the paywall modal's mode. The backend returns
 * `reason ∈ 'join'|'renew'|'ended'`; if absent, fall back to `had_membership`
 * (had one → renew, never had one → join). Shared by the conversation read
 * page and the editor page so the two chains never diverge.
 */
export function gateModeFrom(err: GateError | null | undefined): GateReason {
	const reason = err?.reason;
	if (reason === 'join' || reason === 'renew' || reason === 'ended') return reason;
	return err?.had_membership === true ? 'renew' : 'join';
}

/**
 * Map a failed gated-action response to member-facing copy. The `membership_required`
 * token (with `had_membership` choosing renew vs join) becomes a friendly prompt;
 * any other error falls back to its own message or the caller's default. Keeps the
 * raw API token from ever reaching the member (CLAUDE.md domain-language boundary).
 */
export function membershipErrorMessage(body: GateError, fallback: string): string {
	if (body?.error === 'membership_required') {
		return copy.membership.gatePrompt(body.had_membership === true);
	}
	return body?.error ?? fallback;
}

/** Whether a failed response is the membership gate (so the UI can show a
 *  /membership link alongside the message). */
export function isMembershipGate(body: GateError): boolean {
	return body?.error === 'membership_required';
}
