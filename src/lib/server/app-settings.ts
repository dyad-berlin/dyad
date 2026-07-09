import { makeAdminClient } from './supabase-admin.js';
import { PROTECTED_ACTIONS, type MembershipGating } from '$lib/domain/gating.js';

/**
 * Runtime-configurable settings read and written via the service-role client.
 * Backed by the `app_settings` table seeded in
 * supabase/migrations/20260522100000_add_app_settings.sql.
 */

const EMAIL_NOTIFICATIONS_ENABLED_KEY = 'email_notifications_enabled';
const MEMBERSHIP_GATING_KEY = 'membership_gating';
const FREE_INTERACTION_QUOTA_KEY = 'free_interaction_quota';

/** Default free-interaction quota when the key is absent, non-integer, or a read
 *  fails: 0 — the gate is pure members-only from the first gated action, and the
 *  free-quota machinery ships DORMANT. An operator can raise N later (once the
 *  live-count delete/recreate + cross-transaction concurrency properties are
 *  settled). Must match the COALESCE fallback in app.gating_allows (the SQL
 *  safety net) so the app gate and the RLS net never disagree on the same actor. */
export const DEFAULT_FREE_INTERACTION_QUOTA = 0;
const MAX_FREE_INTERACTION_QUOTA = 99;

/** Clamp a candidate quota to a valid integer in [0, 99]. A non-integer (NaN,
 *  float, out-of-JS-safe) or absent value falls back to the default — mirroring
 *  the SQL side, which COALESCEs a malformed value to the same default. */
function normalizeQuota(value: unknown): number {
	if (typeof value !== 'number' || !Number.isInteger(value)) return DEFAULT_FREE_INTERACTION_QUOTA;
	if (value < 0) return 0;
	if (value > MAX_FREE_INTERACTION_QUOTA) return MAX_FREE_INTERACTION_QUOTA;
	return value;
}

/** Read the global notification kill switch. Defaults to false on any error so
 *  a settings outage fails closed rather than spraying mail. */
export async function getEmailNotificationsEnabled(): Promise<boolean> {
	const admin = makeAdminClient();
	const { data, error } = await admin
		.from('app_settings')
		.select('value')
		.eq('key', EMAIL_NOTIFICATIONS_ENABLED_KEY)
		.maybeSingle();

	if (error) {
		console.error('[app-settings] read email_notifications_enabled failed:', error);
		return false;
	}
	return data?.value === true;
}

/** Read the safety-reporting feature flag. Defaults to false (absent key or any
 *  error) so the confidential reporting channel stays OFF until the retention /
 *  Datenschutz / legal go-live gate (plan U5) is cleared and an operator flips it. */
export async function getSafetyReportingEnabled(): Promise<boolean> {
	const admin = makeAdminClient();
	const { data, error } = await admin
		.from('app_settings')
		.select('value')
		.eq('key', 'safety_reporting_enabled')
		.maybeSingle();

	if (error) {
		console.error('[app-settings] read safety_reporting_enabled failed:', error);
		return false;
	}
	return data?.value === true;
}

/** Set the global notification kill switch. Writes via service-role. Operator
 *  attribution is intentionally not stored — see the comment in the migration. */
export async function setEmailNotificationsEnabled(enabled: boolean): Promise<void> {
	const admin = makeAdminClient();
	const { error } = await admin
		.from('app_settings')
		.upsert(
			{
				key: EMAIL_NOTIFICATIONS_ENABLED_KEY,
				value: enabled,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'key' }
		);

	if (error) {
		console.error('[app-settings] write email_notifications_enabled failed:', error);
		throw error;
	}
}

/** Read the per-action membership gating config. Returns only known, boolean
 *  flags; an absent key or any error yields {} — gating off for every action
 *  (the activation default). The endpoint gate reads this; the RLS safety net
 *  reads the same `app_settings` row via app.gating_allows. */
export async function getMembershipGating(): Promise<MembershipGating> {
	const admin = makeAdminClient();
	const { data, error } = await admin
		.from('app_settings')
		.select('value')
		.eq('key', MEMBERSHIP_GATING_KEY)
		.maybeSingle();

	if (error) {
		console.error('[app-settings] read membership_gating failed:', error);
		return {};
	}
	const value = data?.value;
	if (!value || typeof value !== 'object') return {};

	const out: MembershipGating = {};
	for (const action of PROTECTED_ACTIONS) {
		const flag = (value as Record<string, unknown>)[action];
		if (typeof flag === 'boolean') out[action] = flag;
	}
	return out;
}

/** Replace the per-action membership gating config (service-role). Only known
 *  action keys with boolean values are persisted, so an unknown key can never
 *  enter the stored object. */
export async function setMembershipGating(gating: MembershipGating): Promise<void> {
	const clean: MembershipGating = {};
	for (const action of PROTECTED_ACTIONS) {
		const flag = gating[action];
		if (typeof flag === 'boolean') clean[action] = flag;
	}

	const admin = makeAdminClient();
	const { error } = await admin
		.from('app_settings')
		.upsert(
			{ key: MEMBERSHIP_GATING_KEY, value: clean, updated_at: new Date().toISOString() },
			{ onConflict: 'key' }
		);

	if (error) {
		console.error('[app-settings] write membership_gating failed:', error);
		throw error;
	}
}

/** Read the free-interaction quota N: how many gated actions a registered guest
 *  may perform before a membership is required. Absent / non-integer / any error
 *  yields DEFAULT_FREE_INTERACTION_QUOTA (0), matching the COALESCE in
 *  app.gating_allows so the app gate and the RLS safety net agree on the same N. */
export async function getFreeInteractionQuota(): Promise<number> {
	const admin = makeAdminClient();
	const { data, error } = await admin
		.from('app_settings')
		.select('value')
		.eq('key', FREE_INTERACTION_QUOTA_KEY)
		.maybeSingle();

	if (error) {
		console.error('[app-settings] read free_interaction_quota failed:', error);
		return DEFAULT_FREE_INTERACTION_QUOTA;
	}
	return normalizeQuota(data?.value);
}
