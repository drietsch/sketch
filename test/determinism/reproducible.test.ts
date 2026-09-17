import { describe, expect, test } from 'vitest';
import { RoughGenerator } from '../../src/sketch/generator.js';
import { digestDrawable } from '../support/digest.js';
import { FILL_STYLES } from '../support/cases.js';

/**
 * Runs in its own Vitest project with NO deterministic setup file, so these
 * assertions face the real Math.random.
 *
 * FIXED: dot-filler.ts used to jitter each dot with raw Math.random(), so a
 * 'dots' fill was irreproducible even with an explicit seed. It now routes
 * through helper.randOffsetWithRange like every other filler, so all seven fill
 * styles are reproducible.
 *
 * Digests are compared rather than raw op trees: a deep-equal diff over a
 * mismatching dots fill takes ~20s to render.
 */
describe.each(FILL_STYLES)('fillStyle: %s', (fillStyle) => {
  const draw = (g: RoughGenerator) => digestDrawable(g.rectangle(10, 10, 120, 90, { seed: 7, fill: 'red', fillStyle }));

  test('same seed is reproducible across generators', () => {
    expect(draw(new RoughGenerator())).toEqual(draw(new RoughGenerator()));
  });

  test('same seed is reproducible on one generator', () => {
    const g = new RoughGenerator();
    expect(draw(g)).toEqual(draw(g));
  });
});
