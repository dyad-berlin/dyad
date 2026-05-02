import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireIdentity } from '$lib/services/identity.js';
import { SupabaseInvitationService } from '$lib/services/invitation.js';
import { handleServiceError } from '$lib/server/handle-service-error.js';

/** POST /api/invitations/[id]/accept — accept invitation, create meeting atomically */
export const POST: RequestHandler = async ({ params, locals }) => {
	requireIdentity(locals);

	const service = new SupabaseInvitationService(locals.supabase);
	try {
		const meetingId = await service.accept(params.id);
		if (meetingId) {
			return json({ ok: true, meetingId });
		} else {
			return json(
				{ ok: false, error: 'That slot was booked by someone else, or the invitation has expired.' },
				{ status: 409 }
			);
		}
	} catch (err) {
		return handleServiceError(err, '[invitations/accept]');
	}
};
