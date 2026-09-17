import { describe, expect, test } from 'vitest';
import { RoughGenerator } from '../../../src/sketch/generator.js';
import { digestDrawable } from '../../support/digest.js';

/**
 * A Drawable is a pure function of (shape arguments, options).
 *
 * Before v5 that held only when an options object was passed. _o() returned
 * this.defaultOptions BY REFERENCE otherwise, and renderer.ts lazily attaches a
 * `randomizer` to whatever it is handed -- so calls made without options shared
 * one accumulating random stream on the generator, while calls made with options
 * got a fresh one. Identical arguments produced different drawings depending on
 * whether an options argument was present at all.
 */
const seededRect = () => digestDrawable(new RoughGenerator({ seed: 5 }).rectangle(10, 10, 80, 80));

describe('seeding', () => {
  test('repeated calls with no options are identical', () => {
    const g = new RoughGenerator();
    const a = digestDrawable(g.rectangle(10, 10, 80, 80));
    const b = digestDrawable(g.rectangle(10, 10, 80, 80));
    expect(a).toEqual(b);
  });

  test('repeated calls with the same options are identical', () => {
    const g = new RoughGenerator();
    const a = digestDrawable(g.rectangle(10, 10, 80, 80, { fill: 'red' }));
    const b = digestDrawable(g.rectangle(10, 10, 80, 80, { fill: 'red' }));
    expect(a).toEqual(b);
  });

  test('a generator reports the seed that produced its drawings', () => {
    const g = new RoughGenerator();
    const seed = g.rectangle(10, 10, 80, 80).options.seed;

    expect(seed).toBeGreaterThan(0);
    // and that seed reproduces the drawing on a different generator
    expect(digestDrawable(new RoughGenerator().rectangle(10, 10, 80, 80, { seed }))).toEqual(
      digestDrawable(g.rectangle(10, 10, 80, 80)),
    );
  });

  test('two generators differ unless seeded alike', () => {
    const a = digestDrawable(new RoughGenerator().rectangle(10, 10, 80, 80));
    const b = digestDrawable(new RoughGenerator().rectangle(10, 10, 80, 80));
    expect(a).not.toEqual(b);

    expect(seededRect()).toEqual(seededRect());
  });

  test('newSeed gives variety back on demand', () => {
    const g = new RoughGenerator();
    const a = digestDrawable(g.rectangle(10, 10, 80, 80, { seed: RoughGenerator.newSeed() }));
    const b = digestDrawable(g.rectangle(10, 10, 80, 80, { seed: RoughGenerator.newSeed() }));
    expect(a).not.toEqual(b);
  });

  test('drawing never mutates the generator defaults', () => {
    const g = new RoughGenerator();
    const before = { ...g.defaultOptions };
    g.rectangle(10, 10, 80, 80, { fill: 'red', fillStyle: 'dots' });
    expect({ ...g.defaultOptions }).toEqual(before);
    expect(g.defaultOptions.randomizer).toBeUndefined();
  });
});
