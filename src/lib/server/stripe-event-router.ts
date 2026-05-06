import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Canonical kind tokens for Stripe Checkout Sessions and PaymentIntents
 * dyad creates. Both Session creation in plan 002 features and registry
 * registration here import from this single source so typos become
 * compile-time errors rather than dropped events at runtime.
 */
export const STRIPE_EVENT_KIND = {
	foundingCircle: 'founding_circle',
	membership: 'membership',
	trinkgeld: 'trinkgeld',
	venuePatronContribution: 'venue_patron_contribution'
} as const;

export type StripeEventKind = (typeof STRIPE_EVENT_KIND)[keyof typeof STRIPE_EVENT_KIND];

/**
 * The context a handler receives when invoked. Includes the verified Stripe
 * event, a service-role Supabase client, and the parsed metadata.kind.
 */
export interface StripeHandlerContext {
	event: Stripe.Event;
	kind: StripeEventKind;
	supabase: SupabaseClient;
}

/**
 * Per-feature handler signature. Returning a resolved promise indicates the
 * synchronous, state-critical work succeeded. Throwing causes the webhook
 * endpoint to return 5xx and Stripe to retry. The idempotency row is only
 * written after the handler resolves.
 */
export type StripeHandler = (ctx: StripeHandlerContext) => Promise<void>;

/**
 * Registry key. Lookup is by (event.type, metadata.kind). A single Stripe
 * event.type may have multiple registered handlers keyed by metadata.kind
 * (e.g., `checkout.session.completed` is dispatched separately for
 * `founding_circle` and `membership`).
 */
function registryKey(eventType: string, kind: StripeEventKind): string {
	return `${eventType}::${kind}`;
}

const handlers = new Map<string, StripeHandler>();

/**
 * Register a handler for a (event.type, metadata.kind) pair. Per-feature
 * plans call this at module load time. Re-registering the same key throws
 * to surface accidental double-wiring.
 */
export function registerStripeHandler(
	eventType: string,
	kind: StripeEventKind,
	handler: StripeHandler
): void {
	const key = registryKey(eventType, kind);
	if (handlers.has(key)) {
		throw new Error(`Stripe handler already registered for ${key}`);
	}
	handlers.set(key, handler);
}

/**
 * Look up a registered handler. Returns undefined when no handler matches —
 * the webhook endpoint logs and returns 200 in that case rather than asking
 * Stripe to retry.
 */
export function lookupStripeHandler(
	eventType: string,
	kind: StripeEventKind | string | undefined
): StripeHandler | undefined {
	if (!kind) return undefined;
	if (!isStripeEventKind(kind)) return undefined;
	return handlers.get(registryKey(eventType, kind));
}

/**
 * Type guard for the union. The set of recognised `metadata.kind` values
 * is closed at compile time; an unrecognised value is treated as "unknown
 * kind" and logged as an `unhandled_event_kind` per plan 003 U2.
 */
export function isStripeEventKind(value: string): value is StripeEventKind {
	return (Object.values(STRIPE_EVENT_KIND) as string[]).includes(value);
}

/**
 * Set of all event types any handler is registered for. Used by the webhook
 * endpoint to distinguish `unrecognized_event_type` (this Stripe event.type
 * has no registered handler at all) from `unhandled_event_kind` (the
 * event.type has a handler but the metadata.kind was not registered).
 *
 * Returns a fresh Set on every call so consumers cannot mutate the registry
 * indirectly.
 */
export function getRegisteredEventTypes(): Set<string> {
	const out = new Set<string>();
	for (const key of handlers.keys()) {
		out.add(key.split('::')[0]);
	}
	return out;
}

/**
 * Test helper: clear the registry. Not exported from a barrel; used only by
 * unit tests that exercise handler registration in isolation.
 */
export function __resetStripeHandlerRegistryForTesting(): void {
	handlers.clear();
}
