import { json } from '@sveltejs/kit';
import {
	getEmailNotificationsEnabled,
	setEmailNotificationsEnabled,
	getMembershipGating,
	setMembershipGating,
	getFreeInteractionQuota,
	setFreeInteractionQuota
} from '$lib/server/app-settings';
import { isProtectedAction } from '$lib/domain/gating';
import type { RequestHandler } from './$types';

/**
 * Admin-plane settings endpoint. Lives under /admin/* and is gated by the
 * Cloudflare Access hook in src/hooks.server.ts. Uses the service-role
 * Supabase client — no user identity is involved.
 */

export const GET: RequestHandler = async () => {
	const [emailNotificationsEnabled, membershipGating, freeInteractionQuota] = await Promise.all([
		getEmailNotificationsEnabled(),
		getMembershipGating(),
		getFreeInteractionQuota()
	]);
	return json({
		email_notifications_enabled: emailNotificationsEnabled,
		membership_gating: membershipGating,
		free_interaction_quota: freeInteractionQuota
	});
};

export const PATCH: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	// Per-action membership gating — REPLACES the whole config (not a merge) with
	// a validated map; the admin UI always sends the full desired object. A
	// non-UI caller omitting keys turns those actions off.
	if ('membership_gating' in body) {
		const gating = body.membership_gating;
		if (typeof gating !== 'object' || gating === null || Array.isArray(gating)) {
			return json({ error: 'membership_gating must be an object' }, { status: 400 });
		}
		for (const [key, value] of Object.entries(gating)) {
			if (!isProtectedAction(key)) {
				return json({ error: `Unknown action: ${key}` }, { status: 400 });
			}
			if (typeof value !== 'boolean') {
				return json({ error: `Flag for ${key} must be a boolean` }, { status: 400 });
			}
		}
		try {
			await setMembershipGating(gating as Record<string, boolean>);
		} catch {
			return json({ error: 'Failed to update settings' }, { status: 500 });
		}
		return json({ ok: true, membership_gating: await getMembershipGating() });
	}

	// Free-interaction quota — how many gated actions a guest may perform before a
	// membership is required. Must be an integer in [0, 99]. setFreeInteractionQuota
	// clamps as defence, but we reject a malformed value here so the operator sees
	// a 400 rather than a silent clamp.
	if ('free_interaction_quota' in body) {
		const quota = body.free_interaction_quota;
		if (typeof quota !== 'number' || !Number.isInteger(quota)) {
			return json({ error: 'free_interaction_quota must be an integer' }, { status: 400 });
		}
		if (quota < 0 || quota > 99) {
			return json({ error: 'free_interaction_quota must be between 0 and 99' }, { status: 400 });
		}
		try {
			await setFreeInteractionQuota(quota);
		} catch {
			return json({ error: 'Failed to update settings' }, { status: 500 });
		}
		return json({ ok: true, free_interaction_quota: await getFreeInteractionQuota() });
	}

	// Global notification kill switch.
	if (typeof body.email_notifications_enabled === 'boolean') {
		try {
			await setEmailNotificationsEnabled(body.email_notifications_enabled);
		} catch {
			return json({ error: 'Failed to update settings' }, { status: 500 });
		}
		return json({ ok: true, email_notifications_enabled: body.email_notifications_enabled });
	}

	return json({ error: 'No recognized setting in request' }, { status: 400 });
};
