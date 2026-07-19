import { describe, it, expect } from 'vitest';
import { renderWaitlistWelcomeEmail } from './render-waitlist-welcome.js';

describe('renderWaitlistWelcomeEmail — signed footer', () => {
	it('includes the dyad signature names', () => {
		const html = renderWaitlistWelcomeEmail({ displayName: 'Alex' });
		expect(html).toContain('With care and joy,');
		expect(html).toContain('Luna and Fiore');
		expect(html).toContain('dyad · berlin');
	});

	it('uses a system serif — no @font-face (unreadable Light weight; Gmail strips it anyway)', () => {
		const html = renderWaitlistWelcomeEmail({ displayName: 'Alex' });
		expect(html).not.toContain('@font-face');
		expect(html).not.toContain('SangBleu');
		expect(html).toMatch(/font-family: Georgia, 'Times New Roman', serif/);
	});

	it('renders a text DYAD wordmark linking to dyad.berlin (not the old logo image)', () => {
		const html = renderWaitlistWelcomeEmail({ displayName: 'Alex' });
		expect(html).not.toContain('logo-dark.png');
		expect(html).not.toContain('<img');
		expect(html).toContain('<a href="https://dyad.berlin"');
		expect(html).toContain('>DYAD<');
	});

	it('keeps the body-level "With care, Luna" sign-off intact', () => {
		const html = renderWaitlistWelcomeEmail({ displayName: 'Alex' });
		expect(html).toContain('With care,<br/>Luna');
	});

	it('renders the supplied displayName in the greeting', () => {
		const html = renderWaitlistWelcomeEmail({ displayName: 'Alex' });
		expect(html).toContain('Hi Alex,');
	});

	it('does not re-escape an already-escaped displayName', () => {
		// Caller is responsible for escaping. `&amp;` should appear once, not doubled.
		const html = renderWaitlistWelcomeEmail({ displayName: 'Ann &amp; Ben' });
		expect(html).toContain('Hi Ann &amp; Ben,');
		expect(html).not.toContain('&amp;amp;');
	});
});
