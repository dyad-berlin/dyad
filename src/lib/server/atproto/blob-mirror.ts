import type { StorageService } from '$lib/services/storage';

/**
 * Mirror-on-publish guard (plan KTD5): media entering dyad's own storage from
 * any external source is accepted only when its claimed MIME type is on the
 * allowlist AND the file's magic bytes agree. Upstream headers are not
 * trusted — an SVG or HTML document stored as an "image" would be a
 * same-origin stored-XSS vector, strictly worse than hot-linking.
 */

export const ALLOWED_MEDIA_TYPES = [
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/avif',
	'video/mp4',
	'video/webm'
] as const;

export type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

/** The image-only subset — what an admin image upload may claim. */
export const ALLOWED_IMAGE_TYPES = ALLOWED_MEDIA_TYPES.filter((t) => t.startsWith('image/'));

function ascii(bytes: Uint8Array, start: number, length: number): string {
	return String.fromCharCode(...bytes.slice(start, start + length));
}

/** ISO-BMFF brand at offset 8, present when 'ftyp' sits at offset 4. */
function isoBrand(bytes: Uint8Array): string | null {
	return bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp' ? ascii(bytes, 8, 4) : null;
}

const AVIF_BRANDS = new Set(['avif', 'avis']);

/** Does the file content actually match the claimed type? */
export function matchesMagicBytes(claimedType: string, bytes: Uint8Array): boolean {
	switch (claimedType) {
		case 'image/png':
			return (
				bytes.length >= 8 &&
				bytes[0] === 0x89 &&
				ascii(bytes, 1, 3) === 'PNG' &&
				bytes[4] === 0x0d &&
				bytes[5] === 0x0a &&
				bytes[6] === 0x1a &&
				bytes[7] === 0x0a
			);
		case 'image/jpeg':
			return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
		case 'image/webp':
			return bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP';
		case 'image/avif': {
			const brand = isoBrand(bytes);
			return brand !== null && AVIF_BRANDS.has(brand);
		}
		case 'video/mp4': {
			const brand = isoBrand(bytes);
			// 'ftyp' box present and the brand is not an AVIF image posing as video.
			return brand !== null && !AVIF_BRANDS.has(brand);
		}
		case 'video/webm':
			// EBML header (shared with Matroska — acceptable for this allowlist).
			return (
				bytes.length >= 4 &&
				bytes[0] === 0x1a &&
				bytes[1] === 0x45 &&
				bytes[2] === 0xdf &&
				bytes[3] === 0xa3
			);
		default:
			return false;
	}
}

export class BlobRejectedError extends Error {
	constructor(reason: string) {
		super(`blob rejected before storage write: ${reason}`);
		this.name = 'BlobRejectedError';
	}
}

/**
 * Verify and mirror one blob into dyad's own storage. Throws BlobRejectedError
 * before any Storage write when the claimed type is off the allowlist or the
 * magic bytes disagree with it.
 */
export async function mirrorBlob(params: {
	bytes: Uint8Array;
	claimedType: string;
	storage: StorageService;
	bucket: string;
	path: string;
}): Promise<{ url: string; path: string }> {
	const { bytes, claimedType, storage, bucket, path } = params;

	if (!(ALLOWED_MEDIA_TYPES as readonly string[]).includes(claimedType)) {
		throw new BlobRejectedError(`type ${claimedType} is not on the allowlist`);
	}
	if (!matchesMagicBytes(claimedType, bytes)) {
		throw new BlobRejectedError(`content does not match claimed type ${claimedType}`);
	}

	// Uint8Array#slice returns a plain ArrayBuffer-backed copy, so the Blob
	// constructor accepts it in both workerd and node.
	const blob = new Blob([bytes.slice()], { type: claimedType });
	return storage.upload(bucket, path, blob, { upsert: false });
}
