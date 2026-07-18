import { fail, redirect } from '@sveltejs/kit';
import { makeAdminClient } from '$lib/server/supabase-admin.js';
import type { Actions, PageServerLoad } from './$types';

// Self-serve membership: no admin review, no invitation token. A person
// becomes a member by reading and consenting to the Community Standards
// and Member Agreements, choosing a contribution (or none — membership
// does not require paying), and creating an account. This mirrors the
// unscoped branch of (auth)/join's `signup` action (an invite with no
// `scope` grants nothing beyond the bare account — Berlin is implicit),
// minus the invitation-token requirement.
//
// Payment is intentionally out of scope here: a chosen paid tier is
// remembered only long enough to route the new member to /membership,
// where the existing MembershipOffer component owns the real Stripe
// checkout. This route never touches Stripe.
export const load: PageServerLoad = async ({ locals }) => {
	const { session } = await locals.safeGetSession();
	if (session) redirect(302, '/discover');
	return {};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const formData = await request.formData();
		const username = formData.get('username');
		const email = formData.get('email');
		const password = formData.get('password');
		const tier = formData.get('tier');
		const agreedStandards = formData.get('agreedStandards');
		const agreedAgreements = formData.get('agreedAgreements');

		if (agreedStandards !== 'on' || agreedAgreements !== 'on') {
			return fail(400, {
				username: username?.toString(),
				tier: tier?.toString(),
				error: 'Please confirm both commitments before continuing.'
			});
		}

		if (typeof username !== 'string' || username.length < 3) {
			return fail(400, { username: username?.toString(), tier: tier?.toString(), error: 'Username must be at least 3 characters' });
		}
		if (!/^[a-z0-9_-]+$/.test(username)) {
			return fail(400, {
				username,
				tier: tier?.toString(),
				error: 'Username can only contain lowercase letters, numbers, underscores, and hyphens'
			});
		}
		if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return fail(400, { username, tier: tier?.toString(), error: 'A valid email is required' });
		}
		if (typeof password !== 'string' || password.length < 8) {
			return fail(400, { username, tier: tier?.toString(), error: 'Password must be at least 8 characters' });
		}
		if (password.length > 128) {
			return fail(400, { username, tier: tier?.toString(), error: 'Password must be at most 128 characters' });
		}

		const admin = makeAdminClient();

		const { data: existingProfile } = await admin
			.from('profiles')
			.select('username')
			.eq('username', username)
			.maybeSingle();
		if (existingProfile) {
			return fail(400, { username, tier: tier?.toString(), error: 'Username is already taken' });
		}

		const { data: createUserData, error: signUpError } = await admin.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
			// Berlin is implicit for commons signups, same as the plain (unscoped)
			// invite path — see (auth)/join/+page.server.ts.
			user_metadata: { username, berlin_based: true }
		});

		if (signUpError || !createUserData?.user?.id) {
			console.error('[become-a-member] admin.createUser failed:', signUpError);
			const msg = signUpError?.message?.toLowerCase() ?? '';
			const friendly = msg.includes('already') || msg.includes('exists')
				? 'An account with this email already exists.'
				: 'Could not create your account. Please try again.';
			return fail(400, { username, tier: tier?.toString(), error: friendly });
		}

		const { error: signInError } = await locals.supabase.auth.signInWithPassword({ email, password });
		if (signInError) {
			return { success: true, message: 'Account created! Check your email to confirm, then sign in.' };
		}

		// A paid tier is only a preference at this point — route to /membership,
		// which owns the actual checkout, rather than charging anything here.
		if (typeof tier === 'string' && tier && tier !== 'none') {
			redirect(302, `/membership?welcome=1&tier=${encodeURIComponent(tier)}`);
		}
		redirect(302, '/discover?welcome=1');
	}
};
