import { env } from '$env/dynamic/public';
import type { LayoutLoad } from './$types';

// Base URL for bucket-hosted page imagery — same pattern as /why. Falls back
// to the current Supabase bucket URL; set PUBLIC_ASSET_BASE_URL to route
// through a sovereign host without a code change.
const ASSETS =
	env.PUBLIC_ASSET_BASE_URL ??
	'https://iwdjpuyuznzukhowxjhk.supabase.co/storage/v1/object/public/uploads';

const imageMap: Record<string, { src: string; credit?: string }> = {
	'/login': { src: '/images/log-in.jpeg' },
	'/join': { src: '/images/log-in.jpeg' },
	'/waitlist': {
		src: `${ASSETS}/mycelium%20for%20waitlist.webp`,
		credit: 'Grafted (2022), painting by artist Klari Reis'
	}
};

export const load: LayoutLoad = ({ url }) => {
	const image = imageMap[url.pathname] ?? { src: '/images/log-in.jpeg' };
	return {
		authImage: image.src,
		authImageCredit: image.credit ?? null
	};
};
