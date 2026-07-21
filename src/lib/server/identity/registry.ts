/**
 * The configured identity providers for this deployment.
 *
 * This is the composition root: the one place a substrate package is named, the
 * same way `hooks.server.ts` names `createSupabaseAdapter` once. Adding OIDC or
 * another substrate is a new `providers/<name>.ts` and one line here. dyad core
 * resolves providers only through the generic `IdentityProvider` interface.
 *
 * Provider modules are imported LAZILY, gated on their env config. This is
 * load-bearing, not style: providers/atproto.ts statically initializes
 * `@atproto-labs/fetch-node` (three undici copies), whose CJS
 * `require('node:assert')` the CF Pages Functions bundler compiles to a
 * runtime throw. A static import here put that init on every request's
 * identity import and 500'd the first request of every fresh production
 * isolate — on a deployment with no ATProto config at all. An unconfigured
 * provider's module must never load. (Third incident in this dependency
 * chain, after PR #133's bundler shims and PR #136's WeakRef polyfill.)
 */

import type { IdentityProvider } from './types.js';
import { readConfig as readAtprotoConfig } from './providers/atproto-config.js';

// Per-isolate cache. Env config is fixed for an isolate's lifetime, so the
// import + construction runs once; every later request awaits the same promise.
let providersPromise: Promise<IdentityProvider[]> | null = null;

async function loadConfigured(): Promise<IdentityProvider[]> {
	const providers: IdentityProvider[] = [];
	if (readAtprotoConfig() !== null) {
		const { atprotoProvider } = await import('./providers/atproto.js');
		const provider = atprotoProvider();
		if (provider) providers.push(provider);
	}
	return providers;
}

export function getProviders(): Promise<IdentityProvider[]> {
	providersPromise ??= loadConfigured();
	return providersPromise;
}

export async function getProvider(id: string): Promise<IdentityProvider | null> {
	return (await getProviders()).find((p) => p.id === id) ?? null;
}
