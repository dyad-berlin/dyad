import type { LayoutServerLoad } from './$types';

/**
 * Admin plane layout — auth is enforced in src/hooks.server.ts before this
 * load runs. By the time we reach here, the request has passed Cloudflare
 * Access (or the local-dev bypass).
 *
 * The admin plane has no user context: no locals.user, no isAdmin, no profile.
 * Pages access the database via the service-role client (makeAdminClient).
 */
export const load: LayoutServerLoad = async () => {
	return {};
};
