import { env } from '$env/dynamic/public';
import type { LayoutLoad } from './$types';

// Base URL for bucket-hosted page imagery — same pattern as /why. Falls back
// to the current Supabase bucket URL; set PUBLIC_ASSET_BASE_URL to route
// through a sovereign host without a code change.
const ASSETS =
	env.PUBLIC_ASSET_BASE_URL ??
	'https://iwdjpuyuznzukhowxjhk.supabase.co/storage/v1/object/public/uploads';

const imageMap: Record<string, string> = {
	'/login': '/images/log-in.jpeg',
	'/join': '/images/log-in.jpeg',
	'/waitlist': `${ASSETS}/mycelium%20for%20waitlist.webp`
};

export const load: LayoutLoad = ({ url }) => {
	return {
		authImage: imageMap[url.pathname] ?? '/images/log-in.jpeg'
	};
};
