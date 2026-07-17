import type { LayoutLoad } from './$types';
import { storageUrl } from '$lib/utils/storage-url';

const imageMap: Record<string, string> = {
	'/login': '/images/log-in.jpeg',
	'/join': '/images/log-in.jpeg',
	// Same cover as the newsletter's "Become a co-designer" invite — the
	// image a reader just clicked through from stays with them here.
	'/waitlist': storageUrl('newsletter assets', 'cover, become a comember.webp')
};

export const load: LayoutLoad = ({ url }) => {
	return {
		authImage: imageMap[url.pathname] ?? '/images/log-in.jpeg'
	};
};
