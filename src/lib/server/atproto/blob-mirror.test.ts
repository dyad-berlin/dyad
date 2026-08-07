import { describe, it, expect, vi } from 'vitest';
import { matchesMagicBytes, mirrorBlob, BlobRejectedError } from './blob-mirror';
import type { StorageService } from '$lib/services/storage';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP = new Uint8Array([
	...'RIFF'.split('').map((c) => c.charCodeAt(0)),
	0x24, 0x00, 0x00, 0x00,
	...'WEBP'.split('').map((c) => c.charCodeAt(0))
]);
const AVIF = new Uint8Array([
	0x00, 0x00, 0x00, 0x1c,
	...'ftypavif'.split('').map((c) => c.charCodeAt(0)),
	0x00, 0x00, 0x00, 0x00
]);
const MP4 = new Uint8Array([
	0x00, 0x00, 0x00, 0x18,
	...'ftypisom'.split('').map((c) => c.charCodeAt(0)),
	0x00, 0x00, 0x00, 0x00
]);
const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x00]);
const SVG_AS_TEXT = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

function makeStorage() {
	return {
		upload: vi.fn(async (_bucket: string, path: string, _file: File | Blob) => ({
			url: `https://x/${path}`,
			path
		})),
		publicUrl: vi.fn(() => 'https://x')
	} satisfies StorageService;
}

describe('matchesMagicBytes', () => {
	it('accepts each allowlisted type with its real signature', () => {
		expect(matchesMagicBytes('image/png', PNG)).toBe(true);
		expect(matchesMagicBytes('image/jpeg', JPEG)).toBe(true);
		expect(matchesMagicBytes('image/webp', WEBP)).toBe(true);
		expect(matchesMagicBytes('image/avif', AVIF)).toBe(true);
		expect(matchesMagicBytes('video/mp4', MP4)).toBe(true);
		expect(matchesMagicBytes('video/webm', WEBM)).toBe(true);
	});

	it('rejects content that does not match the claimed type', () => {
		expect(matchesMagicBytes('image/png', SVG_AS_TEXT)).toBe(false);
		expect(matchesMagicBytes('image/png', JPEG)).toBe(false);
		expect(matchesMagicBytes('image/webp', PNG)).toBe(false);
	});

	it('distinguishes an AVIF image from an MP4 video by ISO brand', () => {
		expect(matchesMagicBytes('video/mp4', AVIF)).toBe(false);
		expect(matchesMagicBytes('image/avif', MP4)).toBe(false);
	});

	it('rejects unknown claimed types outright', () => {
		expect(matchesMagicBytes('image/svg+xml', SVG_AS_TEXT)).toBe(false);
	});
});

describe('mirrorBlob', () => {
	it('mirrors an allowlisted blob with matching magic bytes', async () => {
		const storage = makeStorage();
		const result = await mirrorBlob({
			bytes: PNG,
			claimedType: 'image/png',
			storage,
			bucket: 'newsletter assets',
			path: 'spike/hero.png'
		});
		expect(result.path).toBe('spike/hero.png');
		expect(storage.upload).toHaveBeenCalledTimes(1);
		const uploaded = storage.upload.mock.calls[0][2] as Blob;
		expect(uploaded.type).toBe('image/png');
	});

	it('rejects a spoofed type before any Storage write — KTD5', async () => {
		const storage = makeStorage();
		// Claimed an allowlisted image type; the bytes are an SVG document.
		await expect(
			mirrorBlob({
				bytes: SVG_AS_TEXT,
				claimedType: 'image/png',
				storage,
				bucket: 'newsletter assets',
				path: 'spike/evil.png'
			})
		).rejects.toBeInstanceOf(BlobRejectedError);
		expect(storage.upload).not.toHaveBeenCalled();
	});

	it('rejects a type off the allowlist before any Storage write', async () => {
		const storage = makeStorage();
		await expect(
			mirrorBlob({
				bytes: SVG_AS_TEXT,
				claimedType: 'image/svg+xml',
				storage,
				bucket: 'newsletter assets',
				path: 'spike/vector.svg'
			})
		).rejects.toBeInstanceOf(BlobRejectedError);
		expect(storage.upload).not.toHaveBeenCalled();
	});
});
