import { redirect } from '@sveltejs/kit';
import type { Session } from '@prefig/upact';
import type { Actions } from './$types';

/**
 * POST-only logout. A GET hits the +page.svelte with a manual sign-out button;
 * cross-origin `<img src="/logout">` or prefetch can no longer sign the user
 * out by accident (was a CSRF hazard when /logout was a GET `load` action).
 */
export const actions: Actions = {
	default: async ({ locals, cookies }) => {
		// See note in (auth)/login/+page.server.ts — both current adapters
		// ignore the Session param and read their own cookie state.
		try {
			await locals.identityPort.invalidate({} as Session);
		} catch {
			// Fail open: redirect even if the substrate is unavailable.
		}
		// Sign out regardless of how the visitor was accredited: also clear any
		// account-less provider scope session (e.g. ember). Without this, an
		// ember visitor's cookie would survive "sign out".
		try {
			const { getProviders } = await import('$lib/server/identity/index.js');
			for (const provider of getProviders()) provider.clear(cookies);
		} catch {
			// no providers configured / import failure — nothing to clear
		}
		redirect(303, '/');
	}
};
