import { copy } from '$lib/copy';
import { tokens } from '$lib/design-tokens.js';

const { color, textSize, space, leading, letterSpacing } = tokens;
// Georgia only — no @font-face. The self-hosted SangBleu Light rendered
// nearly unreadable in the clients that honoured it (thin 300 weight at
// small sizes) and was ignored by the rest (Gmail strips @font-face).
// A system serif at regular weight reads everywhere.
const SERIF = "Georgia, 'Times New Roman', serif";

// Table layout because Outlook does not reliably render flex/grid.
// border-collapse + mso-* are Outlook hygiene; without them Outlook injects stray whitespace and borders.
//
// The wordmark is text, not the old logo-dark.png image: that image rendered
// as a broken/mangled "dy/ad" line-wrap in several clients. Text can't break
// like an image can.
const EMAIL_SIGNED_FOOTER = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
					<tr>
						<td style="vertical-align: middle; padding: 0 ${space[5]} 0 0;">
							<a href="https://dyad.berlin" style="display: inline-block; text-decoration: none; font-family: ${SERIF}; font-weight: 700; font-size: 22px; letter-spacing: 0.06em; color: ${color.textPrimary}; white-space: nowrap;">DYAD</a>
						</td>
						<td style="vertical-align: middle; padding: 0 0 0 ${space[5]}; border-left: 1px solid ${color.borderSubtle};">
							<p style="font-family: ${SERIF}; font-weight: 400; font-size: ${textSize.base}; line-height: ${leading.tight}; color: ${color.textSecondary}; margin: 0 0 2px;">${copy.email.signature.closing}</p>
							<p style="font-family: ${SERIF}; font-weight: 400; font-size: ${textSize.lg}; line-height: ${leading.tight}; color: ${color.textPrimary}; margin: 0 0 ${space[2]};">${copy.email.signature.names}</p>
							<p style="font-family: ${SERIF}; font-weight: 400; font-size: ${textSize.xs}; line-height: ${leading.tight}; color: ${color.textMuted}; letter-spacing: ${letterSpacing.label}; margin: 0;">${copy.email.signature.brand}</p>
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
	return `
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
