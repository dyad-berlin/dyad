/**
 * Validate a post-auth redirect target as a safe, local path.
 *
 * Returns the path only when it starts with `/` followed by an alphanumeric
 * character — the same guard the membership `returnTo` flow uses. This rejects
 * absolute URLs (`https://evil.com`), protocol-relative (`//evil.com`),
 * backslash tricks (`/\evil`, `\\evil`), and schemes (`javascript:`), so no
 * unvalidated value can reach a redirect() and cause an open redirect.
 */
export function safeLocalPath(raw: string | null | undefined): string | null {
	if (typeof raw !== 'string') return null;
	return /^\/[A-Za-z0-9]/.test(raw) ? raw : null;
}
