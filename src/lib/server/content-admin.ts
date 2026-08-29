/**
 * Write side of the content source (plan U7, Branch B): CRUD over
 * unfolding_entries and wiggling_voices through the service-role client,
 * used only by /admin/unfolding behind Cloudflare Access. The write path is
 * the plan's: validate → (media already mirrored via the guarded upload) →
 * write the row → explicit KV invalidation by the caller.
 *
 * Draft saves validate bounds and structure only, so an incomplete draft can
 * be saved. Publish re-validates the full row against the port's shape guard
 * — what cannot render never reaches `state = 'published'`.
 */
import { makeAdminClient } from '$lib/server/supabase-admin';
import { validateEssayBody } from '$lib/server/validate-essay-body';
import { isValidSlug, isValidUnfoldingEntry } from '$lib/services/content';
import { rowToEntry, type UnfoldingRow } from '$lib/services/content-supabase';

const MAX_FIELD = 1000; // mirrors the port guard's field bound

export interface EntryListItem {
	slug: string;
	title: string;
	state: string;
	date: string;
	updated_at: string;
	updated_by: string | null;
}

export interface AdminEntryRow extends UnfoldingRow {
	state: string;
	updated_at: string;
	updated_by: string | null;
}

export interface AdminVoiceRow {
	id: string;
	name: string;
	src: string;
	poster: string;
	episode: string;
	state: string;
	position: number;
	archived_at: string | null;
}

export interface EntryInput {
	slug: string;
	kicker: string;
	title: string;
	dek: string;
	quote: string;
	quoteAttr: string;
	date: string;
	body: unknown | null;
	heroImage: string;
	heroCredit: string;
	heroCreditUrl: string;
}

/** Bounds-and-structure validation for a draft save. Returns null when ok. */
export function validateEntryInput(input: EntryInput): string | null {
	if (!isValidSlug(input.slug)) return 'Slug must be lowercase words joined by hyphens.';
	if (input.title.length === 0) return 'A title is required.';
	for (const [name, value] of Object.entries({
		kicker: input.kicker,
		title: input.title,
		dek: input.dek,
		quote: input.quote,
		quoteAttr: input.quoteAttr,
		heroImage: input.heroImage,
		heroCredit: input.heroCredit,
		heroCreditUrl: input.heroCreditUrl
	})) {
		if (value.length > MAX_FIELD) return `${name} is too long.`;
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Date must be YYYY-MM-DD.';
	if (input.body !== null) {
		const bodyError = validateEssayBody(input.body);
		if (bodyError) return bodyError;
	}
	return null;
}

function inputToRow(input: EntryInput, operator: string | null) {
	return {
		slug: input.slug,
		kicker: input.kicker,
		title: input.title,
		dek: input.dek || null,
		quote: input.quote,
		quote_attr: input.quoteAttr || null,
		date: input.date,
		body: input.body,
		hero_image: input.heroImage || null,
		hero_credit: input.heroCredit || null,
		hero_credit_url: input.heroCreditUrl || null,
		updated_at: new Date().toISOString(),
		updated_by: operator
	};
}

const ADMIN_ENTRY_COLUMNS =
	'slug, kicker, title, dek, quote, quote_attr, date, paragraphs, body, hero_image, hero_credit, hero_credit_url, state, updated_at, updated_by';

export async function listAllEntries(): Promise<EntryListItem[]> {
	const { data, error } = await makeAdminClient()
		.from('unfolding_entries')
		.select('slug, title, state, date, updated_at, updated_by')
		.order('date', { ascending: false });
	if (error) throw new Error(`unfolding_entries admin list failed: ${error.message}`);
	return data ?? [];
}

export async function getEntryRow(slug: string): Promise<AdminEntryRow | null> {
	if (!isValidSlug(slug)) return null;
	const { data, error } = await makeAdminClient()
		.from('unfolding_entries')
		.select(ADMIN_ENTRY_COLUMNS)
		.eq('slug', slug)
		.maybeSingle();
	if (error) throw new Error(`unfolding_entries admin read failed: ${error.message}`);
	return data ?? null;
}

export async function createEntry(
	input: Pick<EntryInput, 'slug' | 'title'>,
	operator: string | null
): Promise<string | null> {
	if (!isValidSlug(input.slug)) return 'Slug must be lowercase words joined by hyphens.';
	if (input.title.length === 0 || input.title.length > MAX_FIELD) return 'A title is required.';
	const { error } = await makeAdminClient().from('unfolding_entries').insert({
		slug: input.slug,
		title: input.title,
		kicker: '',
		quote: '',
		date: new Date().toISOString().slice(0, 10),
		state: 'draft',
		updated_by: operator
	});
	if (error) {
		console.error('[content-admin] create failed:', error);
		return 'Could not create the essay — is the slug already taken?';
	}
	return null;
}

export async function saveEntry(input: EntryInput, operator: string | null): Promise<string | null> {
	const invalid = validateEntryInput(input);
	if (invalid) return invalid;
	const { error, data } = await makeAdminClient()
		.from('unfolding_entries')
		.update(inputToRow(input, operator))
		.eq('slug', input.slug)
		.select('slug');
	if (error) {
		console.error('[content-admin] save failed:', error);
		return 'Could not save the essay.';
	}
	if (!data || data.length === 0) return 'This essay no longer exists.';
	return null;
}

/**
 * Publish gate: the stored row must pass the port's full shape guard —
 * publishing is the promise that the row renders.
 */
export async function setEntryState(
	slug: string,
	state: 'draft' | 'published',
	operator: string | null
): Promise<string | null> {
	if (!isValidSlug(slug)) return 'Unknown essay.';
	if (state === 'published') {
		const row = await getEntryRow(slug);
		if (!row) return 'Unknown essay.';
		if (rowToEntry(row) === null) {
			return 'This essay is not complete enough to publish — it must render as a valid entry.';
		}
	}
	const { error, data } = await makeAdminClient()
		.from('unfolding_entries')
		.update({ state, updated_at: new Date().toISOString(), updated_by: operator })
		.eq('slug', slug)
		.select('slug');
	if (error) {
		console.error('[content-admin] state change failed:', error);
		return 'Could not change the publish state.';
	}
	if (!data || data.length === 0) return 'Unknown essay.';
	return null;
}

export async function setEntryHeroImage(
	slug: string,
	path: string,
	operator: string | null
): Promise<string | null> {
	const { error, data } = await makeAdminClient()
		.from('unfolding_entries')
		.update({ hero_image: path, updated_at: new Date().toISOString(), updated_by: operator })
		.eq('slug', slug)
		.select('slug');
	if (error) {
		console.error('[content-admin] hero update failed:', error);
		return 'Could not attach the image.';
	}
	if (!data || data.length === 0) return 'Unknown essay.';
	return null;
}

// --- Wiggling voices ---

export interface VoiceInput {
	name: string;
	src: string;
	poster: string;
	episode: string;
	position: number;
}

export function validateVoiceInput(input: VoiceInput): string | null {
	for (const [name, value] of Object.entries({
		name: input.name,
		src: input.src,
		poster: input.poster,
		episode: input.episode
	})) {
		if (value.length === 0) return `${name} is required.`;
		if (value.length > MAX_FIELD) return `${name} is too long.`;
	}
	// src and poster are bucket paths, never URLs — R4 stays structural.
	if (/^[a-z]+:\/\//i.test(input.src)) return 'The reel is a path within the videos bucket, not a URL.';
	if (/^[a-z]+:\/\//i.test(input.poster)) {
		return 'The poster is a path within the assets bucket, not a URL.';
	}
	if (!/^https:\/\//.test(input.episode)) return 'The episode link must be an https URL.';
	if (!Number.isInteger(input.position)) return 'Position must be a whole number.';
	return null;
}

export async function listAllVoices(): Promise<AdminVoiceRow[]> {
	const { data, error } = await makeAdminClient()
		.from('wiggling_voices')
		.select('id, name, src, poster, episode, state, position, archived_at')
		.order('position', { ascending: true });
	if (error) throw new Error(`wiggling_voices admin list failed: ${error.message}`);
	return data ?? [];
}

export async function createVoice(input: VoiceInput, operator: string | null): Promise<string | null> {
	const invalid = validateVoiceInput(input);
	if (invalid) return invalid;
	const { error } = await makeAdminClient()
		.from('wiggling_voices')
		.insert({ ...input, state: 'draft', updated_by: operator });
	if (error) {
		console.error('[content-admin] voice create failed:', error);
		return 'Could not add the voice.';
	}
	return null;
}

export async function updateVoice(
	id: string,
	input: VoiceInput,
	operator: string | null
): Promise<string | null> {
	const invalid = validateVoiceInput(input);
	if (invalid) return invalid;
	const { error, data } = await makeAdminClient()
		.from('wiggling_voices')
		.update({ ...input, updated_at: new Date().toISOString(), updated_by: operator })
		.eq('id', id)
		.select('id');
	if (error) {
		console.error('[content-admin] voice update failed:', error);
		return 'Could not save the voice.';
	}
	if (!data || data.length === 0) return 'Unknown voice.';
	return null;
}

export async function setVoiceState(
	id: string,
	changes: { state?: 'draft' | 'published'; archived: boolean },
	operator: string | null
): Promise<string | null> {
	const update: Record<string, unknown> = {
		archived_at: changes.archived ? new Date().toISOString() : null,
		updated_at: new Date().toISOString(),
		updated_by: operator
	};
	if (changes.state) update.state = changes.state;
	const { error, data } = await makeAdminClient()
		.from('wiggling_voices')
		.update(update)
		.eq('id', id)
		.select('id');
	if (error) {
		console.error('[content-admin] voice state change failed:', error);
		return 'Could not change the voice state.';
	}
	if (!data || data.length === 0) return 'Unknown voice.';
	return null;
}

// Publish never proceeds silently without a validated row; used by the edit
// page to tell the operator what still blocks publishing.
export function publishBlockers(row: AdminEntryRow): string[] {
	const blockers: string[] = [];
	const entry = rowToEntry(row);
	if (entry === null) {
		if (!row.kicker) blockers.push('kicker is empty');
		if (!row.quote) blockers.push('quote is empty');
		const hasParagraphs = Array.isArray(row.paragraphs) && row.paragraphs.length > 0;
		if (!hasParagraphs && !row.body) blockers.push('the essay has no body yet');
		if (row.body !== null && row.body !== undefined) {
			const bodyError = validateEssayBody(row.body);
			if (bodyError) blockers.push(bodyError);
		}
		if (blockers.length === 0) blockers.push('the entry does not pass the shape guard');
	}
	return blockers;
}

// Re-exported so route code needs one import; the guard stays port-owned.
export { isValidUnfoldingEntry };
