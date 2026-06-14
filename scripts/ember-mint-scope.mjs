#!/usr/bin/env node
// Mint an ember scope for local dyad development, and produce presence proofs
// against the dev API's challenge nonce.
//
//   node scripts/ember-mint-scope.mjs mint [slug] [ttlSeconds]
//       Founds a scope, grants one demo member, writes .ember-demo.json, and
//       prints the EMBER_SCOPE_GENESIS / EMBER_SCOPE_SLUG env lines to set.
//
//   node scripts/ember-mint-scope.mjs proof <nonceB64>
//       Produces a presence proof for the demo member answering <nonceB64>
//       (the nonce returned by GET /api/scopes/ember). Paste it into the
//       ember corner page, or POST it directly.
//
// .ember-demo.json holds private keys for the demo scope only — gitignored.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import {
  generateIdentity, createGenesis, founderCred, createReq, parseReq,
  grantCred, createProof, b64uEncode, b64uDecode, now,
} from '@prefig/ember';

const STATE = new URL('../.ember-demo.json', import.meta.url);
const enc = (u8) => b64uEncode(u8);
const dec = (s) => b64uDecode(s);
const id = (i) => ({ priv: dec(i.priv), pub: dec(i.pub) });
const saveId = (i) => ({ priv: enc(i.priv), pub: enc(i.pub) });

async function mint(slug = 'ember-demo', ttl = 3600) {
  const founder = await generateIdentity();
  const genesis = await createGenesis({ name: slug, ttl: Number(ttl), maxDepth: 3, identity: founder });
  const member = await generateIdentity();
  const { bytes: reqBytes } = await createReq({ scopeId: null, identity: member, name: 'demo member' });
  const cred = await grantCred({
    granterCredBytes: founderCred(genesis), identity: founder, req: await parseReq(reqBytes),
  });

  writeFileSync(STATE, JSON.stringify({
    slug, ttl: Number(ttl),
    genesis: enc(genesis),
    founder: saveId(founder),
    member: saveId(member),
    cred: enc(cred),
  }, null, 2));

  console.log('# ember demo scope minted. Add to dyad .env / .env.local:\n');
  console.log(`EMBER_SCOPE_GENESIS=${enc(genesis)}`);
  console.log(`EMBER_SCOPE_SLUG=${slug}`);
  console.log(`\n# Create the dyad scope row too (slug must exist in the scopes table):`);
  console.log(`#   insert into scopes (scope, name) values ('${slug}', '${slug}');`);
  console.log(`\n# Demo member credential expires in ${ttl}s. Re-run 'mint' to renew the demo member.`);
  console.log(`# State written to .ember-demo.json (gitignore it).`);
}

async function proof(nonceB64) {
  if (!existsSync(STATE)) throw new Error('run `mint` first');
  if (!nonceB64) throw new Error('usage: proof <nonceB64>');
  const s = JSON.parse(readFileSync(STATE, 'utf8'));
  const p = await createProof({ credBytes: dec(s.cred), nonce: dec(nonceB64), identity: id(s.member) });
  const credExp = now(); // informational
  void credExp;
  console.log(enc(p));
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'mint') await mint(args[0], args[1]);
else if (cmd === 'proof') await proof(args[0]);
else {
  console.error('usage: ember-mint-scope.mjs mint [slug] [ttlSeconds] | proof <nonceB64>');
  process.exit(1);
}
