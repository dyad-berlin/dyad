#!/usr/bin/env node
// Seed one published conversation into the ember-demo corner so the
// account-less participation flow (/c/ember-demo) has something to respond to.
//
// Writes to whatever Supabase your env points at — run knowingly:
//   node --env-file=.env.local scripts/ember-seed-conversation.mjs
//
// It will:
//   1. ensure the `scopes` row for EMBER_SCOPE_SLUG exists,
//   2. ensure an `identities` row for the demo member (substrate='ember'),
//   3. insert a published `prompt` in that corner, authored by the demo member.
//
// Idempotent-ish: re-running adds another conversation. Prints the URL.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { sha256, hex, b64uDecode } from '@prefig/ember';

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const slug = process.env.EMBER_SCOPE_SLUG;
if (!url || !key) throw new Error('need PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)');
if (!slug) throw new Error('EMBER_SCOPE_SLUG not set');

const svc = createClient(url, key, { auth: { persistSession: false } });

// Demo member's Upactor id = SHA-256(member pubkey)[:32], same derivation the
// adapter uses — so a response by this member reuses this identities row.
const demo = JSON.parse(readFileSync(new URL('../.ember-demo.json', import.meta.url), 'utf8'));
const memberPub = b64uDecode(demo.member.pub);
const upactorId = hex(await sha256(memberPub)).slice(0, 32);

// 1. scope row
await svc.from('scopes').upsert({ scope: slug, name: slug }, { onConflict: 'scope' });

// 2. ember identity for the author
let authorId;
const found = await svc.from('identities').select('id').eq('substrate', 'ember').eq('substrate_id', upactorId).maybeSingle();
if (found.data?.id) {
	authorId = found.data.id;
} else {
	const ins = await svc.from('identities').insert({ substrate: 'ember', substrate_id: upactorId }).select('id').single();
	if (ins.error) throw new Error(`identity insert failed: ${ins.error.message}`);
	authorId = ins.data.id;
}

// 3. published conversation in the corner
const id = nanoid();
const { error } = await svc.from('prompts').insert({
	id,
	author_id: authorId,
	title: 'What brought you to this corner?',
	body: 'A first conversation, seeded for the ember demo. Respond by presence.',
	state: 'published',
	region: 'berlin',
	audience_scope: slug,
	published_at: new Date().toISOString(),
});
if (error) throw new Error(`prompt insert failed: ${error.message}`);

console.log(`Seeded conversation ${id} in corner "${slug}".`);
console.log(`Open: /c/${slug}/${id}`);
