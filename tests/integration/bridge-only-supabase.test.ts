import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import { createAdminClient, SEED_USERS, TEST_USERS } from '../helpers/auth.js';
import { cleanTestData } from '../helpers/cleanup.js';

/**
 * Bridge-only decoupling proof. A Supabase-origin identity (its id mirrors
 * auth.uid()) is authorized against the data project ENTIRELY through a minted
 * identity claim, with no Supabase Auth session behind the client. auth.uid()
 * is null under these clients, so anything that still works proves the data
 * layer authorizes on app.current_user_id()/app_scopes, not on Supabase Auth.
 *
 * This is the cheap stand-in for a second Supabase Auth project: it forces the
 * Supabase user down the same claim path providers use. If a future change
 * reintroduces an auth.uid() dependency for logged-in members, a read or write
 * here goes dark and this test fails.
 */

const TEST_SCOPE = 'bridge-only-test';
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY ?? '';
const JWT_SECRET =
	process.env.SUPABASE_JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long';

// Mirrors src/lib/server/identity/claims-sign.ts: the claim carries the
// identity and its scopes; no Supabase session is attached.
async function claimClient(identityId: string, scopes: string[]): Promise<SupabaseClient> {
	const jwt = await new SignJWT({
		role: 'authenticated',
		app_identity_id: identityId,
		app_scopes: scopes
	})
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setIssuedAt()
		.setSubject(identityId)
		.setAudience('authenticated')
		.setExpirationTime('5m')
		.sign(new TextEncoder().encode(JWT_SECRET));
	return createClient(SUPABASE_URL, ANON_KEY, {
		global: { headers: { Authorization: `Bearer ${jwt}` } },
		auth: { persistSession: false, autoRefreshToken: false }
	});
}

describe('Bridge-only: Supabase identity authorized via claim, no session', () => {
	let admin: SupabaseClient;
	let scopedPromptId: string;

	beforeAll(async () => {
		admin = createAdminClient();
		await admin.from('prompts').update({ audience_scope: null }).eq('audience_scope', TEST_SCOPE);
		await admin.from('identity_scopes').delete().eq('scope', TEST_SCOPE);
		await admin.from('scopes').delete().eq('scope', TEST_SCOPE);
		await cleanTestData(admin);

		await admin.from('scopes').insert({
			scope: TEST_SCOPE,
			name: 'Bridge-only test corner',
			description: 'Claim-authorized Supabase identity.',
			created_by: TEST_USERS.lisa.id
		});
		// digit (lisa) is the grantee; ava authors the scoped prompt.
		await admin.from('identity_scopes').insert([
			{ identity_id: SEED_USERS.digit.id, scope: TEST_SCOPE, granted_by: TEST_USERS.lisa.id },
			{ identity_id: TEST_USERS.ava.id, scope: TEST_SCOPE, granted_by: TEST_USERS.lisa.id }
		]);

		scopedPromptId = `bridge-only-${Date.now()}`;
		await admin
			.from('prompts')
			.insert({
				id: scopedPromptId,
				author_id: TEST_USERS.ava.id,
				title: 'Bridge-only scoped prompt',
				state: 'published',
				region: 'berlin',
				audience_scope: TEST_SCOPE,
				published_at: new Date().toISOString()
			})
			.throwOnError();
	});

	afterAll(async () => {
		await admin.from('prompts').delete().eq('id', scopedPromptId);
		await admin.from('identity_scopes').delete().eq('scope', TEST_SCOPE);
		await admin.from('scopes').delete().eq('scope', TEST_SCOPE);
	});

	it('a claim for the granted identity reads the scoped prompt (no session)', async () => {
		const client = await claimClient(SEED_USERS.digit.id, [TEST_SCOPE]);
		const { data, error } = await client.from('prompts').select('id').eq('id', scopedPromptId);
		expect(error, error?.message).toBeNull();
		expect(data?.map((r) => r.id)).toContain(scopedPromptId);
	});

	it('a claim for a different identity without the scope cannot see it', async () => {
		const client = await claimClient(SEED_USERS.other.id, []);
		const { data, error } = await client.from('prompts').select('id').eq('id', scopedPromptId);
		expect(error, error?.message).toBeNull();
		expect(data ?? []).toHaveLength(0);
	});

	it('a claim write is attributed to the claim identity, not auth.uid()', async () => {
		const client = await claimClient(SEED_USERS.digit.id, [TEST_SCOPE]);
		const { error } = await client
			.from('prompt_comments')
			.insert({ prompt_id: scopedPromptId, author_id: SEED_USERS.digit.id, body: { ok: true } });
		expect(error, error?.message).toBeNull();

		const { data } = await admin
			.from('prompt_comments')
			.select('author_id')
			.eq('prompt_id', scopedPromptId);
		expect(data?.map((r) => r.author_id)).toContain(SEED_USERS.digit.id);

		await admin.from('prompt_comments').delete().eq('prompt_id', scopedPromptId);
	});
});
