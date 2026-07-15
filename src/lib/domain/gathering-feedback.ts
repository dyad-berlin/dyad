// Pure co-presence / attendance logic for the post-gathering feedback form (U6).
//
// Extracted so the branch rules — "attendance is mandatory", "if you didn't turn
// up, per-person feedback is suppressed" — are unit-testable without a Svelte/DB
// harness. The UI (src/routes/(app)/feedback/gathering/[id]/+page.svelte) reads
// these; the DB re-enforces the real gate (app.both_present) in the RPC.

import type { SelfReport } from './types.js';

// The caller's turnout is DERIVED from their self-report: only 'attended' counts
// as having turned up. 'cancelled_before' and 'absent' do not.
export function turnedUp(selfReport: SelfReport | null): boolean {
	return selfReport === 'attended';
}

// Per-person feedback (public positive notes + per-person concern) is a
// CO-PRESENCE affordance: shown only when the caller turned up. A caller who
// didn't turn up sees no per-person affordances (the DB turnout gate would
// reject the writes anyway).
export function showsPerPersonFeedback(selfReport: SelfReport | null): boolean {
	return turnedUp(selfReport);
}

// The gathering-level "meet again" pulse only makes sense if the caller was
// there.
export function showsMeetAgain(selfReport: SelfReport | null): boolean {
	return turnedUp(selfReport);
}

// Attendance is the mandatory gate: the form cannot be submitted until the
// caller has answered it.
export function attendanceAnswered(selfReport: SelfReport | null): boolean {
	return selfReport !== null;
}
