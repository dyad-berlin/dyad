import { escapeHtml } from '$lib/utils/escape-html.js';

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
const EMAIL_SIGNED_FOOTER = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0;">
					<tr>
						<td style="vertical-align: middle; padding-right: 16px;">
							<a href="https://dyad.berlin" style="display: inline-block;"><img src="https://dyad.berlin/images/logo-dark.png" alt="dyad" style="height: 48px; width: auto; display: block;" /></a>
						</td>
						<td style="vertical-align: middle; padding-left: 16px; border-left: 1px solid #e0ddd8;">
							<p style="font-family: 'SangBleu Sunrise', Georgia, serif; font-weight: 300; font-size: 14px; color: #3a3a3a; margin: 0 0 2px;">With care and joy,</p>
							<p style="font-family: 'SangBleu Sunrise', Georgia, serif; font-weight: 400; font-size: 16px; color: #1a1a1a; margin: 0 0 8px;">Luna and Fiore</p>
							<p style="font-family: 'SangBleu Sunrise', Georgia, serif; font-weight: 300; font-size: 11px; color: #999; margin: 0; font-variant: small-caps; letter-spacing: 0.08em;">dyad · berlin</p>
						</td>
					</tr>
				</table>`;

/**
 * Render the invitation email body.
 *
 * `opener` is the admin's own opening line — e.g. "Hey —" or "Hi friend,".
 * Rendered verbatim (no "Hi " prefix). Omit entirely when empty.
 *
 * `message` (when non-empty) is a quoted block beneath the opener.
 *
 * Both fields are escaped before interpolation; line breaks in the message
 * are preserved as <br> tags.
 */
export function renderInviteEmail(params: {
	opener?: string;
	inviteUrl: string;
	message?: string;
	expiryDays: number;
}): string {
	const openerBlock = params.opener ? `\n\t\t\t\t<p>${params.opener}</p>` : '';
	const personalBlock = params.message
		? `
				<blockquote style="margin: 0 0 24px; padding: 12px 16px; background: #f7f4ee; border-left: 3px solid #c8c2b6; font-style: italic; color: #3a3a3a; white-space: pre-wrap;">${escapeHtml(
					params.message
				).replace(/\n/g, '<br>')}</blockquote>`
		: '';

	return `${SIGNATURE_FONT_FACE}
			<div style="font-family: Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; line-height: 1.7;">${openerBlock}${personalBlock}
				<p><a href="${params.inviteUrl}" style="color: #1a1a1a; font-weight: bold; text-decoration: underline;">Join dyad</a></p>
				<p style="font-size: 14px; color: #666;">This link expires in ${params.expiryDays} days.</p>
				<hr style="border: none; border-top: 1px solid #e0ddd8; margin: 32px 0 16px;" />
				${EMAIL_SIGNED_FOOTER}
			</div>
		`;
}
