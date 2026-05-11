import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { nanoid } from 'nanoid';
import { requireAuth } from '$lib/server/auth.js';
import { SupabaseStorageService } from '$lib/services/storage.js';
import { handleServiceError } from '$lib/server/handle-service-error.js';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Magic-byte signatures for the allowed image formats. The MIME type the
// client asserts in `file.type` is unverified by the browser and can be
// anything; we must check the file's actual bytes before accepting it.
async function detectImageType(file: File): Promise<string | null> {
	const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
	if (head.length < 12) return null;
	// JPEG: FF D8 FF
	if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if (
		head[0] === 0x89 &&
		head[1] === 0x50 &&
		head[2] === 0x4e &&
		head[3] === 0x47 &&
		head[4] === 0x0d &&
		head[5] === 0x0a &&
		head[6] === 0x1a &&
		head[7] === 0x0a
	)
		return 'image/png';
	// WebP: 'RIFF'....'WEBP'
	if (
		head[0] === 0x52 &&
		head[1] === 0x49 &&
		head[2] === 0x46 &&
		head[3] === 0x46 &&
		head[8] === 0x57 &&
		head[9] === 0x45 &&
		head[10] === 0x42 &&
		head[11] === 0x50
	)
		return 'image/webp';
	// GIF: 'GIF87a' or 'GIF89a'
	if (
		head[0] === 0x47 &&
		head[1] === 0x49 &&
		head[2] === 0x46 &&
		head[3] === 0x38 &&
		(head[4] === 0x37 || head[4] === 0x39) &&
		head[5] === 0x61
	)
		return 'image/gif';
	return null;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireAuth(locals.user);

	const formData = await request.formData();
	const file = formData.get('file');

	if (!(file instanceof File)) {
		return json({ error: 'No file provided' }, { status: 400 });
	}

	if (!ALLOWED_TYPES.includes(file.type)) {
		return json({ error: 'Invalid file type' }, { status: 400 });
	}

	if (file.size > MAX_SIZE) {
		return json({ error: 'File too large (max 5MB)' }, { status: 400 });
	}

	const detected = await detectImageType(file);
	if (!detected || detected !== file.type) {
		return json({ error: 'File contents do not match the declared image type' }, { status: 400 });
	}

	const ext = detected.split('/')[1];
	const path = `${user.id}/${nanoid()}.${ext}`;

	const storage = new SupabaseStorageService(locals.supabase);
	try {
		const { url } = await storage.upload('uploads', path, file);
		return json({ url });
	} catch (err) {
		return handleServiceError(err, '[upload]');
	}
};
