import { describe, it, expect, vi, beforeEach } from 'vitest';

// makeAdminClient is module-mocked: each test wires the minimal PostgREST
// chain the function under test actually calls.
vi.mock('$lib/server/supabase-admin', () => ({ makeAdminClient: vi.fn() }));

import { makeAdminClient } from '$lib/server/supabase-admin';
import {
	createEntry,
	publishBlockers,
	saveEntry,
	setEntryState,
	validateEntryInput,
	validateVoiceInput,
	type AdminEntryRow,
	type EntryInput,
	type VoiceInput
} from './content-admin';

const mockedMakeAdminClient = vi.mocked(makeAdminClient);

function entryInput(partial: Partial<EntryInput> = {}): EntryInput {
	return {
		slug: 'a-valid-slug',
		kicker: 'Kicker',
		title: 'A title',
		dek: '',
		quote: 'A quote.',
		quoteAttr: '',
		date: '2026-08-29',
		body: null,
		heroImage: '',
		heroCredit: '',
		heroCreditUrl: '',
		...partial
	};
}

function adminRow(partial: Partial<AdminEntryRow> = {}): AdminEntryRow {
	return {
		slug: 'a-valid-slug',
		kicker: 'Kicker',
		title: 'A title',
		dek: null,
		quote: 'A quote.',
		quote_attr: null,
		date: '2026-08-29',
		paragraphs: ['One paragraph.'],
		body: null,
		hero_image: null,
		hero_credit: null,
		hero_credit_url: null,
		state: 'draft',
		updated_at: '2026-08-29T12:00:00Z',
		updated_by: null,
		...partial
	};
}

const VALID_BODY = {
	type: 'doc',
	content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body.' }] }]
};

/**
 * A stub PostgREST update chain: .from().update().eq()...select() resolving
 * to the given result; records the eq calls so concurrency matching is
 * assertable. `maybeSingleData` backs getEntryRow reads in the same test.
 */
function stubClient(opts: {
	updateResult?: { data: unknown[] | null; error: { message: string } | null };
	maybeSingleData?: unknown;
	insertError?: { message: string } | null;
}) {
	const eqCalls: [string, unknown][] = [];
	const chain = {
		update: vi.fn(() => chain),
		insert: vi.fn(async () => ({ error: opts.insertError ?? null })),
		select: vi.fn((_cols?: string) => {
			// select() after update resolves the update; select().eq()...maybeSingle() is a read
			const p = Promise.resolve(opts.updateResult ?? { data: [{}], error: null });
			return Object.assign(p, {
				eq: (col: string, v: unknown) => {
					eqCalls.push([col, v]);
					return {
						eq: (c2: string, v2: unknown) => {
							eqCalls.push([c2, v2]);
							return { maybeSingle: async () => ({ data: opts.maybeSingleData ?? null, error: null }) };
						},
						maybeSingle: async () => ({ data: opts.maybeSingleData ?? null, error: null })
					};
				}
			});
		}),
		eq: vi.fn((col: string, v: unknown) => {
			eqCalls.push([col, v]);
			return chain;
		})
	};
	const client = { from: vi.fn(() => chain) };
	mockedMakeAdminClient.mockReturnValue(client as never);
	return { client, chain, eqCalls };
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('validateEntryInput', () => {
	it('accepts a complete draft', () => {
		expect(validateEntryInput(entryInput())).toBeNull();
	});

	it('rejects an invalid slug', () => {
		expect(validateEntryInput(entryInput({ slug: 'Not Valid' }))).toMatch(/Slug/);
	});

	it('rejects an empty title', () => {
		expect(validateEntryInput(entryInput({ title: '' }))).toMatch(/title/i);
	});

	it('rejects an over-length field, naming it', () => {
		expect(validateEntryInput(entryInput({ dek: 'x'.repeat(1001) }))).toBe('dek is too long.');
	});

	it('rejects a malformed date', () => {
		expect(validateEntryInput(entryInput({ date: 'tomorrow' }))).toMatch(/Date/);
	});

	it('rejects a non-https credit link — it renders as a public href', () => {
		expect(validateEntryInput(entryInput({ heroCreditUrl: 'javascript:alert(1)' }))).toMatch(
			/https/
		);
		expect(validateEntryInput(entryInput({ heroCreditUrl: 'https://example.org' }))).toBeNull();
	});

	it('rejects a body carrying inline media', () => {
		const body = {
			type: 'doc',
			content: [{ type: 'image', attrs: { src: 'https://example.org/x.png' } }]
		};
		expect(validateEntryInput(entryInput({ body }))).toMatch(/inline media/);
	});

	it('rejects a text-empty body', () => {
		const body = { type: 'doc', content: [{ type: 'paragraph' }] };
		expect(validateEntryInput(entryInput({ body }))).toBe('The essay body is empty.');
	});

	it('allows an incomplete draft: empty quote passes draft validation', () => {
		expect(validateEntryInput(entryInput({ quote: '' }))).toBeNull();
	});
});

describe('validateVoiceInput', () => {
	const voice = (p: Partial<VoiceInput> = {}): VoiceInput => ({
		name: 'A Voice',
		src: 'voices/a.mp4',
		poster: 'voices/a.webp',
		episode: 'https://example.org/watch',
		position: 1,
		...p
	});

	it('accepts a valid voice', () => {
		expect(validateVoiceInput(voice())).toBeNull();
	});

	it('rejects a URL where a bucket path is expected — R4 stays structural', () => {
		expect(validateVoiceInput(voice({ src: 'https://cdn.example.org/a.mp4' }))).toMatch(/path/);
		expect(validateVoiceInput(voice({ poster: 'http://x/a.webp' }))).toMatch(/path/);
	});

	it('rejects a non-https episode link', () => {
		expect(validateVoiceInput(voice({ episode: 'javascript:alert(1)' }))).toMatch(/https/);
	});

	it('rejects a non-integer position (blank form fields arrive as NaN)', () => {
		expect(validateVoiceInput(voice({ position: NaN }))).toMatch(/Position/);
	});
});

describe('publishBlockers — the publish gate', () => {
	it('passes a complete paragraphs essay', () => {
		expect(publishBlockers(adminRow())).toEqual([]);
	});

	it('blocks an empty quote — the public page renders it as the lede', () => {
		expect(publishBlockers(adminRow({ quote: '' }))).toContain('quote is empty');
	});

	it('blocks an essay with no body and no paragraphs', () => {
		expect(publishBlockers(adminRow({ paragraphs: null }))).toContain(
			'the essay has no body yet'
		);
	});

	it('blocks a text-empty body', () => {
		const row = adminRow({
			paragraphs: null,
			body: { type: 'doc', content: [{ type: 'paragraph' }] }
		});
		expect(publishBlockers(row).join(' ')).toMatch(/empty/);
	});

	it('passes a body essay with no paragraphs', () => {
		expect(publishBlockers(adminRow({ paragraphs: null, body: VALID_BODY }))).toEqual([]);
	});
});

describe('setEntryState publish gate', () => {
	it('refuses to publish a row with blockers', async () => {
		stubClient({ maybeSingleData: adminRow({ quote: '' }) });
		const result = await setEntryState('a-valid-slug', 'published', 'op@example.org');
		expect(result).toMatch(/Not publishable yet/);
	});

	it('publishes a valid row', async () => {
		stubClient({ maybeSingleData: adminRow(), updateResult: { data: [{}], error: null } });
		expect(await setEntryState('a-valid-slug', 'published', 'op@example.org')).toBeNull();
	});

	it('unpublish needs no gate', async () => {
		stubClient({ updateResult: { data: [{}], error: null } });
		expect(await setEntryState('a-valid-slug', 'draft', 'op@example.org')).toBeNull();
	});
});

describe('saveEntry', () => {
	it('refuses a save that would break a live essay', async () => {
		stubClient({ maybeSingleData: adminRow({ state: 'published' }) });
		const result = await saveEntry(entryInput({ quote: '' }), 'op@example.org');
		expect(result).toMatch(/live/);
	});

	it('matches the optimistic-concurrency token so a stale tab cannot overwrite', async () => {
		const { eqCalls } = stubClient({
			maybeSingleData: adminRow(),
			updateResult: { data: [], error: null } // token mismatch: nothing matched
		});
		const result = await saveEntry(entryInput(), 'op@example.org', '2026-08-29T11:00:00Z');
		expect(result).toMatch(/changed since you opened it/);
		expect(eqCalls).toContainEqual(['updated_at', '2026-08-29T11:00:00Z']);
	});

	it('returns a generic message on a DB error, never the Supabase detail', async () => {
		stubClient({
			maybeSingleData: adminRow(),
			updateResult: { data: null, error: { message: 'relation "secret" violates constraint' } }
		});
		const result = await saveEntry(entryInput(), 'op@example.org');
		expect(result).toBe('Could not save the essay.');
	});
});

describe('createEntry', () => {
	it('rejects a bad slug before any DB call', async () => {
		const result = await createEntry({ slug: 'NOT VALID', title: 'x' }, null);
		expect(result).toMatch(/Slug/);
		expect(mockedMakeAdminClient).not.toHaveBeenCalled();
	});

	it('maps an insert failure to the taken-slug message', async () => {
		stubClient({ insertError: { message: 'duplicate key' } });
		const result = await createEntry({ slug: 'taken-slug', title: 'x' }, null);
		expect(result).toMatch(/already taken/);
	});
});
