// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { IdentityPort } from '@prefig/upact';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
			user: User | null;
			session: Session | null;
			identityPort: IdentityPort;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env?: {
				PUBLIC_SUPABASE_URL: string;
				PUBLIC_SUPABASE_ANON_KEY: string;
			};
			// Cloudflare Workers ExecutionContext — payment-bearing webhook
			// handlers use ctx.waitUntil(...) to fire-and-forget non-state-critical
			// work (operator alerts, internal analytics) after returning 200 to
			// Stripe. Optional because non-Workers runtimes (vite dev, vitest)
			// do not expose it; consumers must fall back to inline await when
			// undefined.
			ctx?: {
				waitUntil(promise: Promise<unknown>): void;
			};
		}
	}
}

export {};
