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
	server: {
		// Dev-only: admit the conference hostnames so the host routing in
		// hooks.server.ts can be exercised locally with a Host header or a
		// hosts-file entry (production host admission lives in route-kind.ts).
		allowedHosts: ['dyad.amsterdam', 'www.dyad.amsterdam']
	},
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'dyad',
				short_name: 'dyad',
				description: 'Cultivating a culture of conversation in Berlin',
				theme_color: '#ffffff',
				background_color: '#f8fafc',
				display: 'standalone',
				start_url: '/',
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
