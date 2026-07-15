import type { SupabaseClient } from '@supabase/supabase-js';
import type { GateStatus } from '$lib/domain/types.js';

export interface GateService {
	/**
	 * @param gatheringGateEnabled  Whether the U9 gathering obligation is enforced
	 *   (and the legacy group_feedback gate suppressed for slots with a gathering
	 *   row). Sourced in production from getGatheringFeedbackGateEnabled()
	 *   (app_settings, default TRUE). Defaults to FALSE here so pre-U9 callers and
	 *   the legacy gate tests keep the exact pre-U9 behaviour until they opt in;
	 *   hooks.server.ts passes the real app-settings flag.
	 */
	checkGate(userId: string, gatheringGateEnabled?: boolean): Promise<GateStatus>;
}

export class SupabaseGateService implements GateService {
	constructor(private supabase: SupabaseClient) {}

	async checkGate(_userId: string, gatheringGateEnabled = false): Promise<GateStatus> {
		// One round trip for all gate paths (one_on_one > gathering > group),
		// keyed on app.current_user_id() inside the RPC. The RPC excludes
		// one-on-one forms whose counterpart is access-expired (a vanished guest
		// must never gate their partner on a reveal that cannot complete), and —
		// when the flag is on — dual-reads the U9 gathering obligation while
		// suppressing the legacy group_feedback gate for the same slot (no
		// double-prompt). See migrations 20260605100600 and 20260715120600.
		const { data, error } = await this.supabase.rpc('my_feedback_gate', {
			p_gathering_gate_enabled: gatheringGateEnabled
		});

		if (error) {
			// Fail open — don't block on DB errors
			return { gated: false };
		}

		const row = (
			data as Array<{ kind: 'one_on_one' | 'group' | 'gathering'; form_id: string }> | null
		)?.[0];
		if (row) {
			return { gated: true, kind: row.kind, formId: row.form_id };
		}

		return { gated: false };
	}
}
