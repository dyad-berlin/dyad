// Test stub for SvelteKit's `$env/dynamic/private` in the integration suite.
// Aliased under vitest so server modules that read private env (e.g.
// supabase-admin.ts reading SUPABASE_SERVICE_ROLE_KEY) load against .env.local.
export const env = process.env as Record<string, string | undefined>;
