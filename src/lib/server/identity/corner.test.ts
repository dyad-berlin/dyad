import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveIdentityId } from './identities.js';
import { respondToCornerConversation } from './corner.js';

// Minimal fake Supabase query builder (records the chain + insert/upsert payload).
type Result = { data: unknown; error: unknown };
type Router = (table: string, chain: { method: string; args: unknown[] }[], payload: unknown) => Result;

function fakeClient(router: Router): SupabaseClient {
	const handler = (table: string) => {
		const chain: { method: string; args: unknown[] }[] = [];
		let payload: unknown;
		const resolve = (): Result => router(table, chain, payload);
		const builder: Record<string, unknown> = {};
		const record = (method: string) => (...args: unknown[]) => {
			chain.push({ method, args });
			if (method === 'insert' || method === 'upsert' || method === 'update') payload = args[0];
			return builder;
		};
		for (const m of ['select', 'eq', 'is', 'order', 'limit', 'insert', 'upsert', 'update']) builder[m] = record(m);
		builder.maybeSingle = async () => resolve();
		builder.single = async () => resolve();
		builder.then = (f: (r: Result) => unknown) => Promise.resolve(resolve()).then(f);
		return builder;
	};
	return { from: (t: string) => handler(t) } as unknown as SupabaseClient;
}

describe('resolveIdentityId (substrate-agnostic)', () => {
	it('returns an existing identity', async () => {
		const c = fakeClient(() => ({ data: { id: 'existing' }, error: null }));
		expect(await resolveIdentityId(c, 'atproto', 'abc')).toBe('existing');
	});

	it('inserts a row tagged with the given substrate when absent', async () => {
		let inserted: any = null;
		let first = true;
		const c = fakeClient((_t, chain, payload) => {
			if (chain.some((x) => x.method === 'insert')) {
				inserted = payload;
				return { data: { id: 'new' }, error: null };
			}
			if (first) {
				first = false;
				return { data: null, error: null };
			}
			return { data: null, error: null };
		});
		expect(await resolveIdentityId(c, 'oidc', 'sub@iss')).toBe('new');
		expect(inserted).toEqual({ substrate: 'oidc', substrate_id: 'sub@iss' });
	});
});

describe('respondToCornerConversation', () => {
	const inCorner = { id: 'p1', title: 'T', body: 'B', published_at: null, audience_scope: 'corner-x', state: 'published', hidden_at: null };

	function clientFor(prompt: unknown) {
		return fakeClient((table, chain) => {
			if (table === 'prompts') return { data: prompt, error: null };
			if (table === 'prompt_comments') {
				if (chain.some((c) => c.method === 'upsert')) return { data: { id: 'resp-1' }, error: null };
				return { data: [], error: null };
			}
			return { data: null, error: null };
		});
	}

	it('rejects an empty body', async () => {
		expect((await respondToCornerConversation(clientFor(inCorner), 'corner-x', 'p1', 'a', '  ')).ok).toBe(false);
	});

	it('rejects a conversation not in this corner', async () => {
		const r = await respondToCornerConversation(clientFor({ ...inCorner, audience_scope: 'other' }), 'corner-x', 'p1', 'a', 'hi');
		expect(r.ok).toBe(false);
	});

	it('attributes the response to the given author identity', async () => {
		let payload: any = null;
		const c = fakeClient((table, chain, p) => {
			if (table === 'prompts') return { data: inCorner, error: null };
			if (table === 'prompt_comments') {
				if (chain.some((x) => x.method === 'upsert')) {
					payload = p;
					return { data: { id: 'resp-1' }, error: null };
				}
				return { data: [], error: null };
			}
			return { data: null, error: null };
		});
		const r = await respondToCornerConversation(c, 'corner-x', 'p1', 'author-uuid', 'hello');
		expect(r.ok).toBe(true);
		expect(payload).toEqual({ prompt_id: 'p1', author_id: 'author-uuid', body: 'hello' });
	});
});
