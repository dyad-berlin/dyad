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

function configured(): IdentityProvider[] {
	return [emberProvider()].filter((p): p is IdentityProvider => p !== null);
}

export function getProviders(): IdentityProvider[] {
	return configured();
}

export function getProvider(id: string): IdentityProvider | null {
	return configured().find((p) => p.id === id) ?? null;
}
