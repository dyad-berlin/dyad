/**
 * Inline markup for Unfolding paragraphs: `[label](https://…)` links and
 * `*emphasis*`.
 *
 * Deliberately not `{@html}`: the copy is author-controlled today, but
 * rendering raw strings would make the next person's paste an XSS. The caller
 * renders each segment through normal Svelte interpolation, so every value is
 * escaped. Only `http(s)` is matched, so a `javascript:` URL stays inert text
 * rather than becoming an anchor.
 *
 * Extracted from +page.svelte so the URL grammar is unit-testable — the same
 * reason MapView.pins.ts sits beside MapView.svelte.
 */

export type Segment = { text: string; href?: string; em?: boolean };

/**
 * A URL runs to the closing paren of the markdown link, but may itself contain
 * one balanced pair — Wikipedia's `/wiki/Foo_(bar)` is the common case. Written
 * as an alternation of "one non-paren character" or "one balanced pair", never
 * a quantifier over a quantifier: the two branches cannot match the same first
 * character, so there is no ambiguity for the engine to backtrack through on a
 * URL that never closes.
 */
const URL_BODY = String.raw`https?:\/\/(?:[^\s()]|\([^\s()]*\))+`;

const TOKEN = new RegExp(String.raw`\[([^\]]+)\]\((${URL_BODY})\)|\*([^*\n]+)\*`, 'g');

export function segments(paragraph: string): Segment[] {
	const out: Segment[] = [];
	let last = 0;
	for (const m of paragraph.matchAll(TOKEN)) {
		const at = m.index ?? 0;
		if (at > last) out.push({ text: paragraph.slice(last, at) });
		if (m[2]) out.push({ text: m[1], href: m[2] });
		else out.push({ text: m[3], em: true });
		last = at + m[0].length;
	}
	if (last < paragraph.length) out.push({ text: paragraph.slice(last) });
	return out;
}
