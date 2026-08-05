import { describe, it, expect } from 'vitest';
import { segments } from './segments';

describe('segments', () => {
	it('returns a single plain segment when there is no markup', () => {
		expect(segments('Just a sentence.')).toEqual([{ text: 'Just a sentence.' }]);
	});

	it('returns nothing for an empty paragraph', () => {
		expect(segments('')).toEqual([]);
	});

	it('splits a link out of the surrounding text', () => {
		expect(segments('See [the spec](https://example.com/spec) for more.')).toEqual([
			{ text: 'See ' },
			{ text: 'the spec', href: 'https://example.com/spec' },
			{ text: ' for more.' }
		]);
	});

	it('marks emphasis', () => {
		expect(segments('It is *systemic*, not incidental.')).toEqual([
			{ text: 'It is ' },
			{ text: 'systemic', em: true },
			{ text: ', not incidental.' }
		]);
	});

	it('handles several tokens in one paragraph', () => {
		expect(segments('*One* then [two](https://example.com) then *three*')).toEqual([
			{ text: 'One', em: true },
			{ text: ' then ' },
			{ text: 'two', href: 'https://example.com' },
			{ text: ' then ' },
			{ text: 'three', em: true }
		]);
	});

	// The regression this file was added for: the URL grammar used to stop at
	// the first ')', so a Wikipedia link truncated and left a stray paren.
	it('keeps a balanced paren pair inside the URL', () => {
		expect(segments('[Prefigurative](https://en.wikipedia.org/wiki/Prefigurative_politics_(theory))')).toEqual([
			{
				text: 'Prefigurative',
				href: 'https://en.wikipedia.org/wiki/Prefigurative_politics_(theory)'
			}
		]);
	});

	it('still closes the link at the right paren when text follows', () => {
		expect(segments('see [x](https://ex.com/a_(b)) now')).toEqual([
			{ text: 'see ' },
			{ text: 'x', href: 'https://ex.com/a_(b)' },
			{ text: ' now' }
		]);
	});

	it('leaves a javascript: URL as inert text, never an anchor', () => {
		const out = segments('[click](javascript:alert(1))');
		expect(out.every((s) => s.href === undefined)).toBe(true);
		expect(out.map((s) => s.text).join('')).toBe('[click](javascript:alert(1))');
	});

	it('leaves a protocol-relative URL as inert text', () => {
		const out = segments('[click](//evil.example.com)');
		expect(out.every((s) => s.href === undefined)).toBe(true);
	});

	it('leaves an unmatched asterisk alone', () => {
		expect(segments('5 * 3 = 15')).toEqual([{ text: '5 * 3 = 15' }]);
	});

	it('does not span emphasis across a newline', () => {
		expect(segments('a *b\nc* d')).toEqual([{ text: 'a *b\nc* d' }]);
	});

	it('terminates on an unclosed link without catastrophic backtracking', () => {
		// A quantifier over a quantifier would hang here; the alternation used
		// in URL_BODY is unambiguous, so this returns immediately.
		const hostile = '[x](https://ex.com/' + 'a'.repeat(50_000);
		const started = process.hrtime.bigint();
		const out = segments(hostile);
		const ms = Number(process.hrtime.bigint() - started) / 1e6;
		expect(out).toEqual([{ text: hostile }]);
		expect(ms).toBeLessThan(1000);
	});
});
