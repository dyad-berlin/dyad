import { describe, it, expect, afterEach, vi } from 'vitest';

// The helper keeps module-level state (ref-count + saved overflow), so every
// test imports a fresh copy of the module.
async function freshScrollLock() {
	vi.resetModules();
	return await import('./scroll-lock');
}

// The helper only ever touches document.body.style.overflow; a minimal stub
// keeps these tests in the default node environment (which also gives the
// SSR test a genuinely absent document once the stub is removed).
function stubDocument(initialOverflow: string) {
	const doc = { body: { style: { overflow: initialOverflow } } };
	vi.stubGlobal('document', doc);
	return doc;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('scroll-lock', () => {
	it('lock/unlock round-trip restores the pre-existing overflow value', async () => {
		const doc = stubDocument('scroll');
		const { lock, unlock } = await freshScrollLock();

		lock();
		expect(doc.body.style.overflow).toBe('hidden');

		unlock();
		expect(doc.body.style.overflow).toBe('scroll');
	});

	it('stays locked while any holder remains (2x lock, 1x unlock)', async () => {
		const doc = stubDocument('');
		const { lock, unlock } = await freshScrollLock();

		lock();
		lock();
		unlock();
		expect(doc.body.style.overflow).toBe('hidden');

		unlock();
		expect(doc.body.style.overflow).toBe('');
	});

	it('unlock without a prior lock is a no-op and does not corrupt the count', async () => {
		const doc = stubDocument('auto');
		const { lock, unlock } = await freshScrollLock();

		unlock();
		expect(doc.body.style.overflow).toBe('auto');

		// A later balanced pair still behaves normally.
		lock();
		expect(doc.body.style.overflow).toBe('hidden');
		unlock();
		expect(doc.body.style.overflow).toBe('auto');
	});

	it('is a no-op without a document (SSR)', async () => {
		expect(typeof document).toBe('undefined');
		const { lock, unlock } = await freshScrollLock();

		expect(() => {
			lock();
			unlock();
			unlock();
		}).not.toThrow();
	});
});
