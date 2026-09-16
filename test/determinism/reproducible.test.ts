import { describe, expect, test } from 'vitest';
import { RoughGenerator } from '../../src/generator.js';
import { digestDrawable } from '../support/digest.js';
import { FILL_STYLES } from '../support/cases.js';

/**
 * Runs in its own Vitest project with NO deterministic setup file, so these
 * assertions face the real Math.random.
 *
 * Acceptance test for the dot-filler bug: dot-filler.ts:41-42 jitters each dot
 * with raw Math.random() instead of the seeded randomizer, so a 'dots' fill is
 * not reproducible even with an explicit seed. Every other style routes through
 * o.randomizer.
 *
 * 'dots' is marked test.fails so the defect is pinned rather than merely
 * reported. Fixing dot-filler flips these to normal assertions -- if the bug is
 * ever fixed without updating this file, test.fails itself fails and says so.
 *
 * Digests are compared rather than the raw op trees: a deep-equal diff over a
 * mismatching dots fill takes ~20s to render.
 */
describe.each(FILL_STYLES)('fillStyle: %s', (fillStyle) => {
  const known = fillStyle === 'dots' ? test.fails : test;

  const draw = (g: RoughGenerator) => digestDrawable(g.rectangle(10, 10, 120, 90, { seed: 7, fill: 'red', fillStyle }));

  known('same seed is reproducible across generators', () => {
    expect(draw(new RoughGenerator())).toEqual(draw(new RoughGenerator()));
  });

  known('same seed is reproducible on one generator', () => {
    const g = new RoughGenerator();
    expect(draw(g)).toEqual(draw(g));
  });
});
