import { execSync } from 'node:child_process';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';

/**
 * Build identifier stamped into the client so in-app feedback records the exact
 * deployed build. Cloudflare Pages exposes CF_PAGES_COMMIT_SHA at build time;
 * locally we fall back to the current git short SHA, then 'dev'.
 */
function appVersion(): string {
	if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA.slice(0, 7);
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'dev';
	}
}

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(appVersion())
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	},
	ssr: {
		// Load the @prefig identity packages through Node's resolver rather
		// than bundling them. They are symlinked workspace packages, which Vite
		// would otherwise bundle and evaluate per entry point; @prefig/upact
		// exposes an `/internal` subpath guarding the opaque Session with a
		// module-private symbol, and double-instantiating it breaks that symbol
		// (respondToWallet rejects a session authenticate() just produced).
		// Externalizing keeps a single Node-resolved instance, matching prod.
		external: [
			'@prefig/upact',
			'@prefig/upact-atproto',
			'@prefig/upact-supabase'
		]
	},
	server: {
		// Dev-only: admit the conference hostnames so the host routing in
		// hooks.server.ts can be exercised locally with a Host header or a
		// hosts-file entry (production host admission lives in route-kind.ts).
		allowedHosts: ['dyad.amsterdam', 'www.dyad.amsterdam'],
		watch: {
			// Agent worktrees under .claude/ carry their own build output. Vite
			// would watch every file in them and exhaust the inotify budget for
			// this process — dev then dies with ENOSPC on a machine whose global
			// limit is nowhere near reached.
			ignored: ['**/.claude/worktrees/**']
		}
	},
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			// Explicit rather than relying on the plugin default: src/app.html links
			// this path by hand, and app.html.test.ts asserts the two agree.
			manifestFilename: 'manifest.webmanifest',
			manifest: {
				// Pins app identity independent of start_url.
				id: '/',
				name: 'dyad',
				short_name: 'dyad',
				description: 'Cultivating a culture of conversation in Berlin',
				theme_color: '#ffffff',
				// Launch splash; matches --bg-canvas in app.css.
				background_color: '#f5f3f0',
				display: 'standalone',
				start_url: '/',
				scope: '/',
				icons: [
					{
						src: 'icon-192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: 'icon-512.png',
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: 'icon-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['client/**/*.{js,css,html,svg,woff2,json}'],
				globIgnores: ['client/uploads/**']
			},
			devOptions: {
				enabled: false
			}
		})
	]
});
