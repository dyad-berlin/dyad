import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Load env vars for test helpers (Supabase keys, etc.)
config({ path: '.env.local' });

const isCI = !!process.env.CI;
const baseURL = isCI ? 'http://localhost:4173' : 'http://localhost:5173';

// Env injected into the spawned dev/preview server for the duration of
// the e2e run.
//   - PUBLIC_PLAUSIBLE_SCRIPT_SRC: enables the script tag in tests that
//     assert on it. .invalid is RFC-2606 reserved; the test checks tag
//     presence, not network behavior.
//   - ADMIN_DEV_BYPASS: lets tests visit /admin/* without Cloudflare Access.
//   - E2E_LOOPBACK: admits localhost through the routing-layer hostname
//     allowlist in production builds (`vite preview`). Without this the
//     preview server 404s on the localhost host header.
const webServerEnv = {
	PUBLIC_PLAUSIBLE_SCRIPT_SRC: 'https://plausible.io/js/pa-test.invalid.js',
	ADMIN_DEV_BYPASS: '1',
	E2E_LOOPBACK: '1'
};

export default defineConfig({
	testDir: './tests',
	fullyParallel: false,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	workers: 1,
	reporter: 'html',
	use: {
		baseURL,
		// SECURITY: Traces capture Authorization headers containing Bearer tokens.
		// Never enable traces in CI where artifacts are retained.
		trace: isCI ? 'off' : 'on-first-retry',
		screenshot: 'only-on-failure'
	},
	projects: [
		{
			name: 'setup',
			testMatch: /auth\.setup\.ts/
		},
		{
			name: 'desktop',
			testMatch: /e2e\/.*\.test\.ts/,
			// WebKit specs are engine-specific; running them under Chromium would
			// assert Blink behaviour and report it as a pass.
			testIgnore: /\.webkit\.test\.ts/,
			use: { viewport: { width: 1280, height: 720 } },
			dependencies: ['setup']
		},
		{
			name: 'mobile',
			testMatch: /e2e\/.*\.responsive\.test\.ts/,
			use: { ...devices['Pixel 7'] },
			dependencies: ['setup']
		},
		{
			// Both other projects are Blink. That is the blind spot that let the
			// iOS standalone regression ship: `apple-mobile-web-app-capable` was
			// renamed to the unprefixed Chromium name on correct Chromium advice,
			// and nothing in the toolchain reads WebKit. devices['iPhone 13']
			// carries defaultBrowserType: 'webkit'. No auth needed — the specs
			// here are anonymous.
			name: 'webkit',
			testMatch: /e2e\/.*\.webkit\.test\.ts/,
			use: { ...devices['iPhone 13'] }
		}
	],
	webServer: isCI
		? { command: 'npm run build && npm run preview', url: baseURL, reuseExistingServer: false, stdout: 'pipe', stderr: 'pipe', env: webServerEnv }
		: { command: 'npm run dev', url: baseURL, reuseExistingServer: !process.env.PW_FRESH_SERVER, stdout: 'pipe', stderr: 'pipe', env: webServerEnv }
});
