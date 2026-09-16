import { describe, expect, test, vi } from 'vitest';
import { Random, randomSeed } from '../../src/math.js';

describe('Random', () => {
  test('reproduces the exact v4 sequence for a given seed', () => {
    // Hard-coded, not a snapshot: this IS the compatibility contract with
    // roughjs 4.x. Any change here re-renders every seeded drawing in
    // existence, so it must be a deliberate, visible edit.
    const r = new Random(42);
    const seq = Array.from({ length: 10 }, () => +r.next().toFixed(12));

    expect(seq).toEqual([
      0.000944073312, 0.571362842806, 0.255785073154, 0.001266201027, 0.120789761655, 0.64258485008, 0.213298226707,
      0.118701358326, 0.833267743699, 0.667256106623,
    ]);
  });

  test('is deterministic across instances and distinct across seeds', () => {
    const a = new Random(7);
    const b = new Random(7);
    const c = new Random(8);

    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    const seqC = Array.from({ length: 8 }, () => c.next());

    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  test('always yields values in [0, 1)', () => {
    const r = new Random(123456);
    for (let i = 0; i < 5000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test('a falsy seed falls back to Math.random', () => {
    // Current documented-by-behaviour state: Random.next() checks `if (this.seed)`,
    // so seed 0 is not seeded at all. generator.ts defaults seed to 0, which is
    // why default rendering is non-deterministic.
    const spy = vi.spyOn(Math, 'random');
    spy.mockClear();

    new Random(0).next();
    expect(spy).toHaveBeenCalled();
  });

  test('a nonzero seed never touches Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    spy.mockClear();

    const r = new Random(99);
    for (let i = 0; i < 100; i++) r.next();

    expect(spy).not.toHaveBeenCalled();
  });

  test('KNOWN DEFECT: the trailing-zero count of the seed is invariant', () => {
    // 48271 is odd, so s -> (48271*s) mod 2^31 is a bijection and state 0 is
    // unreachable from any nonzero seed. But the number of trailing zero bits is
    // preserved, so a seed of 2^30 is a fixed point yielding 0.5 forever, and
    // power-of-two seeds start near zero.
    //
    // Deliberately NOT fixed: changing the multiplier or modulus would re-render
    // every seeded drawing ever made with this library.
    const r = new Random(2 ** 30);
    expect(Array.from({ length: 5 }, () => r.next())).toEqual([0.5, 0.5, 0.5, 0.5, 0.5]);

    expect(new Random(1).next()).toBeLessThan(0.0001);
    expect(new Random(2).next()).toBeLessThan(0.0001);
  });
});

describe('randomSeed', () => {
  test('returns an integer in [0, 2^31)', () => {
    for (let i = 0; i < 1000; i++) {
      const s = randomSeed();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(2 ** 31);
    }
  });
});
