import { makeAdminClient } from '$lib/server/supabase-admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Admin plane: service-role client, no user/session context.
	const supabase = makeAdminClient();

	// Parallel queries — no FK between contacts and invitations (merge by email).
	// join_requests is the provider-identity waitlist (substrate-verified).
	const [{ data: contacts }, { data: invitations }, { data: joinRequests }] = await Promise.all([
		supabase
			.from('contacts')
			.select('id, email, name, based_in, freewrite, referral_source, referred_by_username, created_at')
			.order('created_at', { ascending: false }),
		supabase
			.from('invitations')
			.select('email, token, used_at, expires_at, created_at'),
		supabase
			.from('join_requests')
			.select('id, substrate, substrate_id, handle, scope, requested_at, decided_at, approved')
			.order('requested_at', { ascending: false })
	]);

	// Build invitation lookup by email
	const inviteMap = new Map<string, { used: boolean; expired: boolean; token: string; created_at: string }>();
	for (const inv of invitations ?? []) {
		const existing = inviteMap.get(inv.email);
		// Keep the most recent invitation per email
		if (!existing || inv.created_at > existing.created_at) {
			inviteMap.set(inv.email, {
				used: inv.used_at !== null,
				expired: !inv.used_at && new Date(inv.expires_at) < new Date(),
				token: inv.token,
				created_at: inv.created_at
			});
		}
	}

	// Merge contacts with invitation status
	const waitlist = (contacts ?? []).map(c => {
		const inv = inviteMap.get(c.email);
		let status: 'not_invited' | 'invited' | 'expired' | 'signed_up' = 'not_invited';
		if (inv?.used) status = 'signed_up';
		else if (inv && !inv.expired) status = 'invited';
		else if (inv?.expired) status = 'expired';

		return { ...c, status };
	});

	// Member-referred contacts are fast-track (review within 2 days) — float
	// the ones still awaiting action to the top, newest first within each band.
	waitlist.sort((a, b) => {
		const aFast = a.referred_by_username && a.status !== 'signed_up' ? 0 : 1;
		const bFast = b.referred_by_username && b.status !== 'signed_up' ? 0 : 1;
		if (aFast !== bFast) return aFast - bFast;
		return a.created_at < b.created_at ? 1 : -1;
	});

	return { waitlist, joinRequests: joinRequests ?? [] };
};
