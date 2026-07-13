#!/usr/bin/env node
// Simulate an EUDI wallet presentation against the local dyad dev server,
// using Erica (the BMI relying-party integration tool) as the wallet.
//
//   node scripts/eudi-simulate-wallet.mjs [pidTemplate] [simulationMode]
//
//   pidTemplate    Erica PID template, default 'normal'
//   simulationMode Erica mode, default 'VALID'
//
// Requires: dyad dev server (default http://127.0.0.1:5173, override
// DYAD_URL) and Erica (default http://127.0.0.1:3001, override ERICA_URL).
//
// Mirrors upact-eudi's tests/integration/erica-harness.ts accommodations:
// Erica's simulator derives the KB-JWT audience from `aud` or camelCase
// `clientId`, never snake_case `client_id`, so we strip `aud` and mirror
// `client_id` into `clientId` for the simulation call only.

const DYAD = process.env.DYAD_URL ?? 'http://127.0.0.1:5173';
const ERICA = process.env.ERICA_URL ?? 'http://127.0.0.1:3001';
const pidTemplate = process.argv[2] ?? 'normal';
const simulationMode = process.argv[3] ?? 'VALID';

async function main() {
	// 1. Begin a presentation transaction; dyad returns the wallet deeplink.
	const challengeRes = await fetch(`${DYAD}/api/session/eudi`);
	if (!challengeRes.ok) {
		throw new Error(`challenge failed: ${challengeRes.status} ${await challengeRes.text()}`);
	}
	const { deeplink } = await challengeRes.json();
	if (!deeplink) throw new Error('no deeplink in challenge response');
	console.log('deeplink:', deeplink);

	// 2. Dereference the request_uri ourselves (Erica refuses loopback fetches).
	const dl = new URL(deeplink);
	const requestUri = dl.searchParams.get('request_uri');
	const method = (dl.searchParams.get('request_uri_method') ?? 'get').toUpperCase();
	const reqRes = await fetch(requestUri, { method });
	if (!reqRes.ok) throw new Error(`request_uri dereference failed: ${reqRes.status}`);
	const requestJwt = await reqRes.text();
	const payload = JSON.parse(Buffer.from(requestJwt.split('.')[1], 'base64url').toString());
	console.log('request object served, nonce:', payload.nonce?.slice(0, 12) + '…');

	// 3. Hand it to Erica: validate against HAIP, simulate the wallet, and
	//    POST the encrypted direct_post.jwt back to dyad's response endpoint.
	const { aud: _aud, ...withoutAud } = payload;
	const res = await fetch(`${ERICA}/api/debug`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			request: { ...withoutAud, clientId: payload.client_id },
			validationProfile: 'pid-presentation',
			simulationMode,
			pidTemplate,
			postResponseToUri: true
		})
	});
	if (!res.ok) throw new Error(`Erica /api/debug failed: ${res.status} ${await res.text()}`);
	const body = await res.json();
	const session = body.data ?? {};

	const failed = (session.requestValidation?.checks ?? []).filter(
		(c) => !c.passed && c.severity === 'ERROR'
	);
	console.log(
		`HAIP request validation: ${failed.length} error(s)` +
			(failed.length ? ':\n' + failed.map((c) => `  - ${c.checkName}: ${c.issue ?? ''}`).join('\n') : '')
	);

	const post = session.simulatedResponse?.postResult ?? null;
	if (!post) {
		console.log('no POST result; simulation error:', session.simulatedResponse?.error ?? 'unknown');
		return;
	}
	console.log('wallet POST status:', post.status ?? JSON.stringify(post).slice(0, 200));
	const replyBody = post.body ?? post.data ?? null;
	const redirect = replyBody && typeof replyBody === 'object' ? replyBody.redirect_uri : null;
	if (redirect) {
		console.log('\npresentation accepted. Finish the login by opening:\n\n  ' + redirect + '\n');
	} else {
		console.log('wallet reply:', JSON.stringify(replyBody ?? post).slice(0, 400));
		console.log('(if a redirect_uri is missing above, check the dyad dev server log)');
	}
}

main().catch((err) => {
	console.error(err.message ?? err);
	process.exit(1);
});
