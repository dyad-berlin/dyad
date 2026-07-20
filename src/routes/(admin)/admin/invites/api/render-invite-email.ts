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
				<p>We are delighted to cross paths with you and would love for you to join us.</p>
				<p>A few things to help you find your way:</p>
				<p>We expect everyone to read and respect our ${link('https://dyad.berlin/docs#standards', 'Community Standards')}. They live in the ${link('https://dyad.berlin/docs', 'documentation section')}, alongside resources that make the thinking and decisions behind Dyad legible.</p>
				<p>You can start a conversation or find people looking to meet, one-to-one or in a group, over the coming seven days.</p>
				<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 ${space[6]}; border-collapse: collapse;">
					<tr>
						<td align="center" style="padding: ${space[8]} ${space[6]}; background: #f7f4ee; border: 1px solid #e6dfd2; border-radius: 10px;">
							<p style="margin: 0 0 ${space[2]}; font-family: Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: #4a5d3f;">Support Dyad</p>
							<p style="margin: 0 0 ${space[4]}; font-family: ${SERIF}; font-weight: 700; font-size: 21px; line-height: 1.3; color: ${color.textPrimary};">If 500 of us contribute, Dyad stays independent.</p>
							<p style="margin: 0 0 ${space[5]};"><a href="https://dyad.berlin/membership" style="font-family: Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 700; color: #4a5d3f; text-decoration: underline;">Choose a contribution that fits you →</a></p>
							<p style="margin: 0 0 ${space[3]}; font-family: ${SERIF}; font-size: 15px; line-height: ${leading.relaxed}; color: ${color.textSecondary}; text-align: left;">Contributions are sliding scale, so you pay what fits you, and there is a limited way to take part as a guest if paying is not right for you yet. Contributions are how we stay independent and accountable to the people who use Dyad, not to advertisers or investors.</p>
							<p style="margin: 0; font-family: ${SERIF}; font-size: 15px; line-height: ${leading.relaxed}; color: ${color.textSecondary}; text-align: left;">The ambition beyond that: Dyad becoming the first social technology company owned by the people who use it. Contributing, or sharing Dyad with someone who might want to join, helps bring that closer.</p>
						</td>
					</tr>
				</table>
				<p>Dyad is, and will always be, a work in progress. We welcome your involvement in shaping it.</p>
				<p>Should anything feel unclear, reply to this email or use the feedback button in the app, and one of us will help.</p>
				<p style="font-size: ${textSize.base}; color: ${color.textMuted};">Your personal invitation link will expire in ${params.expiryDays} days:</p>
				<p><a href="${params.inviteUrl}" style="color: ${color.textPrimary}; font-weight: bold; text-decoration: underline;">Welcome to Dyad</a></p>
				<hr style="border: none; border-top: 1px solid ${color.borderSubtle}; margin: ${space[8]} 0 ${space[4]};" />
				${renderSignedFooter(closing, names)}
			</div>
		`;
}
