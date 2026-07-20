import { escapeHtml } from '$lib/utils/escape-html.js';
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
function renderSignedFooter(closing: string, names: string): string {
	return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
					<tr>
						<td style="vertical-align: middle; padding: 0 ${space[5]} 0 0;">
							<a href="https://dyad.berlin" style="display: inline-block; text-decoration: none; font-family: ${SERIF}; font-weight: 700; font-size: 22px; letter-spacing: 0.06em; color: ${color.textPrimary}; white-space: nowrap;">DYAD</a>
						</td>
						<td style="vertical-align: middle; padding: 0 0 0 ${space[5]}; border-left: 1px solid ${color.borderSubtle};">
							<p style="font-family: ${SERIF}; font-weight: 400; font-size: ${textSize.base}; line-height: ${leading.tight}; color: ${color.textSecondary}; margin: 0 0 2px;">${closing}</p>
							<p style="font-family: ${SERIF}; font-weight: 400; font-size: ${textSize.lg}; line-height: ${leading.tight}; color: ${color.textPrimary}; margin: 0;">${names}</p>
						</td>
					</tr>
				</table>`;
}

/**
 * Render the invitation email body.
 *
 * `opener` is the admin's own opening line — e.g. "Hey —" or "Hi friend,".
 * Rendered verbatim (no "Hi " prefix). Omit entirely when empty.
 *
 * `message` (when non-empty) is a quoted block beneath the opener.
 *
 * `signatureClosing` and `signatureNames` override the two voice-bearing
 * lines in the footer. Both default to copy.email.signature.* when omitted.
 * The brand line ("dyad · berlin") is not overridable.
 *
 * All four optional text fields are HTML-escaped inside this function;
 * callers pass raw text. Line breaks in the message are preserved as <br> tags.
 */
export function renderInviteEmail(params: {
	opener?: string;
	inviteUrl: string;
	message?: string;
	expiryDays: number;
	signatureClosing?: string;
	signatureNames?: string;
}): string {
	const openerBlock = params.opener
		? `\n\t\t\t\t<p>${escapeHtml(params.opener)}</p>`
		: '';
	const personalBlock = params.message
		? `
				<blockquote style="margin: 0 0 ${space[6]}; padding: ${space[3]} ${space[4]}; background: #f7f4ee; border-left: 3px solid #c8c2b6; font-style: italic; color: ${color.textSecondary}; white-space: pre-wrap;">${escapeHtml(
					params.message
				).replace(/\n/g, '<br>')}</blockquote>`
		: '';

	const closing = escapeHtml(params.signatureClosing?.trim() || copy.email.signature.closing);
	const names = escapeHtml(params.signatureNames?.trim() || copy.email.signature.names);

	const link = (href: string, label: string) =>
		`<a href="${href}" style="color: ${color.textPrimary}; text-decoration: underline;">${label}</a>`;

	return `${SIGNATURE_FONT_FACE}
			<div style="font-family: Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px; color: ${color.textPrimary}; line-height: ${leading.relaxed};">${openerBlock}${personalBlock}
				<p>We are writing to welcome you in Dyad.</p>
				<p>A few things to help you get started:</p>
				<p>We expect everyone to read and respect our ${link('https://dyad.berlin/docs#standards', 'Community Standards')}. They live in our documentation, alongside resources that make our thinking behind all decisions at Dyad legible.</p>
				<p>Once you log in, you'll get to start conversations, pick if you'd like to meet someone one on one or create one for a group, and discover others in your city this week.</p>
				<p>Dyad is, and will always be, a work in progress. We welcome your involvement in shaping it.</p>
				<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 ${space[6]}; border-collapse: collapse;">
					<tr>
						<td align="center" style="padding: ${space[8]} ${space[6]}; background: #f7f4ee; border: 1px solid #e6dfd2; border-radius: 10px;">
							<p style="margin: 0 0 ${space[2]}; font-family: Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: #4a5d3f;">Support Dyad</p>
							<p style="margin: 0 0 ${space[5]}; font-family: ${SERIF}; font-weight: 700; font-size: 21px; line-height: 1.3; color: ${color.textPrimary};">Six weeks to be joined by 500 supporting members</p>
							<p style="margin: 0 0 ${space[3]}; font-family: ${SERIF}; font-size: 15px; line-height: ${leading.relaxed}; color: ${color.textSecondary}; text-align: left;">From the start, our aim has been to build social technology that gives people shared ground to meet on terms they shape together, while keeping Dyad independent of advertising, extraction, and outside control.</p>
							<p style="margin: 0 0 ${space[3]}; font-family: ${SERIF}; font-size: 15px; line-height: ${leading.relaxed}; color: ${color.textSecondary}; text-align: left;">That independence has also been our greatest challenge. After a year of bootstrapping the work, we are moving toward a member-funded model with our beta launch.</p>
							<p style="margin: 0 0 ${space[6]}; font-family: ${SERIF}; font-size: 15px; line-height: ${leading.relaxed}; color: ${color.textSecondary}; text-align: left;">Over the next six weeks, we aim to reach 500 supporting members. Their contributions will allow us to sustain our operations, keep developing Dyad with the community, and begin our transition toward steward ownership.</p>
							<table role="presentation" cellpadding="0" cellspacing="0" border="0">
								<tr>
									<td style="border-radius: 6px; background: #1a1a1a;">
										<a href="${params.inviteUrl}" style="display: inline-block; padding: ${space[3]} ${space[6]}; font-family: Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 6px;">Welcome to Dyad</a>
									</td>
								</tr>
							</table>
						</td>
					</tr>
				</table>
				<p style="font-size: ${textSize.base}; color: ${color.textMuted};">Your personal invitation link expires in ${params.expiryDays} days.</p>
				<p>Should anything feel unclear, shoot this email to <a href="mailto:luna@dyad.berlin" style="color: ${color.textPrimary}; text-decoration: underline;">luna@dyad.berlin</a>.</p>
				<hr style="border: none; border-top: 1px solid ${color.borderSubtle}; margin: ${space[8]} 0 ${space[4]};" />
				${renderSignedFooter(closing, names)}
			</div>
		`;
}
