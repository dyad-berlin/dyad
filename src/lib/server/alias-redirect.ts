/**
 * Alias-host canonicalization: the response an alias host returns so links to
 * old URLs land on the canonical host with path and query intact.
 *
 * Extracted from hooks.server.ts so the load-bearing properties — the permanent
 * status and the machine-traffic exemptions — are unit-testable. None of it was
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
 *
 * Two exemptions, both about machine traffic rather than browsers:
 *
 * 1. Any non-GET/HEAD request. A redirect on a POST is never useful — 301 and
 *    302 both downgrade the method to GET and drop the body, so the caller's
 *    payload is lost either way. Redirecting is strictly worse than serving.
 * 2. Anything under `/api/`. These authenticate by signature or token, never by
 *    hostname, so the host they arrive on does not matter. The Stripe webhook
 *    was the known case; `/api/webhooks/resend-sync` is configured at an alias
 *    host in its own README and had no exemption, which is what a
 *    path-by-path list costs. Covering the surface is what makes the next one
 *    safe without anyone remembering.
 */
export function aliasRedirect(url: URL, target: string, method = 'GET'): Response | null {
	const isRead = method === 'GET' || method === 'HEAD';
	const isApi = url.pathname === '/api' || url.pathname.startsWith('/api/');
	if (!isRead || isApi) return null;

	return new Response(null, {
		status: ALIAS_REDIRECT_STATUS,
		headers: { Location: `https://${target}${url.pathname}${url.search}` }
	});
}
