import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createAuthenticatedClient, TEST_USERS } from '../helpers/auth.js';

// Regression guard for the exact_location column mask (see migration
// 20260729170000_relock_time_slots_anon_grants.sql).
//
// exact_location is the private meeting place, revealed only to the author
// and matched meeting participants (both via SECURITY DEFINER RPCs). The
// public read surface is the time_slots_public view / a column-scoped grant
// on the base table. This protection is a COLUMN GRANT, not RLS — and the
// baseline's ALTER DEFAULT PRIVILEGES re-opens every privilege on any table
// that is created or recreated, which is exactly how the anon mask was lost
// once before (20260402 added a column grant but never revoked the inherited
// full-table SELECT). These tests fail loudly if that ever happens again.

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY ?? '';

function createAnonClient(): SupabaseClient {
	return createClient(SUPABASE_URL, ANON_KEY, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
}

describe('exact_location column mask (regression guard)', () => {
	let anon: SupabaseClient;
	let member: SupabaseClient;

	beforeAll(async () => {
		anon = createAnonClient();
		// Any signed-in non-author works: the column grant applies role-wide.
		member = await createAuthenticatedClient(TEST_USERS.lisa.email, TEST_USERS.lisa.password);
	});

	it('anon cannot select exact_location from time_slots', async () => {
		const { error } = await anon.from('time_slots').select('exact_location').limit(1);
		// Permission errors fire regardless of matching rows, so this needs no
		// fixtures. 42501 = insufficient_privilege.
		expect(error).not.toBeNull();
		expect(error!.code).toBe('42501');
	});

	it('authenticated members cannot select exact_location from time_slots', async () => {
		const { error } = await member.from('time_slots').select('exact_location').limit(1);
		expect(error).not.toBeNull();
		expect(error!.code).toBe('42501');
	});

	it('the safe column set stays readable for anon (published prompts feed)', async () => {
		const { error } = await anon
			.from('time_slots')
			.select('id, prompt_id, start_time, duration_minutes, general_area, general_area_lat, general_area_lng, accepted, created_at, retired_at')
			.limit(1);
		expect(error).toBeNull();
	});

	it('time_slots_public does not carry exact_location at all', async () => {
		const { error } = await anon.from('time_slots_public').select('exact_location').limit(1);
		// 42703 = undefined_column: the view must not even have the column.
		expect(error).not.toBeNull();
		expect(error!.code).toBe('42703');
	});

	it('anon cannot write to time_slots', async () => {
		const { error } = await anon.from('time_slots').insert({
			prompt_id: 'no-such-prompt',
			start_time: new Date(Date.now() + 86400000).toISOString(),
			duration_minutes: 60,
			general_area: 'Nowhere',
			general_area_lat: 0,
			general_area_lng: 0
		});
		expect(error).not.toBeNull();
	});
});
