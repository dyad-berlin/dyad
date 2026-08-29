import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, createAuthenticatedClient, TEST_USERS } from '../helpers/auth.js';

/**
 * unfolding_entries + wiggling_voices — service-role-only (RLS on, no
 * policies, no grants), the copy_overrides posture.
 *
 * Content is written by the admin plane behind Cloudflare Access and read on
 * the user plane through a service-role fetch behind the ContentService
 * port. Anon and authenticated roles must see nothing and write nothing —
 * a draft essay leaking through a permissive SELECT would publish it early.
 */
describe('content tables — invisible outside the service role', () => {
	const admin = createAdminClient();
	const TEST_SLUG = 'itest-content-rls';
	let anon: SupabaseClient;
	let member: SupabaseClient;
	let voiceId: string;

	beforeAll(async () => {
		anon = createClient(
			process.env.PUBLIC_SUPABASE_URL ?? '',
			process.env.PUBLIC_SUPABASE_ANON_KEY ?? '',
			{ auth: { persistSession: false, autoRefreshToken: false } }
		);
		member = await createAuthenticatedClient(TEST_USERS.lisa.email, TEST_USERS.lisa.password);

		await admin.from('unfolding_entries').delete().eq('slug', TEST_SLUG);
		const entry = await admin.from('unfolding_entries').insert({
			slug: TEST_SLUG,
			kicker: 'itest',
			title: 'Seeded by the RLS test',
			quote: 'unpublished draft',
			date: '2026-08-29',
			state: 'draft',
			updated_by: 'itest'
		});
		if (entry.error) throw new Error(`entry setup failed: ${entry.error.message}`);

		const voice = await admin
			.from('wiggling_voices')
			.insert({
				name: 'itest voice',
				src: 'voices/itest.mp4',
				poster: 'posters/itest.webp',
				episode: 'https://example.org/itest',
				state: 'draft',
				position: 999,
				updated_by: 'itest'
			})
			.select('id')
			.single();
		if (voice.error) throw new Error(`voice setup failed: ${voice.error.message}`);
		voiceId = voice.data.id;
	});

	afterAll(async () => {
		await admin.from('unfolding_entries').delete().eq('slug', TEST_SLUG);
		await admin.from('wiggling_voices').delete().eq('id', voiceId);
	});

	for (const [label, getClient] of [
		['anon', () => anon],
		['authenticated member', () => member]
	] as const) {
		it(`${label}: SELECT on unfolding_entries returns no rows`, async () => {
			const { data } = await getClient().from('unfolding_entries').select('slug');
			expect(data ?? []).toHaveLength(0);
		});

		it(`${label}: SELECT on wiggling_voices returns no rows`, async () => {
			const { data } = await getClient().from('wiggling_voices').select('id');
			expect(data ?? []).toHaveLength(0);
		});

		it(`${label}: INSERT into unfolding_entries is denied`, async () => {
			const { error } = await getClient().from('unfolding_entries').insert({
				slug: `${TEST_SLUG}-${label.replace(/\s/g, '')}`,
				kicker: 'x',
				title: 'x',
				quote: 'x',
				date: '2026-08-29'
			});
			expect(error).not.toBeNull();
		});

		it(`${label}: INSERT into wiggling_voices is denied`, async () => {
			const { error } = await getClient().from('wiggling_voices').insert({
				name: 'x',
				src: 'x',
				poster: 'x',
				episode: 'x',
				position: 998
			});
			expect(error).not.toBeNull();
		});

		it(`${label}: UPDATE on unfolding_entries affects nothing`, async () => {
			await getClient()
				.from('unfolding_entries')
				.update({ state: 'published' })
				.eq('slug', TEST_SLUG);
			const { data } = await admin
				.from('unfolding_entries')
				.select('state')
				.eq('slug', TEST_SLUG)
				.single();
			expect(data?.state).toBe('draft');
		});

		it(`${label}: DELETE on wiggling_voices affects nothing`, async () => {
			await getClient().from('wiggling_voices').delete().eq('id', voiceId);
			const { data } = await admin
				.from('wiggling_voices')
				.select('id')
				.eq('id', voiceId)
				.single();
			expect(data?.id).toBe(voiceId);
		});
	}
});
