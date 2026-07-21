/**
 * Resolve every active scope session for a request, across all configured
 * providers. Called once per request in hooks.server.ts. Substrate-agnostic:
 * it iterates the registry and never names a provider.
 */

import type { Cookies } from '@sveltejs/kit';
import type { ScopeSession } from './types.js';
import { getProviders } from './registry.js';

export async function loadScopeSessions(
	cookies: Cookies,
	nowSeconds: number
): Promise<{ scopes: string[]; sessions: ScopeSession[] }> {
	const sessions: ScopeSession[] = [];
	for (const provider of await getProviders()) {
		const session = await provider.resolveSession(cookies, nowSeconds);
		if (session) sessions.push(session);
	}
	const scopes = [...new Set(sessions.map((s) => s.scope))];
	return { scopes, sessions };
}
