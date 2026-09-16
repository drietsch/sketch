import { describe, expect, test } from 'vitest';
import { RoughGenerator } from '../../src/generator.js';
import { OPTION_CASES, SHAPES } from '../support/cases.js';
import { digestDrawable, digestPaths } from '../support/digest.js';
import { roundPathD } from '../support/round.js';

/**
 * Golden master, full matrix. Captured from UNMODIFIED src/ before any refactor.
 *
 * Every later commit must leave these digests byte-identical or explain each
 * change. This is the only thing standing between a refactor of renderer.ts and
 * a silent change to the library's visual signature.
 *
 * Two rules that make this work:
 *  - a fresh RoughGenerator per case, because generator.ts:49 returns
 *    defaultOptions BY REFERENCE when no options are passed, which otherwise
 *    leaks a randomizer between cases and makes results order-dependent;
 *  - an explicit nonzero seed in every case, because Random.next() falls back
 *    to Math.random() when the seed is falsy and the default seed is 0.
 */
const SEED = 4242;

describe.each(SHAPES)('$shape', ({ run }) => {
  test.each(OPTION_CASES)('$name', ({ options }) => {
    const g = new RoughGenerator();
    const drawable = run(g, { seed: SEED, ...options });

    expect(digestDrawable(drawable)).toMatchSnapshot('drawable');
    expect(digestPaths(g.toPaths(drawable).map((p) => ({ ...p, d: roundPathD(p.d) })))).toMatchSnapshot('paths');
  });
});
