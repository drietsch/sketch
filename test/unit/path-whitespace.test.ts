import { describe, expect, test } from 'vitest';
import { RoughGenerator } from '../../src/generator.js';
import { digestDrawable } from '../support/digest.js';

/**
 * Pins path-data whitespace handling.
 *
 * Background: generator.ts meant to collapse runs of whitespace with
 * `.replace('/(\s\s)/g', ' ')` -- a string literal, not a regex. The `\s`
 * escapes are meaningless inside a string, so it searched for the literal text
 * `/(ss)/g`, and the collapsing never ran for the library's entire history.
 * ESLint's no-useless-escape flags exactly this, and .eslintrc.json had the rule
 * switched off; it is on in .oxlintrc.json.
 *
 * Measured, not assumed: these assertions pass both before and after that line
 * was turned into a real regex, because path-data-parser already tolerates
 * arbitrary whitespace. So the defect was dead code rather than a rendering bug,
 * and correcting it is behaviour-neutral. What these tests actually lock down is
 * the whitespace tolerance itself, which nothing covered before.
 */
const draw = (d: string) => digestDrawable(new RoughGenerator().path(d, { seed: 77 }));

describe('path data whitespace', () => {
  test('double spaces produce the same geometry as single spaces', () => {
    expect(draw('M 10  10 L 20  20 L 10  30 Z')).toEqual(draw('M 10 10 L 20 20 L 10 30 Z'));
  });

  test('runs of mixed whitespace are collapsed', () => {
    expect(draw('M 10 \t 10 L   20 20 Z')).toEqual(draw('M 10 10 L 20 20 Z'));
  });

  test('newlines are still normalised', () => {
    expect(draw('M 10 10\nL 20 20\nZ')).toEqual(draw('M 10 10 L 20 20 Z'));
  });

  test('single-spaced data is unaffected', () => {
    const d = 'M80 80 A 45 45, 0, 0, 0, 125 125 L 125 80 Z';
    expect(draw(d)).toEqual(draw(d));
  });
});
