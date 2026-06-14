import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProvider } from '$lib/server/identity/index.js';

/**
 * Generic scope-session endpoint, substrate-agnostic.
 *
 *   GET    /api/session/[provider]  -> issue a challenge (provider-shaped payload)
 *   POST   /api/session/[provider]  -> establish a session from presented evidence
 *   DELETE /api/session/[provider]  -> forget the session
 *
 * 404 unless [provider] is a configured provider. The provider implements the
 * substrate-specific credential handling; this endpoint names no substrate.
 */

export const GET: RequestHandler = async ({ params, cookies }) => {
	const provider = getProvider(params.provider);
	if (!provider) error(404, 'unknown identity provider');
	const payload = await provider.challenge(cookies);
	return json({ provider: provider.id, scope: provider.scope, ...payload });
};

export const POST: RequestHandler = async ({ params, request, cookies }) => {
	const provider = getProvider(params.provider);
	if (!provider) error(404, 'unknown identity provider');

	let evidence: unknown;
	try {
		evidence = await request.json();
	} catch {
		error(400, 'invalid JSON body');
	}

	const result = await provider.establish(cookies, evidence);
	if (!result.ok) {
		return json({ error: result.message, code: result.code }, { status: result.status });
	}
	return json({ scope: result.session.scope, expiresAt: result.session.expiresAt });
};

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	const provider = getProvider(params.provider);
	if (!provider) error(404, 'unknown identity provider');
	provider.clear(cookies);
	return json({ ok: true });
};
