import { escapeHtml } from '$lib/utils/escape-html.js';
import { copy } from '$lib/copy';
import { tokens } from '$lib/design-tokens.js';

const { color, textSize, space, leading, letterSpacing } = tokens;
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
							<p style="font-family: ${SERIF}; font-weight: 400; font-size: ${textSize.lg}; line-height: ${leading.tight}; color: ${color.textPrimary}; margin: 0 0 ${space[2]};">${names}</p>
							<p style="font-family: ${SERIF}; font-weight: 400; font-size: ${textSize.xs}; line-height: ${leading.tight}; color: ${color.textMuted}; letter-spacing: ${letterSpacing.label}; margin: 0;">${copy.email.signature.brand}</p>
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
				<p>Your request to join dyad is accepted. Create your account with your personal invitation link:</p>
				<p><a href="${params.inviteUrl}" style="color: ${color.textPrimary}; font-weight: bold; text-decoration: underline;">Join dyad</a></p>
				<p style="font-size: ${textSize.base}; color: ${color.textMuted};">This link expires in ${params.expiryDays} days.</p>
				<p>A few things worth knowing:</p>
				<ul style="margin: 0 0 ${space[5]}; padding-left: ${space[5]};">
					<li style="margin-bottom: ${space[2]};">Conversations on dyad happen in person: write one, or respond to one that resonates, and meet one-on-one.</li>
					<li style="margin-bottom: ${space[2]};">Our ${link('https://dyad.berlin/docs#standards', 'community standards')} say what we expect from each other.</li>
					<li style="margin-bottom: ${space[2]};">The ${link('https://dyad.berlin/docs', 'documentation')} covers how dyad works and how it is governed.</li>
				</ul>
				<p>If anything is unclear, reply to this email and one of us will help.</p>
				<hr style="border: none; border-top: 1px solid ${color.borderSubtle}; margin: ${space[8]} 0 ${space[4]};" />
				${renderSignedFooter(closing, names)}
			</div>
		`;
}
