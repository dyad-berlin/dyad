/**
 * The ATProto provider's env configuration, in a module of its own so the
 * registry can ask "is this provider configured?" WITHOUT importing the
 * provider module. That import is load-bearing to avoid: providers/atproto.ts
 * statically pulls `@prefig/upact-atproto` → `@atproto/oauth-client-node` →
 * `@atproto-labs/fetch-node`, which initializes three undici copies at module
 * init — and undici's CJS `require('node:assert')` is compiled to a runtime
 * throw by the CF Pages Functions bundler. Loading that chain on a deployment
 * that never configured ATProto 500s the first request of every fresh isolate
 * (the third incident in this chain, after PR #133's bundler shims and
 * PR #136's WeakRef polyfill). This module must therefore import nothing
 * heavier than the env.
 */

import { env } from '$env/dynamic/private';

export interface AtprotoEnvConfig {
	scope: string;
	baseUrl: string;
	sessionSecret: string;
}

/**
 * Reads the deployment's ATProto configuration, or null when the provider is
 * not configured (which unpublishes every atproto surface: the login page,
 * the authorize/callback routes, and the client metadata document).
 *
 *   ATPROTO_SCOPE_SLUG      dyad scope slug a session grants
 *   ATPROTO_BASE_URL        public base URL of this deployment. An
 *                           http://127.0.0.1:<port> value selects the OAuth
 *                           loopback client (dev only — the spec requires a
 *                           loopback IP literal, not `localhost`)
 *   ATPROTO_SESSION_SECRET  HS256 secret for dyad's own session cookie
 */
export function readConfig(): AtprotoEnvConfig | null {
	const scope = env.ATPROTO_SCOPE_SLUG;
	const baseUrl = env.ATPROTO_BASE_URL;
	const sessionSecret = env.ATPROTO_SESSION_SECRET;
	if (!scope || !baseUrl || !sessionSecret) return null;
	return { scope, baseUrl: baseUrl.replace(/\/$/, ''), sessionSecret };
}
