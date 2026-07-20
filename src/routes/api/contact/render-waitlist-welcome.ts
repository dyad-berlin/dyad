import { copy } from '$lib/copy';
import { tokens } from '$lib/design-tokens.js';

const { color, textSize, space, leading } = tokens;
// SangBleu Sunrise, Bold + Regular only — the Light/300 weight is what
// actually read as "nearly unreadable" at small sizes; Bold and Regular
// hold up fine. Georgia is the fallback for clients that strip @font-face
// (Gmail included) — same weights, so the fallback isn't a downgrade.
const SERIF = "'SangBleu Sunrise', Georgia, 'Times New Roman', serif";
const SIGNATURE_FONT_FACE = `
			<style>
				@font-face {
					font-family: 'SangBleu Sunrise';
					src: url('https://dyad.berlin/fonts/SangBleuSunrise-Regular-WebXL.woff2') format('woff2');
					font-weight: 400;
					font-style: normal;
					font-display: swap;
				}
				@font-face {
					font-family: 'SangBleu Sunrise';
					src: url('https://dyad.berlin/fonts/SangBleuSunrise-Bold-WebXL.woff2') format('woff2');
					font-weight: 700;
					font-style: normal;
					font-display: swap;
				}
			</style>`;

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
							<p style="font-family: ${SERIF}; font-weight: 400; font-size: ${textSize.lg}; line-height: ${leading.tight}; color: ${color.textPrimary}; margin: 0;">${copy.email.signature.names}</p>
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
				<p>You are now on the waitlist for Dyad.</p>
				<p>We began this work because we did not like how being social online had come to feel: intrusive, flattening, and exhausting. The places where we meet too often reduce us to a narrow version of ourselves, leaving little room for complexity, curiosity, or the slow work of making sense of our lives together.</p>
				<p>Dyad is our attempt to make room for something else. A place to seed or discover face-to-face conversations where you live, on terms we shape and consent to together. The digital experience exists only to help people find one another.</p>
				<p>Our work began with an ugly duckling prototype called Dare. Two hundred people joined us for more than a hundred conversations across Berlin, turning a humble experiment into the beginnings of a community. Their experiences continue to shape the product, our collective governance practice, and the wider ecosystem we are building in service of community and collective sensemaking.</p>
				<p>We have received your request and will review it with care. You can expect to hear from us within the next seven days.</p>
				<p>We look forward to meeting you for a conversation.</p>
				<hr style="border: none; border-top: 1px solid ${color.borderSubtle}; margin: ${space[8]} 0 ${space[4]};" />
				${EMAIL_SIGNED_FOOTER}
			</div>
		`;
}
