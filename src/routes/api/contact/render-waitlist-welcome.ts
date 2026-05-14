import { copy } from '$lib/copy';
import { tokens } from '$lib/design-tokens.js';

const { color, textSize, space, leading, letterSpacing } = tokens;
const SERIF = "'SangBleu Sunrise', Georgia, serif";

// Font URLs are absolute because email clients have no relative-URL context.
// Files self-hosted on dyad.berlin/fonts/* (mirror of static/fonts/).
const SIGNATURE_FONT_FACE = `
			<style>
				@font-face {
					font-family: 'SangBleu Sunrise';
					src: url('https://dyad.berlin/fonts/SangBleuSunrise-Light-WebXL.woff2') format('woff2');
					font-weight: 300;
					font-style: normal;
					font-display: swap;
				}
				@font-face {
					font-family: 'SangBleu Sunrise';
					src: url('https://dyad.berlin/fonts/SangBleuSunrise-Regular-WebXL.woff2') format('woff2');
					font-weight: 400;
					font-style: normal;
					font-display: swap;
				}
			</style>`;

// Table layout because Outlook does not reliably render flex/grid.
// border-collapse + mso-* are Outlook hygiene; without them Outlook injects stray whitespace and borders.
const EMAIL_SIGNED_FOOTER = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
					<tr>
						<td style="vertical-align: middle; padding: 0 ${space[5]} 0 0;">
							<a href="https://dyad.berlin" style="display: inline-block; text-decoration: none;"><img src="https://dyad.berlin/images/logo-dark.png" alt="dyad" style="height: 48px; width: auto; display: block; border: 0;" /></a>
						</td>
						<td style="vertical-align: middle; padding: 0 0 0 ${space[5]}; border-left: 1px solid ${color.borderSubtle};">
							<p style="font-family: ${SERIF}; font-weight: 300; font-size: ${textSize.base}; line-height: ${leading.tight}; color: ${color.textSecondary}; margin: 0 0 2px;">${copy.email.signature.closing}</p>
							<p style="font-family: ${SERIF}; font-weight: 400; font-size: ${textSize.lg}; line-height: ${leading.tight}; color: ${color.textPrimary}; margin: 0 0 ${space[2]};">${copy.email.signature.names}</p>
							<p style="font-family: ${SERIF}; font-weight: 300; font-size: ${textSize.xs}; line-height: ${leading.tight}; color: ${color.textMuted}; letter-spacing: ${letterSpacing.label}; margin: 0;">${copy.email.signature.brand}</p>
						</td>
					</tr>
				</table>`;

/**
 * Render the waitlist welcome email body.
 *
 * `displayName` must already be HTML-escaped by the caller — this function
 * does not re-escape, to avoid double-encoding entities like `&amp;`.
 */
export function renderWaitlistWelcomeEmail(params: { displayName: string }): string {
	return `${SIGNATURE_FONT_FACE}
			<div style="font-family: Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px; color: ${color.textPrimary}; line-height: ${leading.relaxed};">
				<p>Hi ${params.displayName},</p>
				<p>This question has been one that animated our path in building a piece of social technology as civic infrastructure. So naturally, Dyad became a community of and for people who want company on shared questions, ideas, experiences and all that can be the start of a conversation. All conversations are in person, and we create the digital experience to minimize the time you spend online, and have it a joyful, ad-free roaming experience.</p>
				<p>Since we started with the ugly duckling version of this work, we met so many people who genuinely share our feelings for what a conversation can be: enlivening, insightful, presencing, meaningful, connecting; human. In conversation with these people as our early users, we are currently at work building the app you can use to come across those who resonate, who share what you have in mind with a different vantage point.</p>
				<p>In the meanwhile, we found another way to experience the kind of conversations we have been longing for. Weaving, our public conversation series, is coming to life with its first season this spring in Berlin. More on this very, very soon.</p>
				<p>You are on our waitlist and can expect to hear from us within the next 7 days.</p>
				<p>We are looking forward to meeting you for a conversation.</p>
				<p style="margin-top: ${space[8]};">With care,<br/>Luna</p>
				<hr style="border: none; border-top: 1px solid ${color.borderSubtle}; margin: ${space[8]} 0 ${space[4]};" />
				${EMAIL_SIGNED_FOOTER}
			</div>
		`;
}
