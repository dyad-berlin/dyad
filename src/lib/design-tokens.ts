/**
 * Design-token values for runtime contexts that cannot reference CSS variables.
 *
 * The canonical source is the `:root { --token: value }` declarations in
 * `src/app.css`. HTML email is the primary consumer here — email clients have
 * no `:root` to resolve `var(--text-secondary)` against, so the renderer needs
 * the literal value.
 *
 * KEEP IN SYNC with `src/app.css`. The test in `design-tokens.test.ts` parses
 * `src/app.css` and asserts these values match.
 */
export const tokens = {
	color: {
		textPrimary: '#1a1a1a', // --text-primary
		textSecondary: '#333', // --text-secondary
		textMuted: '#666', // --text-muted
		borderSubtle: 'rgba(0, 0, 0, 0.08)' // --border-subtle
	},
	textSize: {
		xs: '11px', // --text-xs
		base: '14px', // --text-base
		lg: '16px' // --text-lg
	},
	space: {
		1: '4px', // --space-1
		2: '8px', // --space-2
		3: '12px', // --space-3
		4: '16px', // --space-4
		5: '20px', // --space-5
		6: '24px', // --space-6
		8: '32px' // --space-8
	},
	leading: {
		tight: '1.2', // --leading-tight
		normal: '1.5', // --leading-normal
		relaxed: '1.7' // --leading-relaxed
	},
	letterSpacing: {
		label: '0.04em' // shared.css convention for small-caps / uppercase labels
	}
} as const;
