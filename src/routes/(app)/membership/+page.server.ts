import { dev } from '$app/environment';
import { requireIdentity } from '$lib/services/identity.js';
import { toMembershipDisplay, type MembershipRow } from '$lib/domain/membership.js';
import type { PageServerLoad } from './$types';

// Dev-only preview fixtures. Raw rows, run through the SAME toMembershipDisplay
// mapper as production, so /dev/membership shows exactly what each real state
// renders as — including that a never-activated "pending" checkout reads as a
// non-member (not "lapsed"), and a revoked grant reads as "access ended".
// `dev` is false in a production build, so this branch is inert in prod.
const PREVIEW_ROWS: Record<string, MembershipRow | null> = {
	guest: null,
	pending: { active: false, cadence: null, source: 'paid' }, // abandoned checkout -> non-member
	lapsed: { active: false, cadence: 'annual', source: 'paid', current_period_end: null },
	active: { active: true, cadence: 'annual', source: 'paid', current_period_end: null },
	lifetime: { active: true, cadence: 'lifetime', source: 'paid', current_period_end: null },
	comp: { active: true, cadence: null, source: 'comp', current_period_end: null },
	ended_comp: { active: false, cadence: null, source: 'comp' } // revoked grant -> "access ended"
};

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	// Lets the checkout-return poll re-run just this loader (not the whole
	// (app) layout) via invalidate('membership:status').
	depends('membership:status');

	if (dev) {
		const preview = url.searchParams.get('preview');
		if (preview && preview in PREVIEW_ROWS) {
			return { membership: toMembershipDisplay(PREVIEW_ROWS[preview]) };
		}
	}

	const actor = requireIdentity(locals);

	// SELECT-own via RLS, and only the safe display columns — the opaque
	// payment_ref / stripe_* references are never serialized to the client.
	const { data } = await locals.supabase
		.from('memberships')
		.select('active, cadence, source, current_period_end')
		.eq('identity_id', actor.id)
		.maybeSingle();

	return {
		membership: toMembershipDisplay(data as MembershipRow | null)
	};
};
