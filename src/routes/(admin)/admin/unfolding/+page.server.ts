import { fail, redirect } from '@sveltejs/kit';
import { getAuthorizedAdminOperator } from '$lib/server/admin-auth';
import { invalidateContentKeys } from '$lib/server/content-cache';
import {
	createEntry,
	createVoice,
	listAllEntries,
	listAllVoices,
	setEntryState,
	setVoiceState,
	updateVoice,
	type VoiceInput
} from '$lib/server/content-admin';
import type { Actions, PageServerLoad } from './$types';

/**
 * /admin/unfolding — the authoring surface for both content types (plan U7,
 * Branch B). Gated by the Cloudflare Access hook like the rest of the admin
 * plane; requests only reach here as a verified operator. Every mutation of
 * published content ends with explicit KV invalidation — without it,
 * last-known-good persists indefinitely (KTD4).
 */

export const load: PageServerLoad = async () => {
	const [entries, voices] = await Promise.all([listAllEntries(), listAllVoices()]);
	return { entries, voices };
};

async function invalidate(platform: App.Platform | undefined, slug?: string) {
	const kv = platform?.env?.CONTENT_KV;
	if (kv) await invalidateContentKeys(kv, slug);
}

function voiceInput(form: FormData): VoiceInput {
	return {
		name: String(form.get('name') ?? '').trim(),
		src: String(form.get('src') ?? '').trim(),
		poster: String(form.get('poster') ?? '').trim(),
		episode: String(form.get('episode') ?? '').trim(),
		position: Number(form.get('position') ?? NaN)
	};
}

export const actions: Actions = {
	createEntry: async ({ request }) => {
		const form = await request.formData();
		const slug = String(form.get('slug') ?? '').trim();
		const title = String(form.get('title') ?? '').trim();
		const operator = await getAuthorizedAdminOperator(request);
		const error = await createEntry({ slug, title }, operator?.email ?? null);
		if (error) return fail(400, { section: 'entries', error });
		redirect(303, `/admin/unfolding/${slug}`);
	},

	setEntryState: async ({ request, platform }) => {
		const form = await request.formData();
		const slug = String(form.get('slug') ?? '');
		const state = form.get('state') === 'published' ? 'published' : 'draft';
		const operator = await getAuthorizedAdminOperator(request);
		const error = await setEntryState(slug, state, operator?.email ?? null);
		if (error) return fail(400, { section: 'entries', error });
		await invalidate(platform, slug);
		return { section: 'entries', ok: true };
	},

	createVoice: async ({ request, platform }) => {
		const form = await request.formData();
		const operator = await getAuthorizedAdminOperator(request);
		const error = await createVoice(voiceInput(form), operator?.email ?? null);
		if (error) return fail(400, { section: 'voices', error });
		await invalidate(platform);
		return { section: 'voices', ok: true };
	},

	updateVoice: async ({ request, platform }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const operator = await getAuthorizedAdminOperator(request);
		const error = await updateVoice(id, voiceInput(form), operator?.email ?? null);
		if (error) return fail(400, { section: 'voices', error });
		await invalidate(platform);
		return { section: 'voices', ok: true };
	},

	setVoiceState: async ({ request, platform }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const stateRaw = form.get('state');
		const operator = await getAuthorizedAdminOperator(request);
		const error = await setVoiceState(
			id,
			{
				state: stateRaw === 'published' ? 'published' : stateRaw === 'draft' ? 'draft' : undefined,
				archived: form.get('archived') === 'true'
			},
			operator?.email ?? null
		);
		if (error) return fail(400, { section: 'voices', error });
		await invalidate(platform);
		return { section: 'voices', ok: true };
	}
};
