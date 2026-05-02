import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

/**
 * Admin authentication via Cloudflare Access.
 *
 * Production: Cloudflare Zero Trust gates `/admin/*` at the edge. Operators
 * authenticate via Cloudflare's identity layer (Google, GitHub, email OTP, …)
 * BEFORE the request reaches dyad. Cloudflare adds these headers to authenticated
 * requests:
 *   - Cf-Access-Authenticated-User-Email   (the operator's email)
 *   - Cf-Access-Jwt-Assertion              (signed JWT for verification)
 *
 * dyad has no admin login flow, no admin auth.users rows, no admin sessions.
 * Operator identity lives entirely in Cloudflare's identity layer.
 *
 * Local dev: Cloudflare Access doesn't run locally. Set ADMIN_DEV_BYPASS=1 in
 * .env.local to allow /admin/* through with a synthetic operator. Without the
 * bypass, /admin/* returns 401 locally — useful for testing the unauthenticated
 * path.
 *
 * To replace Cloudflare Access with another mechanism (Tailscale, custom
 * proxy, OIDC SSO, etc.): change only this file. Everything downstream is
 * unaffected.
 *
 * See docs/solutions/identity-decoupling-security-tradeoffs.md.
 */

export interface AdminOperator {
	email: string;
}

/**
 * Returns the authenticated admin operator for this request, or null if the
 * request is not authorized for the admin plane.
 */
export function getAuthorizedAdminOperator(request: Request): AdminOperator | null {
	const email = request.headers.get('cf-access-authenticated-user-email');
	if (email && email.length > 0) {
		return { email };
	}

	// Local-dev escape hatch. NEVER respect this in production builds —
	// the `dev` guard from $app/environment is true only in `vite dev`.
	if (dev && env.ADMIN_DEV_BYPASS === '1') {
		return { email: 'dev@localhost' };
	}

	return null;
}
