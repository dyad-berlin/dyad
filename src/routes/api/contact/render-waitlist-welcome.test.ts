import { describe, it, expect } from 'vitest';
import { renderWaitlistWelcomeEmail } from './render-waitlist-welcome.js';

describe('renderWaitlistWelcomeEmail — signed footer', () => {
	it('includes the dyad signature names, no brand line (dropped from the footer)', () => {
		const html = renderWaitlistWelcomeEmail({ displayName: 'Alex' });
		expect(html).toContain('With care and joy,');
		expect(html).toContain('Luna and Fiore');
		expect(html).not.toContain('dyad · berlin');
	});

	it('embeds SangBleu Sunrise Bold + Regular via @font-face, Georgia fallback (no Light weight)', () => {
		const html = renderWaitlistWelcomeEmail({ displayName: 'Alex' });
		expect(html).toContain('@font-face');
		expect(html).toContain("url('https://dyad.social/fonts/SangBleuSunrise-Regular-WebXL.woff2')");
		expect(html).toContain("url('https://dyad.social/fonts/SangBleuSunrise-Bold-WebXL.woff2')");
		expect(html).not.toContain('SangBleuSunrise-Light');
		expect(html).toMatch(/font-family: 'SangBleu Sunrise', Georgia, 'Times New Roman', serif/);
	});

	it('renders a text DYAD wordmark linking to dyad.social (not the old logo image)', () => {
		const html = renderWaitlistWelcomeEmail({ displayName: 'Alex' });
		expect(html).not.toContain('logo-dark.png');
		expect(html).not.toContain('<img');
		expect(html).toContain('<a href="https://dyad.social"');
		expect(html).toContain('>DYAD<');
	});

	it('carries the new waitlist-confirmation body copy, no separate body-level sign-off', () => {
		const html = renderWaitlistWelcomeEmail({ displayName: 'Alex' });
		expect(html).toContain('You are now on the waitlist for Dyad.');
		expect(html).toContain('We look forward to meeting you for a conversation.');
		// The only sign-off is the shared footer table now.
		expect(html).not.toContain('With care,<br/>Luna');
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
