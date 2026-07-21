import { describe, it, expect, beforeEach } from 'vitest';
import { ct, setCopyOverrides, ADOPTED_COPY_KEYS } from './copy-runtime.svelte';
import { copy } from './copy';
import { copyLeaf } from './copy-meta';

beforeEach(() => setCopyOverrides({}));

describe('ct (copy runtime resolution)', () => {
	it('returns the typed default when no override exists', () => {
		expect(ct('membership.guestIntro')).toBe(copy.membership.guestIntro);
	});

	it('returns the override when present', () => {
		setCopyOverrides({ 'membership.guestIntro': 'Edited by Özge' });
		expect(ct('membership.guestIntro')).toBe('Edited by Özge');
	});

	it('empty-string override wins over the default (presence semantics)', () => {
		setCopyOverrides({ 'membership.guestIntro': '' });
		expect(ct('membership.guestIntro')).toBe('');
	});

	it('unknown keys fall through to empty string without throwing', () => {
		expect(ct('nope.nothing')).toBe('');
		expect(ct('membership')).toBe(''); // section, not a leaf
	});

	it('defaults resolve before hydration (null/undefined map)', () => {
		setCopyOverrides(null);
		expect(ct('common.untitled')).toBe(copy.common.untitled);
	});

	it('every adopted key is a real editable copy leaf', () => {
		for (const key of ADOPTED_COPY_KEYS) {
			const leaf = copyLeaf(key);
			expect(leaf, `${key} missing from copy.ts`).not.toBeNull();
			expect(leaf!.editable, `${key} is not an editable string leaf`).toBe(true);
		}
	});
});
