import { describe, expect, test } from 'vitest';
import { IdCounter, assertValidId, deriveSeed, fnv1a32, isValidId } from '../../../src/core/ids.js';

describe('fnv1a32', () => {
  test('matches the reference vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });
});

describe('deriveSeed', () => {
  test('is stable and depends on every key', () => {
    expect(deriveSeed(42, 'sketch', 'email')).toBe(deriveSeed(42, 'sketch', 'email'));
    expect(deriveSeed(42, 'sketch', 'email')).not.toBe(deriveSeed(42, 'sketch', 'login'));
    expect(deriveSeed(42, 'sketch', 'email')).not.toBe(deriveSeed(43, 'sketch', 'email'));
    expect(deriveSeed(42, 'a', 'b')).not.toBe(deriveSeed(42, 'b', 'a'));
  });

  test('key boundaries matter', () => {
    expect(deriveSeed(1, 'ab', 'c')).not.toBe(deriveSeed(1, 'a', 'bc'));
  });

  test('is always odd and inside the engine range', () => {
    for (let doc = 0; doc < 200; doc++) {
      for (const key of ['', 'x', 'node-1', 'cursor', 12, 3.5]) {
        const s = deriveSeed(doc, key);
        expect(s % 2).toBe(1);
        expect(s).toBeGreaterThan(0);
        expect(s).toBeLessThan(2 ** 31);
      }
    }
  });

  test('neighbouring document seeds diverge', () => {
    const a = deriveSeed(1, 'sketch', 'x');
    const b = deriveSeed(2, 'sketch', 'x');
    // At least 8 of 31 bits differ: a weak mix would flip only the low ones.
    let diff = 0;
    for (let bit = a ^ b; bit; bit &= bit - 1) diff++;
    expect(diff).toBeGreaterThanOrEqual(8);
  });
});

describe('ids', () => {
  test('validates the id alphabet', () => {
    for (const ok of ['a', 'email', 'login-button', 'x.y:z_1', '9']) expect(isValidId(ok)).toBe(true);
    for (const bad of ['', ' a', 'a b', '-a', 'a/b', 'a"b', 42, null, undefined]) expect(isValidId(bad)).toBe(false);
    expect(() => assertValidId('a b')).toThrow(/Invalid node id/);
  });

  test('counter skips taken ids and counts per type', () => {
    const c = new IdCounter();
    const taken = new Set(['rectangle-2']);
    expect(c.next('RECTANGLE', (id) => taken.has(id))).toBe('rectangle-1');
    expect(c.next('RECTANGLE', (id) => taken.has(id))).toBe('rectangle-3');
    expect(c.next('LINE', (id) => taken.has(id))).toBe('line-1');
  });
});
