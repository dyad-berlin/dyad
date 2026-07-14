import { describe, it, expect } from 'vitest';
import { safeLocalPath } from './safe-redirect';

describe('safeLocalPath', () => {
	it('accepts local paths', () => {
		expect(safeLocalPath('/discover')).toBe('/discover');
		expect(safeLocalPath('/conversations/abc123')).toBe('/conversations/abc123');
		expect(safeLocalPath('/conversations/abc?x=1')).toBe('/conversations/abc?x=1');
	});

	it('rejects non-strings and empty', () => {
		expect(safeLocalPath(null)).toBeNull();
		expect(safeLocalPath(undefined)).toBeNull();
		expect(safeLocalPath('')).toBeNull();
	});

	it('rejects open-redirect vectors', () => {
		expect(safeLocalPath('https://evil.com')).toBeNull();
		expect(safeLocalPath('//evil.com')).toBeNull();
		expect(safeLocalPath('/\\evil.com')).toBeNull();
		expect(safeLocalPath('\\\\evil')).toBeNull();
		expect(safeLocalPath('javascript:alert(1)')).toBeNull();
		expect(safeLocalPath('/')).toBeNull();
	});
});
