import { env } from '$env/dynamic/public';

/** Public URL for an object in a public Supabase Storage bucket. */
export function storageUrl(bucket: string, path: string): string {
	const base = env.PUBLIC_SUPABASE_URL ?? '';
	const encodedBucket = encodeURIComponent(bucket);
	const encodedPath = path
		.split('/')
		.map(encodeURIComponent)
		.join('/');
	return `${base}/storage/v1/object/public/${encodedBucket}/${encodedPath}`;
}
