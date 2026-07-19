import { env } from '$env/dynamic/public';

// Public assets (newsletter images, cover art) live in the production storage
// bucket regardless of which Supabase the app talks to. Resolve against the prod
// host by default so they render in every environment — including local dev,
// where PUBLIC_SUPABASE_URL points at the local stack, which has no such buckets.
// PUBLIC_STORAGE_BASE_URL overrides the host (e.g. a sovereign asset host).
const STORAGE_HOST = env.PUBLIC_STORAGE_BASE_URL ?? 'https://iwdjpuyuznzukhowxjhk.supabase.co';

/** Public URL for an object in a public Supabase Storage bucket. */
export function storageUrl(bucket: string, path: string): string {
	const base = STORAGE_HOST.replace(/\/+$/, '');
	const encodedBucket = encodeURIComponent(bucket);
	const encodedPath = path
		.split('/')
		.map(encodeURIComponent)
		.join('/');
	return `${base}/storage/v1/object/public/${encodedBucket}/${encodedPath}`;
}
