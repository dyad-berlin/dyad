import { fail, redirect } from '@sveltejs/kit';
import type { Session } from '@prefig/upact';
import { safeLocalPath } from '$lib/utils/safe-redirect';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { session } = await locals.safeGetSession();
	const mode = url.searchParams.get('mode');
	const redirectTo = safeLocalPath(url.searchParams.get('redirectTo'));

	// Allow update password mode even if logged in (for recovery flow)
	if (session && mode !== 'update') {
		redirect(302, redirectTo ?? '/discover');
	}

	return { mode, redirectTo };
};

export const actions: Actions = {
	login: async ({ request, locals, url }) => {
		const data = await request.formData();
		const email = data.get('email');
		const password = data.get('password');

		if (typeof email !== 'string' || email.length < 1) {
			return fail(400, { email: email?.toString(), error: 'Please enter your email' });
		}

		if (typeof password !== 'string' || password.length < 1) {
			return fail(400, { email: email.toString(), error: 'Please enter your password' });
		}

		try {
			const result = await locals.identityPort.authenticate({ kind: 'password', email, password });
			if ('code' in result) {
				const message = result.code === 'rate_limited'
					? 'Too many attempts — please try again later'
					: 'Invalid email or password';
				return fail(400, { email: email.toString(), error: message });
			}
		} catch {
			return fail(503, { email: email.toString(), error: 'Service temporarily unavailable — please try again' });
		}

		// The form posts to `?/login`, a query-only action URL that drops the
		// page's ?redirectTo — so the hidden form field is the reliable carrier.
		// The url param is a defensive fallback. Both are re-validated (never
		// trust the client-supplied field beyond safeLocalPath).
		const redirectTo =
			safeLocalPath(data.get('redirectTo')?.toString()) ??
			safeLocalPath(url.searchParams.get('redirectTo'));
		redirect(302, redirectTo ?? '/discover');
	},

	logout: async ({ locals, cookies }) => {
		// Both the Supabase and OIDC adapters ignore the passed Session —
		// each reads its own cookie state to know what to clear.
		// If a future adapter requires a real Session here, thread it from authenticate().
		try {
			await locals.identityPort.invalidate({} as Session);
		} catch {
			// Fail open: redirect even if the substrate is unavailable.
			// The cookie will expire naturally; the user is effectively logged out.
		}
		// Also clear any account-less provider scope session (e.g. ember).
		try {
			const { getProviders } = await import('$lib/server/identity/index.js');
			for (const provider of getProviders()) provider.clear(cookies);
		} catch {
			// no providers configured — nothing to clear
		}
		redirect(302, '/login');
	},

	resetPassword: async ({ request, locals, url }) => {
		const data = await request.formData();
		const email = data.get('email');

		if (typeof email !== 'string' || email.length < 1) {
			return fail(400, { email: email?.toString(), error: 'Please enter your email' });
		}

		const { error } = await locals.supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${url.origin}/auth/callback?type=recovery`
		});

		if (error) {
			console.error('[resetPassword]', error.message);
			return fail(400, { email: email.toString(), error: 'Unable to send reset email — please try again' });
		}

		return { success: true, message: 'Check your email for a password reset link' };
	},

	updatePassword: async ({ request, locals }) => {
		const data = await request.formData();
		const password = data.get('password');

		if (typeof password !== 'string' || password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters' });
		}

		const { error } = await locals.supabase.auth.updateUser({ password });

		if (error) {
			console.error('[updatePassword]', error.message);
			return fail(400, { error: 'Unable to update password — please try again' });
		}

		redirect(302, '/discover');
	}
};
