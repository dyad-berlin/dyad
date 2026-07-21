import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, createAuthenticatedClient, TEST_USERS } from '../helpers/auth.js';

/**
 * copy_overrides — service-role-only (RLS on, no policies, no grants).
 *
 * The table holds admin-edited user-facing copy. Members never touch it
 * directly: the user plane reads it through a cached service-role fetch
 * (src/lib/server/copy-overrides.ts) and the admin plane writes it behind
 * Cloudflare Access. Anon and authenticated roles must see nothing and
 * write nothing — the app_settings posture (migration 20260721100000).
 */
describe('copy_overrides — invisible outside the service role', () => {
	const admin = createAdminClient();
	const TEST_KEY = 'itest.copy-overrides-rls';
	let anon: SupabaseClient;
	let member: SupabaseClient;

	beforeAll(async () => {
		anon = createClient(
			process.env.PUBLIC_SUPABASE_URL ?? '',
			process.env.PUBLIC_SUPABASE_ANON_KEY ?? '',
			{ auth: { persistSession: false, autoRefreshToken: false } }
		);
		member = await createAuthenticatedClient(TEST_USERS.lisa.email, TEST_USERS.lisa.password);
		await admin.from('copy_overrides').delete().eq('key', TEST_KEY);
		const { error } = await admin
			.from('copy_overrides')
			.insert({ key: TEST_KEY, value: 'seeded by test', updated_by: 'itest' });
		if (error) throw new Error(`setup failed: ${error.message}`);
	});

	afterAll(async () => {
		await admin.from('copy_overrides').delete().eq('key', TEST_KEY);
	});

	for (const [label, getClient] of [
		['anon', () => anon],
		['authenticated member', () => member]
	] as const) {
		it(`${label}: SELECT returns no rows`, async () => {
			const { data } = await getClient().from('copy_overrides').select('key');
			expect(data ?? []).toHaveLength(0);
		});

		it(`${label}: INSERT is denied`, async () => {
			const { error } = await getClient()
				.from('copy_overrides')
				.insert({ key: `${TEST_KEY}.insert-${label.replace(/\s/g, '')}`, value: 'nope' });
			expect(error).not.toBeNull();
		});

		it(`${label}: UPDATE affects nothing`, async () => {
			await getClient().from('copy_overrides').update({ value: 'hijacked' }).eq('key', TEST_KEY);
			const { data } = await admin
				.from('copy_overrides')
				.select('value')
				.eq('key', TEST_KEY)
				.single();
			expect(data?.value).toBe('seeded by test');
		});

		it(`${label}: DELETE affects nothing`, async () => {
			await getClient().from('copy_overrides').delete().eq('key', TEST_KEY);
			const { data } = await admin
				.from('copy_overrides')
				.select('key')
				.eq('key', TEST_KEY);
			expect(data).toHaveLength(1);
		});
	}

	it('service role: full round-trip (upsert, read, delete)', async () => {
		const key = `${TEST_KEY}.roundtrip`;
		const { error: upsertError } = await admin
			.from('copy_overrides')
			.upsert({ key, value: 'v1', default_at_save: 'd1', updated_by: 'itest' });
		expect(upsertError).toBeNull();
		const { data } = await admin.from('copy_overrides').select('value').eq('key', key).single();
		expect(data?.value).toBe('v1');
		const { error: deleteError } = await admin.from('copy_overrides').delete().eq('key', key);
		expect(deleteError).toBeNull();
	});
});
