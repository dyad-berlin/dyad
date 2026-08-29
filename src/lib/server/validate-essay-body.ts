/**
 * Validation for the essay body variant (plan KTD2/U7): TipTap JSON authored
 * in /admin/unfolding and rendered by the allowlist renderer
 * ($lib/utils/tiptap-html). Runs the prompt-domain structural validator
 * first, then applies the content-specific rule on top:
 *
 * NO INLINE MEDIA. Essay bodies carry no image (or any media) nodes in v1 —
 * the hero image is the essay's one image and it enters through the guarded
 * admin upload (KTD5's MIME + magic-byte checks). This is R4 made structural
 * rather than filtered: a third-party image reference cannot reach a
 * visitor's browser because no image reference of any origin is accepted.
 * If inline images are ever needed, the rule to relax this into is
 * "dyad-storage paths only, resolved through storageUrl()" — never a
 * pass-through of arbitrary URLs.
 */
import type { JSONContent } from '@tiptap/core';
import { validateTiptapContent } from '$lib/server/validate-tiptap-content';

const FORBIDDEN_ESSAY_NODE_TYPES = new Set(['image']);

function findForbiddenNode(node: JSONContent): string | null {
	if (node.type && FORBIDDEN_ESSAY_NODE_TYPES.has(node.type)) return node.type;
	for (const child of node.content ?? []) {
		const hit = findForbiddenNode(child);
		if (hit) return hit;
	}
	return null;
}

/**
 * Returns null when the body is a valid essay body, or an error message.
 * Mirrors the validateTiptapContent contract so callers compose the two.
 */
export function validateEssayBody(body: unknown): string | null {
	const structural = validateTiptapContent(body);
	if (structural) return structural;
	const forbidden = findForbiddenNode(body as JSONContent);
	if (forbidden) return `Essay bodies do not carry inline media (found "${forbidden}" node)`;
	return null;
}
