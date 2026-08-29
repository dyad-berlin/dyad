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
import { isValidSlug, MAX_FIELD_LENGTH } from '$lib/services/content';
import { rowToEntry, type UnfoldingRow } from '$lib/services/content-supabase';

export type ContentState = 'draft' | 'published';

/**
 * Shared shape of every row mutation here: update, log the Supabase error
 * server-side, return a generic message; a matched-nothing update is its own
 * error rather than a silent success.
 */
async function runRowMutation(
	table: string,
	matchColumn: string,
	matchValue: string,
	payload: Record<string, unknown>,
	messages: { failure: string; notFound: string },
	// Optimistic-concurrency token: when given, the update matches only the
	// row version the caller saw, so a stale form cannot overwrite a newer
	// edit (the /admin/copy expectedUpdatedAt pattern).
	expectedUpdatedAt?: string
): Promise<string | null> {
	let query = makeAdminClient().from(table).update(payload).eq(matchColumn, matchValue);
	if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt);
	const { error, data } = await query.select(matchColumn);
	if (error) {
		console.error(`[content-admin] ${table} update failed:`, error);
		return messages.failure;
	}
	if (!data || data.length === 0) return messages.notFound;
	return null;
}

export interface EntryListItem {
	slug: string;
	title: string;
	state: ContentState;
	date: string;
	updated_at: string;
	updated_by: string | null;
}

export interface AdminEntryRow extends UnfoldingRow {
	state: ContentState;
	updated_at: string;
	updated_by: string | null;
}

export interface AdminVoiceRow {
	id: string;
	name: string;
	src: string;
	poster: string;
	episode: string;
	state: ContentState;
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
		if (value.length > MAX_FIELD_LENGTH) return `${name} is too long.`;
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Date must be YYYY-MM-DD.';
	// Rendered as an <a href> on the public page — same rule as episode links.
	if (input.heroCreditUrl && !/^https:\/\//.test(input.heroCreditUrl)) {
		return 'The credit link must be an https URL.';
	}
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
	if (input.title.length === 0 || input.title.length > MAX_FIELD_LENGTH)
		return input.title.length === 0 ? 'A title is required.' : 'title is too long.';
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

export async function saveEntry(
	input: EntryInput,
	operator: string | null,
	expectedUpdatedAt?: string
): Promise<string | null> {
	const invalid = validateEntryInput(input);
	if (invalid) return invalid;
	// A published row must stay renderable: a save may not degrade it below
	// the publish gate. Drafts stay loose — that is the deliberate split.
	const current = await getEntryRow(input.slug);
	if (!current) return 'This essay no longer exists.';
	if (current.state === 'published') {
		const candidate: AdminEntryRow = { ...current, ...inputToRow(input, operator) };
		const blockers = publishBlockers(candidate);
		if (blockers.length > 0) {
			return `This essay is live — the save would break it (${blockers.join('; ')}). Unpublish first or fix the fields.`;
		}
	}
	return runRowMutation(
		'unfolding_entries',
		'slug',
		input.slug,
		inputToRow(input, operator),
		{
			failure: 'Could not save the essay.',
			notFound: 'This essay changed since you opened it — reload and re-apply your edit.'
		},
		expectedUpdatedAt
	);
}

/**
 * Publish gate: the stored row must pass the port's full shape guard —
 * publishing is the promise that the row renders.
 */
export async function setEntryState(
	slug: string,
	state: ContentState,
	operator: string | null
): Promise<string | null> {
	if (!isValidSlug(slug)) return 'Unknown essay.';
	if (state === 'published') {
		const row = await getEntryRow(slug);
		if (!row) return 'Unknown essay.';
		const blockers = publishBlockers(row);
		if (blockers.length > 0) {
			return `Not publishable yet: ${blockers.join('; ')}.`;
		}
	}
	return runRowMutation(
		'unfolding_entries',
		'slug',
		slug,
		{ state, updated_at: new Date().toISOString(), updated_by: operator },
		{ failure: 'Could not change the publish state.', notFound: 'Unknown essay.' }
	);
}

export async function setEntryHeroImage(
	slug: string,
	path: string,
	operator: string | null
): Promise<string | null> {
	return runRowMutation(
		'unfolding_entries',
		'slug',
		slug,
		{ hero_image: path, updated_at: new Date().toISOString(), updated_by: operator },
		{ failure: 'Could not attach the image.', notFound: 'Unknown essay.' }
	);
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
		if (value.length > MAX_FIELD_LENGTH) return `${name} is too long.`;
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
	return runRowMutation(
		'wiggling_voices',
		'id',
		id,
		{ ...input, updated_at: new Date().toISOString(), updated_by: operator },
		{ failure: 'Could not save the voice.', notFound: 'Unknown voice.' }
	);
}

export async function setVoiceState(
	id: string,
	changes: { state?: ContentState; archived: boolean },
	operator: string | null
): Promise<string | null> {
	const update: Record<string, unknown> = {
		archived_at: changes.archived ? new Date().toISOString() : null,
		updated_at: new Date().toISOString(),
		updated_by: operator
	};
	if (changes.state) update.state = changes.state;
	return runRowMutation('wiggling_voices', 'id', id, update, {
		failure: 'Could not change the voice state.',
		notFound: 'Unknown voice.'
	});
}

/**
 * The publish gate, and the edit page's explanation of it. Checks run
 * unconditionally — the shape guard alone accepts an empty quote (bounded
 * string), but the public page renders the quote as the lede blockquote, so
 * publishing one would render a dangling empty quotation. kicker is not
 * required: no page renders it today.
 */
export function publishBlockers(row: AdminEntryRow): string[] {
	const blockers: string[] = [];
	if (!row.quote) blockers.push('quote is empty');
	const hasParagraphs = Array.isArray(row.paragraphs) && row.paragraphs.length > 0;
	if (!hasParagraphs && !row.body) blockers.push('the essay has no body yet');
	if (row.body !== null && row.body !== undefined) {
		const bodyError = validateEssayBody(row.body);
		if (bodyError) blockers.push(bodyError);
	}
	if (blockers.length === 0 && rowToEntry(row) === null) {
		blockers.push('the entry does not pass the shape guard');
	}
	return blockers;
}
