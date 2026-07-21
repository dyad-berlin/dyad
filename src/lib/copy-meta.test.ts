import { describe, it, expect } from 'vitest';
import {
	copySections,
	copyLeaf,
	extractTokens,
	validateOverride,
	MAX_OVERRIDE_LENGTH
} from './copy-meta';
import { copy } from './copy';

describe('copy-meta walker', () => {
	it('finds a known deep string leaf with its default', () => {
		const leaf = copyLeaf('membership.guestIntro');
		expect(leaf).not.toBeNull();
		expect(leaf!.editable).toBe(true);
		expect(leaf!.defaultValue).toBe(copy.membership.guestIntro);
	});

	it('reports function leaves as non-editable rather than omitting them', () => {
		const leaf = copyLeaf('common.nOthers');
		expect(leaf).not.toBeNull();
		expect(leaf!.editable).toBe(false);
	});

	it('attaches _description and _routes metadata to sections', () => {
		const common = copySections().find((s) => s.path === 'common');
		expect(common).toBeDefined();
		expect(common!.description).toMatch(/across the whole app/i);
		expect(common!.routes).toContain('/discover');
	});

	it('returns null for unknown keys and for section paths', () => {
		expect(copyLeaf('nope.nothing')).toBeNull();
		expect(copyLeaf('membership')).toBeNull();
	});

	it('editable-leaf count stays in the expected range (shape guard)', () => {
		const editable = copySections()
			.flatMap((s) => s.leaves)
			.filter((l) => l.editable);
		// ~850 string leaves at plan time; a big swing means the walker (or
		// copy.ts's shape) changed in a way the editor should know about.
		expect(editable.length).toBeGreaterThan(400);
		expect(editable.length).toBeLessThan(2000);
	});

	it('no default contains a duplicated token (validation assumes this)', () => {
		for (const section of copySections()) {
			for (const leaf of section.leaves) {
				if (!leaf.editable) continue;
				const tokens = extractTokens(leaf.defaultValue);
				expect(new Set(tokens).size, `${leaf.key} has duplicate tokens`).toBe(tokens.length);
			}
		}
	});
});

describe('validateOverride', () => {
	// 'discover.audienceTag' default: 'within the {name} corner'
	const KEY = 'discover.audienceTag';

	it('accepts an override that preserves the token set', () => {
		expect(validateOverride(KEY, 'only in the {name} corner')).toEqual([]);
	});

	it('rejects a missing token', () => {
		const errors = validateOverride(KEY, 'only in this corner');
		expect(errors.map((e) => e.code)).toContain('token_missing');
	});

	it('rejects an unknown token (typo)', () => {
		const errors = validateOverride(KEY, 'within the {nmae} corner {name}');
		expect(errors.map((e) => e.code)).toContain('token_unknown');
	});

	it('rejects a duplicated token (single-.replace call sites)', () => {
		const errors = validateOverride(KEY, '{name} and {name} again');
		expect(errors.map((e) => e.code)).toContain('token_duplicated');
	});

	it('accepts the empty string (presence semantics — “render nothing”)', () => {
		expect(validateOverride('common.untitled', '')).toEqual([]);
	});

	it('rejects values over the length ceiling and accepts at the ceiling', () => {
		expect(
			validateOverride('common.untitled', 'x'.repeat(MAX_OVERRIDE_LENGTH + 1)).map((e) => e.code)
		).toContain('too_long');
		expect(validateOverride('common.untitled', 'x'.repeat(MAX_OVERRIDE_LENGTH))).toEqual([]);
	});

	it('rejects non-strings, unknown keys, and function leaves', () => {
		expect(validateOverride('common.untitled', 42).map((e) => e.code)).toContain('not_a_string');
		expect(validateOverride('nope.nothing', 'x').map((e) => e.code)).toContain('unknown_key');
		expect(validateOverride('common.nOthers', 'x').map((e) => e.code)).toContain('not_editable');
	});

	it('brace-like prose that matches the token pattern is treated as a token only if braced letters', () => {
		// '{...}' with non-letters is not a token; it passes through untouched.
		expect(validateOverride('common.untitled', 'set {1} and {a b}')).toEqual([]);
	});
});
