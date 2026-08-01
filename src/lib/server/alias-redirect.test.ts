import { describe, it, expect } from 'vitest';
import {
	aliasRedirect,
	ALIAS_REDIRECT_STATUS,
	WEBHOOK_EXEMPT_FROM_REDIRECT
} from './alias-redirect.js';

describe('aliasRedirect', () => {
	it('redirects permanently so ranking transfers to the canonical host', () => {
		const res = aliasRedirect(new URL('https://dyad.berlin/wiggling'), 'dyad.social');
		expect(res?.status).toBe(301);
	});

	it('preserves the path', () => {
		const res = aliasRedirect(new URL('https://dyad.berlin/newsletter/some-entry'), 'dyad.social');
		expect(res?.headers.get('Location')).toBe('https://dyad.social/newsletter/some-entry');
	});

	it('preserves the query string', () => {
		const res = aliasRedirect(new URL('https://dyad.berlin/join?glink=abc123'), 'dyad.social');
		expect(res?.headers.get('Location')).toBe('https://dyad.social/join?glink=abc123');
	});

	it('redirects the bare root without doubling the slash', () => {
		const res = aliasRedirect(new URL('https://dyad.berlin/'), 'dyad.social');
		expect(res?.headers.get('Location')).toBe('https://dyad.social/');
	});

	it('sends www.dyad.amsterdam to its own target, not the apex', () => {
		// The helper redirects to whatever target the caller resolved; it must not
		// hardcode the apex, or conference guests get bounced off their host.
		const res = aliasRedirect(new URL('https://www.dyad.amsterdam/join'), 'dyad.amsterdam');
		expect(res?.headers.get('Location')).toBe('https://dyad.amsterdam/join');
	});

	describe('Stripe webhook exemption (payment incident 2026-07-27)', () => {
		it('does not redirect the webhook path', () => {
			// Stripe does not follow redirects. Any redirect here is a failed
			// delivery and no membership activates.
			const res = aliasRedirect(
				new URL(`https://dyad.berlin${WEBHOOK_EXEMPT_FROM_REDIRECT}`),
				'dyad.social'
			);
			expect(res).toBeNull();
		});

		it('still exempts the webhook when it carries a query string', () => {
			const res = aliasRedirect(
				new URL(`https://dyad.berlin${WEBHOOK_EXEMPT_FROM_REDIRECT}?x=1`),
				'dyad.social'
			);
			expect(res).toBeNull();
		});

		it('does not exempt a path that merely starts with the webhook path', () => {
			const res = aliasRedirect(
				new URL(`https://dyad.berlin${WEBHOOK_EXEMPT_FROM_REDIRECT}/extra`),
				'dyad.social'
			);
			expect(res?.status).toBe(ALIAS_REDIRECT_STATUS);
		});
	});
});
