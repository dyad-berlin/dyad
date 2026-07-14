/**
 * The configured identity providers for this deployment.
 *
 * This is the composition root: the one place a substrate package is named, the
 * same way `hooks.server.ts` names `createSupabaseAdapter` once. Adding OIDC or
 * another substrate is a new `providers/<name>.ts` and one line here. dyad core
 * resolves providers only through the generic `IdentityProvider` interface.
 */

import type { IdentityProvider } from './types.js';
import { emberProvider } from './providers/ember.js';
import { eudiProvider } from './providers/eudi.js';
import { atprotoProvider } from './providers/atproto.js';

// eudi stays registered but unpublished: no deployment sets its env config yet
// (readiness for later; the machinery is shared with atproto). A provider with
// no config resolves to null here and every surface of it 404s.
function configured(): IdentityProvider[] {
	return [emberProvider(), eudiProvider(), atprotoProvider()].filter(
		(p): p is IdentityProvider => p !== null
	);
}

export function getProviders(): IdentityProvider[] {
	return configured();
}

export function getProvider(id: string): IdentityProvider | null {
	return configured().find((p) => p.id === id) ?? null;
}
