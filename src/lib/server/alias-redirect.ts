/**
 * Alias-host canonicalization: the response an alias host returns so links to
 * old URLs land on the canonical host with path and query intact.
 *
 * Extracted from hooks.server.ts so the two load-bearing properties — the
 * permanent status and the Stripe exemption — are unit-testable. Neither was
 * reachable by a test while the branch lived inline.
 */

/**
 * Stripe delivers webhooks to the exact URL configured in its dashboard. If
 * that URL is a stale alias host, redirecting the POST breaks EVERY delivery:
 * Stripe does not follow redirects, so it records the redirect as a failure and
 * no membership activates. The webhook authenticates by signature, not
 * hostname, so it must process on whatever host it arrives at.
 * (Payment incident 2026-07-27.)
 */
export const WEBHOOK_EXEMPT_FROM_REDIRECT = '/api/stripe/webhook';

/**
 * 301, not 302. dyad.social is the permanent apex, and only a permanent
 * redirect transfers dyad.berlin's accumulated ranking to it — a 302 tells
 * search engines the move is temporary and leaves ranking on the old host.
 *
 * This is the point of no cheap return: browsers cache 301s aggressively, so a
 * visitor who hits an alias host once will keep resolving to the apex from
 * local cache regardless of any later server change.
 */
export const ALIAS_REDIRECT_STATUS = 301;

/**
 * Returns the redirect response for an alias host, or null when the request
 * must be served on the host it arrived at.
 */
export function aliasRedirect(url: URL, target: string): Response | null {
	if (url.pathname === WEBHOOK_EXEMPT_FROM_REDIRECT) return null;
	return new Response(null, {
		status: ALIAS_REDIRECT_STATUS,
		headers: { Location: `https://${target}${url.pathname}${url.search}` }
	});
}
