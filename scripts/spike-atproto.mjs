#!/usr/bin/env node
// atproto spike operator script (plan U5). Self-contained: node >= 22, plain
// fetch, zero dependencies. Run by a human with credentials in the
// environment — never from app code.
//
// Env:
//   ATPROTO_HANDLE        test-account handle (e.g. dyad-unfolding.bsky.social)
//   ATPROTO_APP_PASSWORD  app password for that account (never the main password)
//   ATPROTO_ENTRY_HOST    optional, default https://bsky.social
//   SUPABASE_URL          mirror only: project URL
//   SUPABASE_SERVICE_ROLE_KEY  mirror only: service-role key
//   SPIKE_PREVIEW_URL     measure only: preview deployment origin
//
// Commands:
//   publish <entry.json>            write one entry record (rkey = slug)
//   upload-blob <file> <mime>       upload a blob to the PDS, print its CID
//   mirror <cid> <dest-path> <mime> fetch a PDS blob, verify, mirror to Supabase Storage
//   measure <slug> [cycles]         publish-to-visible latency, p95 over N cycles (default 20)

const ENTRY_HOST = process.env.ATPROTO_ENTRY_HOST ?? 'https://bsky.social';
const COLLECTION = 'social.dyad.unfolding.entry';

function fail(message) {
	console.error(message);
	process.exit(1);
}

function requireEnv(name) {
	const value = process.env[name];
	if (!value) fail(`Missing env: ${name}`);
	return value;
}

async function createSession() {
	const response = await fetch(`${ENTRY_HOST}/xrpc/com.atproto.server.createSession`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			identifier: requireEnv('ATPROTO_HANDLE'),
			password: requireEnv('ATPROTO_APP_PASSWORD')
		})
	});
	if (!response.ok) fail(`createSession failed: ${response.status} ${await response.text()}`);
	return response.json(); // { accessJwt, did, ... }
}

async function putRecord(session, rkey, record) {
	const response = await fetch(`${ENTRY_HOST}/xrpc/com.atproto.repo.putRecord`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${session.accessJwt}`
		},
		body: JSON.stringify({ repo: session.did, collection: COLLECTION, rkey, record })
	});
	if (!response.ok) fail(`putRecord failed: ${response.status} ${await response.text()}`);
	return response.json();
}

async function cmdPublish(entryPath) {
	const { readFile } = await import('node:fs/promises');
	const entry = JSON.parse(await readFile(entryPath, 'utf8'));
	if (!entry.slug) fail('entry.json must carry a slug — it becomes the record key');

	const session = await createSession();
	const result = await putRecord(session, entry.slug, { $type: COLLECTION, ...entry });
	console.log(`published: ${result.uri}`);
	console.log(`repo did:  ${session.did}`);
}

async function cmdUploadBlob(filePath, mime) {
	const { readFile } = await import('node:fs/promises');
	const bytes = await readFile(filePath);
	const session = await createSession();
	const response = await fetch(`${ENTRY_HOST}/xrpc/com.atproto.repo.uploadBlob`, {
		method: 'POST',
		headers: { 'content-type': mime, authorization: `Bearer ${session.accessJwt}` },
		body: bytes
	});
	if (!response.ok) fail(`uploadBlob failed: ${response.status} ${await response.text()}`);
	const { blob } = await response.json();
	console.log(`blob cid: ${blob.ref?.$link ?? JSON.stringify(blob)}`);
	console.log(`repo did: ${session.did}`);
}

// Minimal magic-byte check for the spike's mirror step. The canonical,
// fully-tested implementation is src/lib/server/atproto/blob-mirror.ts —
// the production path (U7) uses that; this inline copy exists only because
// a zero-dependency .mjs script cannot import the aliased TS module.
function magicBytesMatch(mime, bytes) {
	if (mime === 'image/png')
		return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
	if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
	if (mime === 'image/webp')
		return bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP';
	return false;
}

async function cmdMirror(cid, destPath, mime) {
	const session = await createSession();
	const blobResponse = await fetch(
		`${ENTRY_HOST}/xrpc/com.atproto.sync.getBlob?did=${session.did}&cid=${cid}`
	);
	if (!blobResponse.ok) fail(`getBlob failed: ${blobResponse.status}`);
	const bytes = Buffer.from(await blobResponse.arrayBuffer());

	if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime))
		fail(`type ${mime} not allowlisted for the spike mirror`);
	if (!magicBytesMatch(mime, bytes)) fail(`blob content does not match claimed type ${mime}`);

	const supabaseUrl = requireEnv('SUPABASE_URL');
	const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
	const upload = await fetch(
		`${supabaseUrl}/storage/v1/object/newsletter%20assets/${encodeURI(destPath)}`,
		{
			method: 'POST',
			headers: { authorization: `Bearer ${serviceKey}`, 'content-type': mime },
			body: bytes
		}
	);
	if (!upload.ok) fail(`storage upload failed: ${upload.status} ${await upload.text()}`);
	console.log(`mirrored ${bytes.length} bytes as ${mime} → newsletter assets/${destPath}`);
}

async function cmdMeasure(slug, cycles = 20) {
	const previewUrl = requireEnv('SPIKE_PREVIEW_URL').replace(/\/+$/, '');
	const session = await createSession();
	const seconds = [];

	for (let i = 1; i <= cycles; i++) {
		const marker = `measure-${Date.now()}-${i}`;
		const record = {
			$type: COLLECTION,
			slug,
			kicker: 'Spike Measurement',
			title: `Latency probe ${marker}`,
			quote: 'Measured, not promised.',
			date: new Date().toISOString().slice(0, 10),
			paragraphs: [`Cycle ${i} marker ${marker}.`]
		};
		const started = Date.now();
		await putRecord(session, slug, record);

		// Poll the preview deployment until the marker is visible.
		for (;;) {
			const page = await fetch(`${previewUrl}/newsletter/${slug}`).then(
				(r) => r.text(),
				() => ''
			);
			if (page.includes(marker)) break;
			if (Date.now() - started > 10 * 60 * 1000) fail(`cycle ${i}: not visible after 10 minutes`);
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}
		const elapsed = (Date.now() - started) / 1000;
		seconds.push(elapsed);
		console.log(`cycle ${i}/${cycles}: ${elapsed.toFixed(1)}s`);
	}

	seconds.sort((a, b) => a - b);
	const p95 = seconds[Math.min(seconds.length - 1, Math.ceil(seconds.length * 0.95) - 1)];
	console.log(`\np95 over ${cycles} cycles: ${p95.toFixed(1)}s (bound: 300s, R8)`);
	console.log(`all: ${seconds.map((s) => s.toFixed(1)).join(', ')}`);
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
	case 'publish':
		await cmdPublish(args[0] ?? fail('usage: publish <entry.json>'));
		break;
	case 'upload-blob':
		await cmdUploadBlob(args[0], args[1] ?? fail('usage: upload-blob <file> <mime>'));
		break;
	case 'mirror':
		await cmdMirror(args[0], args[1], args[2] ?? fail('usage: mirror <cid> <dest-path> <mime>'));
		break;
	case 'measure':
		await cmdMeasure(args[0] ?? fail('usage: measure <slug> [cycles]'), Number(args[1] ?? 20));
		break;
	default:
		fail('usage: spike-atproto.mjs publish|upload-blob|mirror|measure …');
}
