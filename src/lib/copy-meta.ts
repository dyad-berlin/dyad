/**
 * Metadata layer over the typed copy defaults in `$lib/copy`.
 *
 * The admin copy editor (and its API) need to know the *shape* of the copy
 * object without hardcoding it: which dot-path keys exist, which are
 * overridable strings vs engineer-only functions, what interpolation tokens
 * a default carries, and the per-section `_description`/`_routes` context
 * that copy.ts maintains "for whoever is editing copy".
 *
 * Everything here is pure and isomorphic — the admin API validates overrides
 * server-side with the same functions the editor UI uses for inline feedback.
 */
import { copy } from '$lib/copy';

export interface CopyLeaf {
	/** Dot-path into the copy object, e.g. 'membership.guestIntro'. */
	key: string;
	/** The default value. Functions are stringified for display only. */
	defaultValue: string;
	/** False for function-valued leaves — visible in the editor but not overridable. */
	editable: boolean;
}

export interface CopySection {
	/** Dot-path of the section, e.g. 'membership' or 'feedback.reveal'. */
	path: string;
	/** Human context from the section's _description metadata, if present. */
	description: string | null;
	/** Routes where this section's strings appear, from _routes metadata. */
	routes: string[];
	leaves: CopyLeaf[];
}

export type OverrideValidationError =
	| { code: 'unknown_key'; message: string }
	| { code: 'not_editable'; message: string }
	| { code: 'not_a_string'; message: string }
	| { code: 'too_long'; message: string }
	| { code: 'token_missing'; message: string; token: string }
	| { code: 'token_unknown'; message: string; token: string }
	| { code: 'token_duplicated'; message: string; token: string };

/** Server-enforced ceiling on override length. Generous for prose, small
 *  enough that a paste accident can't balloon layout or storage. */
export const MAX_OVERRIDE_LENGTH = 2000;

/** Interpolation tokens look like {name} — a braced run of letters. Call
 *  sites substitute them with single .replace('{name}', …) calls, which is
 *  why duplicates are rejected by validation: only the first occurrence
 *  would ever be replaced. */
const TOKEN_RE = /\{[a-zA-Z]+\}/g;

export function extractTokens(value: string): string[] {
	return value.match(TOKEN_RE) ?? [];
}

interface WalkResult {
	sections: CopySection[];
	leavesByKey: Map<string, CopyLeaf>;
}

let walked: WalkResult | null = null;

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Depth-first walk of the copy object. A "section" is any nested object;
 *  its string/function properties are leaves, `_`-prefixed keys are
 *  metadata. Sections with no direct leaves (pure containers) are omitted
 *  from the section list but still descended into. */
function walk(): WalkResult {
	if (walked) return walked;
	const sections: CopySection[] = [];
	const leavesByKey = new Map<string, CopyLeaf>();

	const visit = (node: Record<string, unknown>, path: string) => {
		const leaves: CopyLeaf[] = [];
		let description: string | null = null;
		let routes: string[] = [];

		for (const [k, v] of Object.entries(node)) {
			if (k === '_description' && typeof v === 'string') {
				description = v;
				continue;
			}
			if (k === '_routes' && Array.isArray(v)) {
				routes = v.filter((r): r is string => typeof r === 'string');
				continue;
			}
			if (k.startsWith('_')) continue;

			const key = path ? `${path}.${k}` : k;
			if (typeof v === 'string') {
				const leaf: CopyLeaf = { key, defaultValue: v, editable: true };
				leaves.push(leaf);
				leavesByKey.set(key, leaf);
			} else if (typeof v === 'function') {
				const leaf: CopyLeaf = { key, defaultValue: String(v), editable: false };
				leaves.push(leaf);
				leavesByKey.set(key, leaf);
			} else if (isPlainObject(v)) {
				visit(v, key);
			}
			// Arrays and other value types are not copy leaves; skipped.
		}

		if (leaves.length > 0) {
			sections.push({ path: path || '(root)', description, routes, leaves });
		}
	};

	visit(copy as unknown as Record<string, unknown>, '');
	walked = { sections, leavesByKey };
	return walked;
}

/** All sections that carry at least one direct leaf, in copy.ts order. */
export function copySections(): CopySection[] {
	return walk().sections;
}

/** Look up one leaf by dot-path. Returns null for unknown keys and for
 *  paths that point at a section rather than a leaf. */
export function copyLeaf(key: string): CopyLeaf | null {
	return walk().leavesByKey.get(key) ?? null;
}

/**
 * Validate a proposed override against its default.
 *
 * Token rule: the override's tokens must be exactly the default's tokens as
 * a SET, and no token may appear more than once (call sites replace only the
 * first occurrence — a duplicate would render literally). Defaults never
 * contain duplicated tokens today; the walker's tests pin that assumption.
 *
 * Empty-string overrides are valid (legitimately "render nothing");
 * whitespace-only is the editor's judgment call, not an API error.
 */
export function validateOverride(key: string, value: unknown): OverrideValidationError[] {
	const leaf = copyLeaf(key);
	if (!leaf) {
		return [{ code: 'unknown_key', message: `No copy string exists at '${key}'.` }];
	}
	if (!leaf.editable) {
		return [
			{
				code: 'not_editable',
				message: `'${key}' is parameterized copy and requires an engineer to change.`
			}
		];
	}
	if (typeof value !== 'string') {
		return [{ code: 'not_a_string', message: 'The override must be text.' }];
	}

	const errors: OverrideValidationError[] = [];
	if (value.length > MAX_OVERRIDE_LENGTH) {
		errors.push({
			code: 'too_long',
			message: `Overrides are limited to ${MAX_OVERRIDE_LENGTH} characters.`
		});
	}

	const defaultTokens = new Set(extractTokens(leaf.defaultValue));
	const overrideTokens = extractTokens(value);
	const seen = new Set<string>();
	for (const token of overrideTokens) {
		if (!defaultTokens.has(token)) {
			errors.push({
				code: 'token_unknown',
				message: `${token} is not a placeholder this string supports.`,
				token
			});
		} else if (seen.has(token)) {
			errors.push({
				code: 'token_duplicated',
				message: `${token} can only appear once — repeats would show up literally.`,
				token
			});
		}
		seen.add(token);
	}
	for (const token of defaultTokens) {
		if (!seen.has(token)) {
			errors.push({
				code: 'token_missing',
				message: `The override must keep the ${token} placeholder.`,
				token
			});
		}
	}
	return errors;
}
