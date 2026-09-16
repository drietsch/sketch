import { describe, expect, test } from 'vitest';
import { RoughGenerator } from '../../src/generator.js';
import { OPTION_CASES, SHAPES } from '../support/cases.js';
import { roundDrawable } from '../support/round.js';

/**
 * Structural goldens for the cases small enough to read.
 *
 * digest.test.ts pins all 946 cases by hash, which catches any change but shows
 * only THAT something moved. This file additionally pins the full op structure
 * for the cases under SIZE_LIMIT, so the common regressions produce a diff a
 * human can actually review. Oversized cases (notably ellipse-big with a dots
 * fill, 45 MB on its own) are covered by the digest alone.
 */
const SEED = 4242;
const SIZE_LIMIT = 16_000; // bytes of JSON per case; covers 733 of 945 cases (78%)

describe.each(SHAPES)('$shape', ({ run }) => {
  test.each(OPTION_CASES)('$name', ({ options }) => {
    const g = new RoughGenerator();
    const rounded = roundDrawable(run(g, { seed: SEED, ...options }));

    if (JSON.stringify(rounded).length > SIZE_LIMIT) {
      expect(true).toBe(true); // covered by digest.test.ts
      return;
    }
    expect(rounded).toMatchSnapshot();
  });
});
