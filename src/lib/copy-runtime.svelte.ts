/**
 * Runtime copy resolution: admin-edited overrides over the typed defaults.
 *
 * `ct(key)` (copy text) returns the override for a dot-path key when one
 * exists, else the default from $lib/copy. Resolution is by key PRESENCE,
 * not truthiness — an empty-string override legitimately means "render
 * nothing" and must win over the default.
 *
 * The overrides map is hydrated from root layout data (src/routes/
 * +layout.svelte calls setCopyOverrides). Module-level state is safe on the
 * server despite being shared across requests in an isolate: the map is
 * global content, identical for every request — there is no per-user data
 * here and must never be.
 *
 * Adoption is incremental: a surface only reflects overrides once its
 * strings go through ct(). Record adopted keys in ADOPTED_COPY_KEYS — the
 * admin editor shows Özge which keys are live vs not yet wired, so a no-op
 * edit isn't mistaken for a bug.
 *
 * Never route ct() output through {@html} — overrides are operator-supplied
 * text and rely on Svelte's default escaping.
 */
import { copy } from '$lib/copy';

let overrides = $state<Record<string, string>>({});

export function setCopyOverrides(map: Record<string, string> | null | undefined): void {
	overrides = map ?? {};
}

function resolveDefault(key: string): string {
	let node: unknown = copy;
	for (const part of key.split('.')) {
		if (typeof node !== 'object' || node === null) return '';
		node = (node as Record<string, unknown>)[part];
	}
	return typeof node === 'string' ? node : '';
}

/** Resolve a copy key: override if present, else the typed default. */
export function ct(key: string): string {
	if (key in overrides) return overrides[key];
	return resolveDefault(key);
}

/**
 * Keys currently wired through ct() somewhere in the UI. Update this list
 * when converting a surface — the admin editor derives its "live" indicator
 * from it. Keep sorted.
 */
export const ADOPTED_COPY_KEYS: readonly string[] = [
	'membership.continueAsGuestCta',
	'membership.guestHeading',
	'membership.guestIntro'
];
