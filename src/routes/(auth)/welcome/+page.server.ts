import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { makeAdminClient } from '$lib/server/supabase-admin.js';

/**
 * Account creation for an admitted provider identity (atproto today, any
 * substrate tomorrow). The provider session authenticates and the scope grant
 * admits; joining means choosing a username, which creates the profiles row
 * keyed to identities.id — from then on the provider identity IS a full
 * account, indistinguishable downstream from one created via email signup.
 * The hooks gate sends profile-less provider identities here.
 */

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{2,29}$/;

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	// A Supabase-auth member already created their account at signup.
	if (locals.scopeSessions.length === 0) redirect(302, '/discover');
	const { data: profile } = await locals.supabase
		.from('profiles')
		.select('id')
		.eq('id', locals.user.id)
		.maybeSingle();
	if (profile) redirect(302, '/discover');
	return {};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		if (!locals.user || locals.scopeSessions.length === 0) {
			return fail(403, { username: '', error: 'Sign in first' });
		}

		const data = await request.formData();
		const username = String(data.get('username') ?? '')
			.trim()
			.toLowerCase();
		if (!USERNAME_RE.test(username)) {
			return fail(400, {
				username,
				error: 'Names are 3 to 30 characters: lowercase letters, numbers, hyphens'
			});
		}

		// Privileged insert, target-constrained to the caller's own identity id;
		// the primary key makes a second account for the same identity impossible.
		const { error: dbError } = await makeAdminClient()
			.from('profiles')
			.insert({ id: locals.user.id, username });
		if (dbError) {
			if (dbError.code === '23505') {
				// A unique violation is either this identity resubmitting (it
				// already has a profile: a double submit) or the username being
				// taken by someone else. Distinguish so a resubmit lands in the
				// app instead of being told, wrongly, that its own name is taken.
				const { data: mine } = await makeAdminClient()
					.from('profiles')
					.select('id')
					.eq('id', locals.user.id)
					.maybeSingle();
				if (mine) redirect(302, '/discover');
				return fail(400, { username, error: 'That name is taken' });
			}
			console.error('[welcome] profile creation failed:', dbError.message);
			return fail(500, { username, error: 'Could not create your account. Try again.' });
		}

		redirect(302, '/discover');
	}
};
