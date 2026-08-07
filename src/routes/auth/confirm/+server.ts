import { redirect } from '@sveltejs/kit';
import type { EmailOtpType } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

// Token-hash verification target for Supabase auth email links. The email
// templates link here (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…`)
// instead of the default `{{ .ConfirmationURL }}`, for two reasons:
// - the link's domain is ours, not <project>.supabase.co — a sender/link
//   domain mismatch on a password-reset email is a strong spam signal;
// - verifyOtp needs no PKCE cookie, so the link works in any browser or
//   device, not only the one that requested it.
export const GET: RequestHandler = async ({ url, locals }) => {
	const tokenHash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type') as EmailOtpType | null;

	if (tokenHash && type) {
		const { error } = await locals.supabase.auth.verifyOtp({ token_hash: tokenHash, type });
		if (!error) {
			redirect(303, type === 'recovery' ? '/login?mode=update' : '/discover');
		}
		console.error('[auth/confirm] verifyOtp failed:', error.message);
	}

	// Invalid, expired, or already-used link: back to the reset form with a
	// notice so the member can request a fresh one.
	redirect(303, '/login?error=link_expired');
};
