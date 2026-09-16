import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Seeded replacement for Math.random.
 *
 * Two code paths in the library reach for Math.random directly rather than the
 * seeded randomizer -- dot-filler.ts (the dots fill jitter) and
 * scan-line-hachure.ts (a `||` fallback). Stubbing the global here makes those
 * paths reproducible WITHOUT modifying src/, which is what lets the golden
 * master be captured from unmodified source.
 *
 * beforeEach (not beforeAll) so test order cannot affect results. Never use
 * test.concurrent in these projects: Math.random is process-global.
 */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

beforeEach(() => {
  vi.spyOn(Math, 'random').mockImplementation(mulberry32(0xc0ffee));
});

afterEach(() => {
  vi.restoreAllMocks();
});
